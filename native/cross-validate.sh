#!/usr/bin/env bash
# Cross-validate: run a model in both native runtimes with the same params
# and verify the output trajectories are identical. Catches substrate-spec
# divergence early.
#
# Usage:
#   ./cross-validate.sh ising [--size 256] [--temp 2.27] [--steps 1000] [--seed 1]
#
# Requires both implementations to be built:
#   (cd rust-wgpu && cargo build --release)
#   (cd cpp-cuda && cmake -B build -DCMAKE_BUILD_TYPE=Release && make -C build -j)

set -euo pipefail

MODEL="${1:-ising}"
shift || true
ARGS=("$@")

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RUST_BIN="$SCRIPT_DIR/rust-wgpu/target/release/$MODEL"
CUDA_BIN="$SCRIPT_DIR/cpp-cuda/build/$MODEL"

if [[ ! -x "$RUST_BIN" ]]; then
  echo "ERR: $RUST_BIN not found. Build with:" >&2
  echo "  (cd $SCRIPT_DIR/rust-wgpu && cargo build --release --bin $MODEL)" >&2
  exit 1
fi
if [[ ! -x "$CUDA_BIN" ]]; then
  echo "ERR: $CUDA_BIN not found. Build with:" >&2
  echo "  (cd $SCRIPT_DIR/cpp-cuda && cmake -B build -DCMAKE_BUILD_TYPE=Release && make -C build -j)" >&2
  exit 1
fi

echo "=== model: $MODEL · args: ${ARGS[*]:-defaults} ==="
echo ""

RUST_OUT=$(mktemp)
CUDA_OUT=$(mktemp)
trap 'rm -f "$RUST_OUT" "$CUDA_OUT"' EXIT

echo "--- Rust + WGPU ---"
"$RUST_BIN" "${ARGS[@]}" | tee "$RUST_OUT"
echo ""
echo "--- C++ + CUDA ---"
"$CUDA_BIN" "${ARGS[@]}" | tee "$CUDA_OUT"
echo ""

# Strip comment lines (starting with #) and diff body
RUST_BODY=$(grep -v '^#' "$RUST_OUT")
CUDA_BODY=$(grep -v '^#' "$CUDA_OUT")

if [[ "$RUST_BODY" == "$CUDA_BODY" ]]; then
  echo "=== ✓ MATCH (bit-for-bit identical trajectory) ==="
  exit 0
else
  echo "=== ✗ DIVERGENCE ==="
  diff <(echo "$RUST_BODY") <(echo "$CUDA_BODY") | head -20
  echo ""
  echo "Spec ambiguity. Investigate."
  exit 1
fi
