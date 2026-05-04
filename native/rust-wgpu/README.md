# adaptiveNet — Rust + WGPU runtime

Portable GPU implementation of the adaptiveNet substrate. WGPU compiles to
Vulkan / Metal / DX12 / OpenGL natively, and can also compile to WebGPU in
the browser. One shader source (WGSL) runs on every platform.

## Install Rust

If you don't have it:

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

## Build + run

```sh
cd native/rust-wgpu
cargo run --release --bin ising -- --size 256 --temp 2.27 --steps 1000 --seed 1
```

First build downloads + compiles ~80 deps (~3-5 min). Subsequent builds are
incremental.

## CLI

```
ising [OPTIONS]

Options:
  -s, --size <N>      Side length of the square lattice. Total cells = N². Default 256.
  -t, --temp <T>      Temperature in J units. Onsager critical T_c ≈ 2.269. Default 2.27.
  -n, --steps <N>     Number of sweeps (each sweep = one full lattice update). Default 1000.
      --seed <N>      RNG seed. Default 1.
```

## Output format

Tab-separated:

```
# adapter: NVIDIA GeForce GTX 1660
# step    magnetization
0         0.0021
100       0.0123
...
999       0.4231
# elapsed: 0.18s
# 5634 steps/sec
```

Comments lines start with `#`. The body is `step\tmagnetization`. Pipe to
`awk` / `gnuplot` / `pandas.read_csv(sep='\t', comment='#')` etc.

## Spec correspondence

Implements model `ising` per [`../../SPEC.md`](../../SPEC.md). Cross-validate
output against:

- Web (`../../src/models/ising.ts`)
- C++/CUDA (`../cpp-cuda/`)

For a given (size, temp, steps, seed) all three should agree on the trajectory
of the order parameter to within ~1e-5 relative. Notable caveats:

- Each runtime uses its own RNG implementation; the initial state distribution
  should be statistically equivalent (50/50 ±1) but the exact bit pattern of
  the first state will differ unless we explicitly align RNGs across runtimes.
- Glauber updates are stateless (hash-based RNG) — these align bit-for-bit
  given the same hash function. The Rust implementation and C++/CUDA
  implementation both use the same MurmurHash-style finaliser, so per-step
  random draws should match.
