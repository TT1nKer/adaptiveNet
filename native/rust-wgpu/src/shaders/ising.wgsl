// adaptiveNet — Ising Glauber update kernel (WGSL)
//
// Checkerboard parallel update: parity 0 cells update independent of parity 1
// cells (and vice versa) because each cell's update depends only on its 4
// neighbours, which are all of the opposite parity. Each kernel dispatch
// handles one parity. Two dispatches per sweep.
//
// PRNG is hash-based per (cell, step, parity), so updates are stateless and
// trivially parallel. This must match the C++/CUDA implementation bit-for-bit.

struct Params {
  size: u32,
  beta: f32,
  step: u32,
  parity: u32,
}

@group(0) @binding(0) var<storage, read_write> state: array<i32>;
@group(0) @binding(1) var<uniform> params: Params;

// 32-bit MurmurHash3 finaliser. Identical to the CUDA implementation.
fn hash_u32(x: u32) -> u32 {
  var h: u32 = x;
  h = h ^ (h >> 16u);
  h = h * 0x85ebca6bu;
  h = h ^ (h >> 13u);
  h = h * 0xc2b2ae35u;
  h = h ^ (h >> 16u);
  return h;
}

fn rand01(seed: u32) -> f32 {
  return f32(hash_u32(seed)) * (1.0 / 4294967296.0);
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let s = params.size;
  let r = gid.y;
  let c = gid.x;
  if (r >= s || c >= s) { return; }
  if (((r + c) & 1u) != params.parity) { return; }

  let i = r * s + c;
  let nl = state[r * s + (c + s - 1u) % s];
  let nr = state[r * s + (c + 1u) % s];
  let nu = state[((r + s - 1u) % s) * s + c];
  let nd = state[((r + 1u) % s) * s + c];
  let h = f32(nl + nr + nu + nd);

  let p_plus = 1.0 / (1.0 + exp(-2.0 * params.beta * h));
  let seed = i * 0x9e3779b9u + params.step * 0x6d2b79f5u + params.parity * 0x12345678u;
  let r01 = rand01(seed);

  if (r01 < p_plus) {
    state[i] = 1;
  } else {
    state[i] = -1;
  }
}
