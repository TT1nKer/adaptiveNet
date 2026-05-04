// Acceptance test for src/models/brusselator.ts. Verifies Turing instability
// behaviour for the canonical (a, b) = (4.5, 7.5) parameter point:
//
//   - At D_v/D_u = 8 (default): patterns form, σ(u) grows from ~0
//   - At D_v/D_u = 1 (subcritical): well-mixed state stable, σ(u) ~ 0
//
// Run with:  bun run tests/brusselator.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/brusselator.ts';

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
  {
    name: 'a=4.5, b=7.5, D_v/D_u=8 (Turing-unstable): pattern forms',
    params: { a: 4.5, b: 7.5, Du: 0.5, Dv: 4.0, size: 80, speed: 1 },
    steps: 200,
    expected: 'pattern',
    threshold: 0.5,
  },
  {
    name: 'a=4.5, b=7.5, D_v/D_u=1 (subcritical): uniform stable',
    params: { a: 4.5, b: 7.5, Du: 2.0, Dv: 2.0, size: 80, speed: 1 },
    steps: 200,
    expected: 'uniform',
    threshold: 0.3,
  },
];

let failed = 0;
console.log(`brusselator (Turing 1952 / Prigogine-Lefever 1968) tests`);
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
