// Acceptance test for src/models/hopfield-capacity.ts against Amit-Gutfreund-
// Sompolinsky (AGS) α_c ≈ 0.138 for the Hopfield network capacity transition.
// Below α_c: stored pattern is fixed point (overlap stays at 1).
// Above α_c: spin-glass phase, overlap collapses to ~0.
//
// Run with:  bun run tests/hopfield-capacity.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/hopfield-capacity.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'fixed_point' | 'spin_glass';
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
  const obs = model.observe?.timeSeries;
  if (!obs) throw new Error('missing timeSeries');
  return obs.value(state);
}

// size=32 → N=1024. So α = P/N → P=50 gives α=0.049, P=300 gives α=0.293.
const cases: TestCase[] = [
  {
    name: 'α=0.049 (below α_c≈0.138, P=50/N=1024): pattern is fixed point',
    params: { num_patterns: 50, noise: 0, size: 32, speed: 5 },
    steps: 100,
    expected: 'fixed_point',
    threshold: 0.85,
  },
  {
    name: 'α=0.488 (well above α_c, P=500/N=1024): spin-glass, overlap collapses',
    params: { num_patterns: 500, noise: 0, size: 32, speed: 10 },
    steps: 500,
    expected: 'spin_glass',
    threshold: 0.5, // |overlap| < 0.5 means stored pattern lost (finite-size smearing keeps some residue)
  },
];

let failed = 0;
console.log(`hopfield-capacity (AGS α_c ≈ 0.138) tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'fixed_point' ? final > tc.threshold : Math.abs(final) < tc.threshold;
  if (pass) {
    console.log(`✓ (overlap=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (overlap=${final.toFixed(4)}, expected ${tc.expected})`);
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
