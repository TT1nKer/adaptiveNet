# Cross-runtime porting quick reference

Most models can stay web-only (TS in `src/models/`). Port to native runtimes only when:

- The user has stated they want N ≥ 10⁵ (web caps out around there)
- The user is doing parameter sweeps (CSV export + batch is easier in native)
- The model is GPU-friendly: **fixed topology, no dynamic memory allocation**

Adaptive (edge-changing) models are deliberately deferred for native — they require GPU dynamic memory which is real engineering work. Tell the user "the native port can come after we figure out dynamic edges on GPU; static-topology models go first."

## The cross-runtime invariant

For a given `(model_id, params, seed)`, the three runtimes should produce *bit-for-bit identical* state evolution if they all use the spec's standard hash-based PRNG (Mulberry32 init + MurmurHash3 finaliser per step). Verified for Ising on 2026-05-04.

Statistical equivalence (not bit-exact) is acceptable for models using stateful per-thread RNGs, but bit-exact is the gold standard.

## Adding a Rust + WGPU implementation

Files needed:

```
native/rust-wgpu/src/bin/<name>.rs       # CLI + dispatch loop
native/rust-wgpu/src/shaders/<name>.wgsl # compute kernel
```

Plus add a new `[[bin]]` entry in `Cargo.toml`:

```toml
[[bin]]
name = "<name>"
path = "src/bin/<name>.rs"
```

Reference: `native/rust-wgpu/src/bin/ising.rs` and `src/shaders/ising.wgsl` are the canonical pattern. Pattern:

1. `pollster::block_on(run(args))` — sync wrapper over async wgpu init
2. Pick adapter (`HighPerformance` preference)
3. Build state buffer from CPU using Mulberry32 (same impl as `src/rng.ts`)
4. Compile WGSL shader, build pipeline + bind group
5. Per simulation step: write params uniform, dispatch workgroup grid, submit
6. Periodically read back state via mapped buffer → compute order parameter → print

## Adding a C++ + CUDA implementation

Files needed:

```
native/cpp-cuda/src/main_<name>.cu       # combined main + kernel
```

Add an `add_executable` line in `CMakeLists.txt`:

```cmake
add_executable(<name> src/main_<name>.cu)
```

Reference: `native/cpp-cuda/src/main.cu` (which currently is the Ising binary). Pattern is similar to Rust+WGPU but in CUDA syntax:

1. Parse args → setup device → print device info
2. Build initial state with same Mulberry32 init
3. `cudaMalloc` device buffer, `cudaMemcpy` initial state
4. Per step: launch `<<<grid, block>>>` kernel(s)
5. Periodically `cudaMemcpy` back, compute order parameter, print

## The hash-based PRNG (use this for bit-exact cross-runtime)

Per-step, per-cell randomness without persistent state. Identical implementation in WGSL and CUDA:

WGSL:
```wgsl
fn hash_u32(x: u32) -> u32 {
  var h: u32 = x;
  h = h ^ (h >> 16u); h = h * 0x85ebca6bu;
  h = h ^ (h >> 13u); h = h * 0xc2b2ae35u;
  h = h ^ (h >> 16u);
  return h;
}
fn rand01(seed: u32) -> f32 { return f32(hash_u32(seed)) * (1.0 / 4294967296.0); }

let seed = i * 0x9e3779b9u + step * 0x6d2b79f5u + parity * 0x12345678u;
let r01 = rand01(seed);
```

CUDA:
```cuda
__device__ __forceinline__ uint32_t hash_u32(uint32_t x) {
  x ^= x >> 16; x *= 0x85ebca6bu;
  x ^= x >> 13; x *= 0xc2b2ae35u;
  x ^= x >> 16; return x;
}
__device__ __forceinline__ float rand01(uint32_t seed) {
  return (float)hash_u32(seed) / 4294967296.0f;
}

uint32_t seed = i * 0x9e3779b9u + step * 0x6d2b79f5u + parity * 0x12345678u;
float r01 = rand01(seed);
```

Use distinct seed mixers per random draw within a step (e.g. multiply step or i by different primes per draw). Otherwise multiple draws from "the same" seed give the same value.

## Mulberry32 (initial state — match `src/rng.ts`)

C++ / CUDA host-side:
```cpp
uint32_t rng_state = seed > 0 ? seed : 1;
for (size_t i = 0; i < n; ++i) {
  rng_state += 0x6d2b79f5u;
  uint32_t t = rng_state;
  t = (t ^ (t >> 15)) * (t | 1);
  t ^= t + ((t ^ (t >> 7)) * (t | 61));
  float r = (float)((t ^ (t >> 14))) / 4294967296.0f;
  // r is uniform [0, 1) — use to initialise state[i]
}
```

Rust (using `wrapping_*` because Rust panics on overflow):
```rust
let mut rng_state: u32 = args.seed.max(1);
for _ in 0..n {
  rng_state = rng_state.wrapping_add(0x6d2b79f5);
  let mut t = rng_state;
  t = (t ^ (t >> 15)).wrapping_mul(t | 1);
  t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
  let r = ((t ^ (t >> 14)) as f32) / 4_294_967_296.0;
  // r is uniform [0, 1) — use to initialise state[i]
}
```

This must match `src/rng.ts:RNG.next()` byte-for-byte. Web → Rust → CUDA initial states will then be identical.

## Cross-validation script

After both native binaries are built:

```sh
./native/cross-validate.sh <name> --size 256 --temp 2.27 --steps 1000 --seed 1
```

The script runs both, diffs the trajectory comments stripped. Exits 0 on bit-for-bit match, 1 on divergence. **Always run this when adding a new native model — it's the regression test for the substrate spec.**

## Output format convention

Both runtimes print the same format:

```
# adapter: <device name>
# step    <observable_name>
0         0.001234
100       0.056789
...
# elapsed: 0.123s
# 5678 sweeps/sec
```

Comment lines start with `#`. Body is tab-separated `step\tvalue`. Pipe-friendly.

## Update the coverage table

After porting, update `native/README.md`:

```md
| Ising | ✓ | ✓ | ✓ | ✓✓ (date, hardware: trajectory matches; perf X vs Y sweeps/sec) |
```

Use ✓ for "implemented + builds + runs", ✓✓ only when the cross-validation script confirms bit-for-bit match.
