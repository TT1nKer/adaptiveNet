#!/usr/bin/env bash
# Run all paper-fidelity acceptance tests.
# Exits 0 only if every test passes.
set -e
cd "$(dirname "$0")/.."
failed=0
total=0
for test in tests/*.test.ts; do
  echo "===== $(basename "$test") ====="
  total=$((total + 1))
  if ! bun run "$test"; then
    failed=$((failed + 1))
  fi
  echo ""
done
echo "================================================================"
echo "TOTAL: $((total - failed))/$total test files PASS"
if [ "$failed" -gt 0 ]; then
  echo "FAILURES: $failed"
  exit 1
fi
echo "================================================================"
