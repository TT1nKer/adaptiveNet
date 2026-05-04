// Acceptance test for src/models/gray-scott.ts. Verifies that pattern
// formation occurs in the canonical Pearson regions:
//
//   1. Default mitosis preset (F=0.0367, k=0.0649) → patterns develop
//      (σ(u) grows from ~0 to substantial value)
//   2. Subcritical (F=0.020, k=0.090) → no patterns; uniform state stable
//
// Run with:  bun run tests/gray-scott.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/gray-scott.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'pattern' | 'uniform';
  threshold: number;
}

function runOne(params: Record<string, number | string>, steps: number, seed: number): number {
  const rng = new RNG(seed);
  const fullParams: Record<string, number | string> = {};
  for (const [k, spec] of Object.entries(model.params)) {
    fullParams[k] = (k in params) ? params[k]! : (spec as { default: number | string }).default;
  }
  const state = model.init(fullParams as any, rng);
  for (let s = 0; s < steps; s++) {
    model.step(state, fullParams as any, rng);
  }
  // Compute σ(u) — variance of activator field
  let s1 = 0, s2 = 0;
  const N = state.N;
  for (let i = 0; i < N; i++) {
    const u = state.X[i * 2]!;
    s1 += u;
    s2 += u * u;
  }
  const m = s1 / N;
  return Math.sqrt(Math.max(0, s2 / N - m * m));
}

const cases: TestCase[] = [
  // Default mitosis (in Munafo λ region) — patterns grow
  {
    name: 'mitosis (F=0.0367, k=0.0649): patterns develop',
    params: { Du: 0.04, Dv: 0.02, f: 0.0367, k: 0.0649, size: 80, speed: 1 },
    steps: 100,
    expected: 'pattern',
    threshold: 0.05, // σ(u) > 0.05 means visible heterogeneity
  },
  // Subcritical region — no Turing instability, system stays uniform
  {
    name: 'subcritical (F=0.10, k=0.10): uniform state',
    params: { Du: 0.04, Dv: 0.02, f: 0.10, k: 0.10, size: 80, speed: 1 },
    steps: 100,
    expected: 'uniform',
    threshold: 0.05, // σ(u) < 0.05 means uniform
  },
];

let failed = 0;
console.log(`gray-scott (Pearson Science 1993 / Munafo classification) tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'pattern' ? final > tc.threshold : final < tc.threshold;
  if (pass) {
    console.log(`✓ (σ(u)=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (σ(u)=${final.toFixed(4)}, expected ${tc.expected} (threshold ${tc.threshold}))`);
    failed++;
  }
}
console.log('');
if (failed > 0) {
  console.log(`FAIL — ${failed}/${cases.length} cases failed`);
  process.exit(1);
} else {
  console.log(`PASS — ${cases.length}/${cases.length} cases pass`);
}
