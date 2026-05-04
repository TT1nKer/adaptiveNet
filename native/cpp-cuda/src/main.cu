// adaptiveNet — Ising on CUDA
//
// Glauber checkerboard update on a 2D periodic lattice. Two kernel launches
// per sweep: one for parity 0 (even cells), one for parity 1 (odd). Designed
// to cross-validate against the Rust+WGPU implementation in ../rust-wgpu/.
//
// Identical hash-based PRNG, identical update rule, identical workgroup size
// (16x16). Output trajectory should match within floating-point ULP.

#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <vector>

#include <cuda_runtime.h>

#define CUDA_CHECK(x)                                                         \
  do {                                                                        \
    cudaError_t err = (x);                                                    \
    if (err != cudaSuccess) {                                                 \
      std::fprintf(stderr, "CUDA error %s:%d: %s\n", __FILE__, __LINE__,      \
                   cudaGetErrorString(err));                                  \
      std::exit(1);                                                           \
    }                                                                         \
  } while (0)

// ---------- 32-bit MurmurHash3 finaliser (matches the WGSL impl) ----------
__device__ __forceinline__ uint32_t hash_u32(uint32_t x) {
  x ^= x >> 16;
  x *= 0x85ebca6bu;
  x ^= x >> 13;
  x *= 0xc2b2ae35u;
  x ^= x >> 16;
  return x;
}

__device__ __forceinline__ float rand01(uint32_t seed) {
  return static_cast<float>(hash_u32(seed)) * (1.0f / 4294967296.0f);
}

// ---------- Glauber checkerboard update kernel ----------
__global__ void ising_step(int *state, uint32_t size, float beta,
                           uint32_t step, uint32_t parity) {
  uint32_t c = blockIdx.x * blockDim.x + threadIdx.x;
  uint32_t r = blockIdx.y * blockDim.y + threadIdx.y;
  if (r >= size || c >= size) return;
  if (((r + c) & 1u) != parity) return;

  uint32_t i = r * size + c;
  int nl = state[r * size + (c + size - 1u) % size];
  int nr = state[r * size + (c + 1u) % size];
  int nu = state[((r + size - 1u) % size) * size + c];
  int nd = state[((r + 1u) % size) * size + c];
  float h = static_cast<float>(nl + nr + nu + nd);

  float p_plus = 1.0f / (1.0f + expf(-2.0f * beta * h));
  uint32_t seed = i * 0x9e3779b9u + step * 0x6d2b79f5u + parity * 0x12345678u;
  float r01 = rand01(seed);
  state[i] = (r01 < p_plus) ? 1 : -1;
}

// ---------- CLI ----------
struct Args {
  uint32_t size = 256;
  float temp = 2.27f;
  uint32_t steps = 1000;
  uint32_t seed = 1;
};

static Args parse_args(int argc, char **argv) {
  Args a;
  for (int i = 1; i < argc; ++i) {
    const char *arg = argv[i];
    auto need = [&](const char *flag) -> const char * {
      if (i + 1 >= argc) {
        std::fprintf(stderr, "# error: %s requires a value\n", flag);
        std::exit(2);
      }
      return argv[++i];
    };
    if (std::strcmp(arg, "--size") == 0) a.size = std::atoi(need(arg));
    else if (std::strcmp(arg, "--temp") == 0) a.temp = std::atof(need(arg));
    else if (std::strcmp(arg, "--steps") == 0) a.steps = std::atoi(need(arg));
    else if (std::strcmp(arg, "--seed") == 0) a.seed = std::atoi(need(arg));
    else if (std::strcmp(arg, "-h") == 0 || std::strcmp(arg, "--help") == 0) {
      std::printf("Usage: ising [--size N] [--temp T] [--steps N] [--seed N]\n");
      std::exit(0);
    } else {
      std::fprintf(stderr, "# warning: unrecognised arg `%s`\n", arg);
    }
  }
  return a;
}

int main(int argc, char **argv) {
  Args args = parse_args(argc, argv);

  // Print device info
  int device;
  cudaDeviceProp prop;
  CUDA_CHECK(cudaGetDevice(&device));
  CUDA_CHECK(cudaGetDeviceProperties(&prop, device));
  std::printf("# device: %s (sm_%d%d)\n", prop.name, prop.major, prop.minor);

  // ---------- Initial state via Mulberry32 (matches the web + Rust impls) ----------
  size_t n = static_cast<size_t>(args.size) * args.size;
  std::vector<int> host_state(n);

  uint32_t rng_state = args.seed > 0 ? args.seed : 1;
  for (size_t i = 0; i < n; ++i) {
    rng_state += 0x6d2b79f5u;
    uint32_t t = rng_state;
    t = (t ^ (t >> 15)) * (t | 1);
    t ^= t + ((t ^ (t >> 7)) * (t | 61));
    float r = static_cast<float>((t ^ (t >> 14))) / 4294967296.0f;
    host_state[i] = (r < 0.5f) ? 1 : -1;
  }

  // ---------- GPU buffers ----------
  int *dev_state = nullptr;
  CUDA_CHECK(cudaMalloc(&dev_state, n * sizeof(int)));
  CUDA_CHECK(cudaMemcpy(dev_state, host_state.data(), n * sizeof(int),
                        cudaMemcpyHostToDevice));

  float beta = 1.0f / args.temp;
  dim3 block(16, 16);
  dim3 grid((args.size + 15u) / 16u, (args.size + 15u) / 16u);

  // ---------- Main loop ----------
  auto t_start = std::chrono::steady_clock::now();
  std::printf("# step\tmagnetization\n");

  for (uint32_t step = 0; step < args.steps; ++step) {
    ising_step<<<grid, block>>>(dev_state, args.size, beta, step, 0u);
    ising_step<<<grid, block>>>(dev_state, args.size, beta, step, 1u);

    if (step % 100 == 0 || step == args.steps - 1) {
      CUDA_CHECK(cudaMemcpy(host_state.data(), dev_state, n * sizeof(int),
                            cudaMemcpyDeviceToHost));
      int64_t m = 0;
      for (size_t i = 0; i < n; ++i) m += host_state[i];
      double mag = static_cast<double>(m) / static_cast<double>(n);
      std::printf("%u\t%.6f\n", step, mag);
    }
  }
  CUDA_CHECK(cudaDeviceSynchronize());

  double elapsed =
      std::chrono::duration<double>(std::chrono::steady_clock::now() - t_start)
          .count();
  std::printf("# elapsed: %.3fs\n", elapsed);
  std::printf("# %.0f sweeps/sec\n", args.steps / elapsed);

  cudaFree(dev_state);
  return 0;
}
