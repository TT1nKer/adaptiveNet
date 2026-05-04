# adaptiveNet — C++ + CUDA runtime

Bare-metal NVIDIA implementation of the adaptiveNet substrate. Shortest path
to maximum GPU performance, easy access to NVIDIA-specific features (NCCL,
cuDNN, Tensor Cores, etc.) when needed.

Hardware: any NVIDIA GPU with compute capability ≥ 6.0 (Pascal or newer).
Tested on GTX 1660 (sm_75 / Turing).

## Install (Arch Linux)

```sh
sudo pacman -S cuda cmake
```

CUDA toolkit installs to `/opt/cuda/`. Make sure `/opt/cuda/bin` is on PATH:

```sh
echo 'export PATH="/opt/cuda/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
nvcc --version    # verify
```

## Build + run

```sh
cd native/cpp-cuda
mkdir -p build && cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
make -j
./ising --size 256 --temp 2.27 --steps 1000 --seed 1
```

## CLI

```
ising [--size N] [--temp T] [--steps N] [--seed N]

  --size N       Side length of the square lattice. Default 256.
  --temp T       Temperature in J units. Onsager T_c ≈ 2.269. Default 2.27.
  --steps N      Number of sweeps. Default 1000.
  --seed N       RNG seed. Default 1.
```

## Output

Identical format to the Rust+WGPU implementation:

```
# device: NVIDIA GeForce GTX 1660
# step    magnetization
0         0.0021
100       0.0123
...
999       0.4231
# elapsed: 0.06s
# 16203 sweeps/sec
```

## Spec correspondence

Implements model `ising` per [`../../SPEC.md`](../../SPEC.md). Designed to
cross-validate against the Rust+WGPU implementation: same hash-based PRNG,
same Glauber update, same checkerboard parallelisation. Bit-for-bit identical
output expected for the same (size, temp, seed, steps) — except where
floating-point operations differ between WGSL's `exp()` and CUDA's `expf()`,
which can produce ULP-level differences propagating into late-step state.

## Compute capability note

`CMakeLists.txt` defaults to `CMAKE_CUDA_ARCHITECTURES=75` (Turing, GTX 1660).
For other GPUs:

| Family | Compute capability |
|---|---|
| Pascal (GTX 10-series) | 60 / 61 |
| Volta (V100) | 70 |
| Turing (RTX 20-series, GTX 1660) | 75 |
| Ampere (RTX 30-series, A100) | 80 / 86 |
| Ada (RTX 40-series) | 89 |
| Hopper (H100) | 90 |

Override via `cmake -DCMAKE_CUDA_ARCHITECTURES=86 ..` etc.
