// Acceptance test for src/models/ising.ts against Onsager 1944.
// Verifies the textbook phase transition behaviour:
//
//   - Below T_c = 2.269 (e.g. T=1.0): system magnetises, |⟨m⟩| → 1
//   - Above T_c (e.g. T=4.0): disordered, |⟨m⟩| → 0
//
// Run with:  bun run tests/ising.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/ising.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'ordered' | 'disordered';
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
  let sum = 0;
  for (let i = 0; i < state.N; i++) sum += state.X[i]!;
  return Math.abs(sum / state.N);
}

const cases: TestCase[] = [
  {
    name: 'T=1.0 (well below T_c=2.269): |⟨m⟩| substantial after coarsening',
    params: { T: 1.0, size: 64, speed: 5 },
    steps: 1000,
    expected: 'ordered',
    threshold: 0.5,  // Coarsening from random init can leave domain walls; full magnetisation requires longer or specific protocol
  },
  {
    name: 'T=4.0 (well above T_c=2.269): |⟨m⟩| close to 0',
    params: { T: 4.0, size: 64, speed: 1 },
    steps: 200,
    expected: 'disordered',
    threshold: 0.15,
  },
];

let failed = 0;
console.log(`ising (Onsager 1944) tests — T_c = 2/ln(1+√2) ≈ 2.269`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'ordered' ? final > tc.threshold : final < tc.threshold;
  if (pass) {
    console.log(`✓ (|⟨m⟩|=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (|⟨m⟩|=${final.toFixed(4)}, expected ${tc.expected} (threshold ${tc.threshold}))`);
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
