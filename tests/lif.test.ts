// Acceptance test for src/models/lif.ts. The LIF model with central drive
// + moderate coupling produces propagating spike waves. Test:
//
//   - Default (W_syn=1.0, I_drive=0.5): wave activity, non-zero firing rate
//     after warmup
//   - Silent regime (I_drive=0): network goes silent within seconds
//
// Run with:  bun run tests/lif.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/lif.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'active' | 'silent';
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
  // Measure: average firing rate over last 50 steps. Use observe.timeSeries.
  const obs = model.observe?.timeSeries;
  if (!obs) throw new Error('missing timeSeries');
  return obs.value(state);
}

const cases: TestCase[] = [
  {
    name: 'default (W_syn=1.0, I_drive=0.5): wave activity',
    params: { W_syn: 1.0, I_drive: 0.5, size: 32, speed: 1 },
    steps: 200,
    expected: 'active',
    threshold: 0.001,
  },
  {
    name: 'silent (I_drive=0, no coupling overdrive): network rests',
    params: { W_syn: 0.4, I_drive: 0, size: 32, speed: 1 },
    steps: 200,
    expected: 'silent',
    threshold: 0.005,
  },
];

let failed = 0;
console.log(`lif (Lapicque 1907) tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'active' ? final > tc.threshold : final < tc.threshold;
  if (pass) {
    console.log(`✓ (firing rate=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (firing rate=${final.toFixed(4)}, expected ${tc.expected})`);
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
