// adaptiveNet — Ising on WGPU
//
// Glauber checkerboard update on a 2D periodic lattice. Two compute-shader
// dispatches per sweep: one for parity 0 (even cells), one for parity 1 (odd).
// Hash-based stateless PRNG so bit-for-bit determinism is achievable across
// runtimes that use the same hash.

use bytemuck::{Pod, Zeroable};
use std::time::Instant;
use wgpu::util::DeviceExt;

#[derive(Default)]
struct Args {
    size: u32,
    temp: f32,
    steps: u32,
    seed: u32,
}

fn parse_args() -> Args {
    let mut args = Args {
        size: 256,
        temp: 2.27,
        steps: 1000,
        seed: 1,
    };
    let mut it = std::env::args().skip(1);
    while let Some(arg) = it.next() {
        match arg.as_str() {
            "-s" | "--size" => args.size = it.next().and_then(|v| v.parse().ok()).unwrap_or(args.size),
            "-t" | "--temp" => args.temp = it.next().and_then(|v| v.parse().ok()).unwrap_or(args.temp),
            "-n" | "--steps" => args.steps = it.next().and_then(|v| v.parse().ok()).unwrap_or(args.steps),
            "--seed" => args.seed = it.next().and_then(|v| v.parse().ok()).unwrap_or(args.seed),
            "-h" | "--help" => {
                println!("Usage: ising [-s SIZE] [-t TEMP] [-n STEPS] [--seed N]");
                std::process::exit(0);
            }
            other => eprintln!("# warning: unrecognised arg `{}`", other),
        }
    }
    args
}

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
struct Params {
    size: u32,
    beta: f32,
    step: u32,
    parity: u32,
}

fn main() {
    let args = parse_args();
    pollster::block_on(run(args));
}

async fn run(args: Args) {
    // ---------- pick GPU adapter ----------
    let instance = wgpu::Instance::default();
    let adapter = instance
        .request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            ..Default::default()
        })
        .await
        .expect("no GPU adapter found");
    let info = adapter.get_info();
    println!("# adapter: {} ({:?})", info.name, info.backend);

    let (device, queue) = adapter
        .request_device(&wgpu::DeviceDescriptor::default(), None)
        .await
        .expect("device init failed");

    // ---------- initial state (RNG matches the web runtime's Mulberry32) ----------
    let n = (args.size as usize) * (args.size as usize);
    let mut state: Vec<i32> = Vec::with_capacity(n);
    let mut rng_state: u32 = args.seed.max(1);
    for _ in 0..n {
        // Mulberry32 — same as src/rng.ts in the web runtime
        rng_state = rng_state.wrapping_add(0x6d2b79f5);
        let mut t = rng_state;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        let r = ((t ^ (t >> 14)) as f32) / 4_294_967_296.0;
        state.push(if r < 0.5 { 1 } else { -1 });
    }

    // ---------- buffers ----------
    let state_size = (n * std::mem::size_of::<i32>()) as u64;
    let state_buf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("state"),
        contents: bytemuck::cast_slice(&state),
        usage: wgpu::BufferUsages::STORAGE
            | wgpu::BufferUsages::COPY_SRC
            | wgpu::BufferUsages::COPY_DST,
    });
    let params_buf = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("params"),
        size: std::mem::size_of::<Params>() as u64,
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        mapped_at_creation: false,
    });
    let read_buf = device.create_buffer(&wgpu::BufferDescriptor {
        label: Some("readback"),
        size: state_size,
        usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
        mapped_at_creation: false,
    });

    // ---------- shader + pipeline ----------
    let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some("ising-wgsl"),
        source: wgpu::ShaderSource::Wgsl(include_str!("../shaders/ising.wgsl").into()),
    });
    let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
        label: Some("ising-pipeline"),
        layout: None,
        module: &shader,
        entry_point: Some("main"),
        compilation_options: Default::default(),
        cache: None,
    });
    let bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: Some("ising-bg"),
        layout: &pipeline.get_bind_group_layout(0),
        entries: &[
            wgpu::BindGroupEntry {
                binding: 0,
                resource: state_buf.as_entire_binding(),
            },
            wgpu::BindGroupEntry {
                binding: 1,
                resource: params_buf.as_entire_binding(),
            },
        ],
    });

    let beta = 1.0_f32 / args.temp;
    let workgroups = args.size.div_ceil(16);

    // ---------- main loop ----------
    let t_start = Instant::now();
    println!("# step\tmagnetization");

    for step in 0..args.steps {
        for parity in 0u32..2 {
            let params = Params {
                size: args.size,
                beta,
                step,
                parity,
            };
            queue.write_buffer(&params_buf, 0, bytemuck::bytes_of(&params));
            let mut encoder = device.create_command_encoder(&Default::default());
            {
                let mut pass = encoder.begin_compute_pass(&Default::default());
                pass.set_pipeline(&pipeline);
                pass.set_bind_group(0, &bind_group, &[]);
                pass.dispatch_workgroups(workgroups, workgroups, 1);
            }
            queue.submit(Some(encoder.finish()));
        }

        if step % 100 == 0 || step == args.steps - 1 {
            // copy GPU buffer to CPU-readable, await mapping, sum spins.
            let mut encoder = device.create_command_encoder(&Default::default());
            encoder.copy_buffer_to_buffer(&state_buf, 0, &read_buf, 0, state_size);
            queue.submit(Some(encoder.finish()));
            let slice = read_buf.slice(..);
            let (tx, rx) = std::sync::mpsc::channel();
            slice.map_async(wgpu::MapMode::Read, move |r| {
                tx.send(r).unwrap();
            });
            device.poll(wgpu::Maintain::Wait);
            rx.recv().unwrap().unwrap();
            let view = slice.get_mapped_range();
            let result: &[i32] = bytemuck::cast_slice(&view);
            let m: i64 = result.iter().map(|&x| x as i64).sum();
            let mag = (m as f64) / (n as f64);
            println!("{}\t{:.6}", step, mag);
            drop(view);
            read_buf.unmap();
        }
    }

    let elapsed = t_start.elapsed().as_secs_f64();
    println!("# elapsed: {:.3}s", elapsed);
    println!("# {:.0} sweeps/sec", args.steps as f64 / elapsed);
}
