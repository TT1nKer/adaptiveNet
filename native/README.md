# adaptiveNet — native runtimes

Two GPU-accelerated implementations of the adaptiveNet substrate, sharing the
same language-independent spec but optimised for serious large-N research
where the web runtime caps out (~10⁵ nodes).

| Runtime | Hardware | Strengths |
|---|---|---|
| [`rust-wgpu/`](rust-wgpu/) | Any GPU (NVIDIA, AMD, Intel, Apple) via WebGPU | Portable; same WGSL shader on every platform; the wgpu crate can also compile to wasm + WebGPU in the browser if we ever want to fuse with the web runtime |
| [`cpp-cuda/`](cpp-cuda/) | NVIDIA GPU only | Shortest path to bare-metal CUDA, max perf, easiest access to NCCL/cuDNN/etc. if we ever need them |

Both implementations follow the substrate spec in [`../SPEC.md`](../SPEC.md):
the same model + same seed should produce comparable output across both
(and the web runtime), modulo floating-point determinism limits across
different ISAs.

## Workflow

| Use case | Runtime |
|---|---|
| Demo, teach, share, embed in a blog post | [Web (../sandbox.html, ../player.html)](..) |
| Research at N ≤ 10⁵, fast iteration | Web sandbox |
| Research at N ~ 10⁵ - 10⁷, portable | Rust + WGPU |
| Research at N ~ 10⁶ - 10⁹, NVIDIA-only, max perf | C++ + CUDA |

## Cross-validation invariant

For a given model + same `seed` + same step count, all three runtimes should
agree on the trajectory of the macroscopic order parameter to within
floating-point rounding (~1e-5 relative). The first-pass test of this is
the Ising critical magnetisation: at T = T_c ≈ 2.269 with N = 256², after
10⁴ sweeps, the absolute magnetisation should be small but non-zero with
characteristic critical fluctuations. Wide divergence between runtimes ⇒
substrate spec ambiguity that must be resolved.

## Model coverage status

✓ = implemented + tested · ✓✓ = cross-validated bit-for-bit between native runtimes

| Model | Web (TS) | Rust + WGPU | C++ + CUDA | Cross-validated |
|---|---|---|---|---|
| Ising            | ✓ | ✓ | ✓ | ✓✓ (2026-05-04, GTX 1660: trajectory matches bit-for-bit; perf 14,990 vs 63,296 sweeps/sec) |
| Hopfield         | ✓ | — | — |
| Hopfield Capacity | ✓ | — | — |
| Hopfield Modern  | ✓ | — | — |
| LIF              | ✓ | — | — |
| Avalanches       | ✓ | — | — |
| Network Turing (Nakao) | ✓ | — | — |
| Brusselator      | ✓ | — | — |
| Gray-Scott       | ✓ | — | — |
| Adaptive Voter   | ✓ | — | — |
| Adaptive SIS     | ✓ | — | — |
| Template (Adaptive Spread) | ✓ | — | — |

Adaptive (topology-changing) models are deliberately deferred for the
native runtimes — they require dynamic GPU memory management which is a
real engineering project. Static-topology models go first.

## Why two native runtimes (not just one)

The author has 10y commit + AI-coding bandwidth and explicitly chose to
build both rather than pick one (2026-05-04). Reasons:

- **Cross-validation**: independent implementations agreeing on output is
  the strongest evidence that the substrate spec is unambiguous.
- **Hardware portability vs maximum perf**: WGPU runs anywhere, CUDA wins
  benchmarks. Both audiences exist.
- **Ecosystem hedge**: WGPU might mature into the right cross-platform GPU
  abstraction, or NVIDIA might solidify its CUDA monopoly. Building both
  removes the lock-in risk.
- **DSL design input**: when the eventual common DSL is designed (Phase 5
  in the roadmap), having two real implementations to validate against is
  much better than designing it in a vacuum.

## Build

See each subdirectory's README:

- [rust-wgpu/README.md](rust-wgpu/README.md) — `rustup` + `cargo run`
- [cpp-cuda/README.md](cpp-cuda/README.md) — `cmake` + `make`

## Cross-validate

After building both runtimes, run:

```sh
./cross-validate.sh ising --size 256 --temp 2.27 --steps 1000 --seed 1
```

The script runs the model in both runtimes with the same args, then diffs
the output trajectories. Exits 0 on match, 1 on divergence. **First-try
result for Ising on a GTX 1660 (2026-05-04): bit-for-bit identical between
Rust+WGPU and C++/CUDA across all sampled steps.**
