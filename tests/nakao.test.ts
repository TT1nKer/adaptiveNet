// Acceptance test for src/models/nakao.ts against Nakao-Mikhailov 2010 Nature
// Physics 6, 544-550 (arXiv:1005.1986). Verifies Turing instability behaviour:
//
//   - Below threshold σ_c ≈ 15.5 (Mimura-Murray): no pattern forms;
//     u-distribution stays near uniform (small σ(u))
//   - Above threshold: pattern forms; u differentiates into high/low groups
//     (large σ(u))
//
// Run with:  bun run tests/nakao.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/nakao.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'uniform' | 'patterned';
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
  // σ = D_v / D_u = 0.5/0.05 = 10  →  below σ_c ≈ 15.5: uniform state stable
  {
    name: 'σ = 10 (below σ_c≈15.5): uniform state stable, σ(u) small',
    params: { Du: 0.05, Dv: 0.5, N: 200, k: 6, topo: 'ba', speed: 1.0 },
    steps: 200,
    expected: 'uniform',
    threshold: 0.5,
  },
  // σ = 60 (well above): strong Turing pattern forms
  {
    name: 'σ = 60 (well above σ_c): pattern forms, σ(u) large',
    params: { Du: 0.05, Dv: 3.0, N: 200, k: 6, topo: 'ba', speed: 1.0 },
    steps: 200,
    expected: 'patterned',
    threshold: 1.0,
  },
];

let failed = 0;
console.log(`nakao (Nakao-Mikhailov Nature Physics 6 544, 2010) acceptance tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'uniform' ? final < tc.threshold : final > tc.threshold;
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
