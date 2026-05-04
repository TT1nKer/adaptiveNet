// Acceptance test for src/models/hopfield-modern.ts. The headline claim of
// Ramsauer et al. 2020: Modern Hopfield can store more patterns than
// classical (which fails at α > α_c ≈ 0.138). Test:
//   - at α=0.20 (classical capacity demo's spin-glass regime), Modern
//     Hopfield with β=10 should still retrieve the target pattern.
//   - at α=1.0 (extreme overload), high β should still allow retrieval.
//
// Run with:  bun run tests/hopfield-modern.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/hopfield-modern.ts';

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
  // α=0.196 (P=200, N=1024) — past classical α_c=0.138, but Modern handles it
  {
    name: 'α=0.196 past classical α_c, β=10: retrieval succeeds',
    params: { num_patterns: 200, beta: 10, noise: 0.30, size: 32, speed: 5 },
    steps: 100,
    expected: 'recalled',
    threshold: 0.85,
  },
  // Massive capacity: P=1024, N=1024, α=1.0 (10x past classical), high β
  {
    name: 'α=1.0 (massive capacity), β=20: retrieval still works',
    params: { num_patterns: 1024, beta: 20, noise: 0.30, size: 32, speed: 5 },
    steps: 100,
    expected: 'recalled',
    threshold: 0.5,
  },
];

let failed = 0;
console.log(`hopfield-modern (Ramsauer et al. 2020) tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
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
