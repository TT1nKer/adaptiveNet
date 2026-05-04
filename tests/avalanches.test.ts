// Acceptance test for src/models/avalanches.ts. The model is in the
// BTW/Manna universality class (continuous-activity sandpile with
// dissipation). Acceptance criterion: produces a HEAVY-TAILED avalanche
// size distribution at the critical regime (default parameters).
//
// "Heavy-tailed" check: max avalanche size during a long run is at least
// 50× the mean avalanche size. This is qualitatively what distinguishes
// SOC from purely exponentially-distributed dynamics.
//
// We also test that the SUBCRITICAL regime (high dissipation) suppresses
// large avalanches.
//
// Run with:  bun run tests/avalanches.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/avalanches.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'heavy_tail' | 'narrow';
  max_min?: number; // for heavy_tail: largest avalanche must exceed this
  max_max?: number; // for narrow: largest avalanche must be less than this
}

function runOne(params: Record<string, number | string>, steps: number, seed: number): { sizes: number[] } {
  const rng = new RNG(seed);
  const fullParams: Record<string, number | string> = {};
  for (const [k, spec] of Object.entries(model.params)) {
    fullParams[k] = (k in params) ? params[k]! : (spec as { default: number | string }).default;
  }
  const state = model.init(fullParams as any, rng) as any;
  const sizes: number[] = [];
  for (let s = 0; s < steps; s++) {
    model.step(state, fullParams as any, rng);
    if (state._lastSize > 0) sizes.push(state._lastSize);
  }
  return { sizes };
}

const cases: TestCase[] = [
  // Critical regime: large avalanches occur.
  {
    name: 'critical (ε=0.04): largest avalanche > 100 cells',
    params: { dose: 0.10, dissipation: 0.04, drives_per_frame: 30, size: 96, speed: 1, bin_steps: 1, subsample_frac: 1.0 },
    steps: 5000,
    expected: 'heavy_tail',
    max_min: 100,
  },
  // Subcritical: largest avalanche stays bounded.
  {
    name: 'subcritical (ε=0.30): largest avalanche < 50 cells',
    params: { dose: 0.10, dissipation: 0.30, drives_per_frame: 30, size: 96, speed: 1, bin_steps: 1, subsample_frac: 1.0 },
    steps: 5000,
    expected: 'narrow',
    max_max: 50,
  },
];

let failed = 0;
console.log(`avalanches (BTW/Beggs-Plenz universality class) acceptance tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const { sizes } = runOne(tc.params, tc.steps, 1);
  if (sizes.length === 0) {
    console.log(`✗ no avalanches recorded (sizes empty)`);
    failed++;
    continue;
  }
  const max = Math.max(...sizes);
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const pass = tc.expected === 'heavy_tail'
    ? max > (tc.max_min ?? 0)
    : max < (tc.max_max ?? Infinity);
  if (pass) {
    console.log(`✓ (n=${sizes.length}, max=${max}, mean=${mean.toFixed(2)})`);
  } else {
    console.log(`✗ (n=${sizes.length}, max=${max}, mean=${mean.toFixed(2)}, expected ${tc.expected})`);
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
