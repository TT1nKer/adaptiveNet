// Acceptance test for src/models/hopfield.ts against Hopfield 1982. Verifies
// recall from a noisy cue: with 30% pixel-noise on a cue derived from a
// stored pattern, the dynamics should converge to recover the original
// pattern (overlap → 1).
//
// Run with:  bun run tests/hopfield.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/hopfield.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'recalled' | 'lost';
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

const cases: TestCase[] = [
  {
    name: 'noise=0.30: recall succeeds (overlap → 1)',
    params: { pattern: 'X', noise: 0.30, size: 32, speed: 5 },
    steps: 200,
    expected: 'recalled',
    threshold: 0.90,
  },
  {
    name: 'noise=0.95: recall to inverse (|overlap|>0.5)',
    params: { pattern: 'X', noise: 0.95, size: 32, speed: 5 },
    steps: 200,
    expected: 'recalled',
    threshold: 0.5,
  },
];

let failed = 0;
console.log(`hopfield (Hopfield PNAS 1982) tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  // Both "recall to target" and "recall to inverse" are valid Hopfield
  // attractors due to X → -X energy symmetry, so we take |overlap|.
  const pass = Math.abs(final) > tc.threshold;
  if (pass) {
    console.log(`✓ (overlap=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (overlap=${final.toFixed(4)}, expected |overlap|>${tc.threshold})`);
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
