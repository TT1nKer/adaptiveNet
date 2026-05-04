// Acceptance test for src/models/voter.ts against Holme-Newman PRE 74 056108
// (2006). Verifies paper's main quantitative claim: continuous phase
// transition at φ_c = 0.458 ± 0.008 for k̄=4, γ=10.
//
//   - Below φ_c: largest connected same-opinion community (S/N) is large.
//   - Above φ_c: S/N → 0 (only small communities of ~γ vertices).
//
// Run with:  bun run tests/voter.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/voter.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'consensus' | 'fragmented';
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
  // Compute largest connected same-opinion component (paper's S)
  const obs = model.observe?.timeSeries;
  if (!obs) throw new Error('missing timeSeries');
  return obs.value(state);
}

const cases: TestCase[] = [
  {
    name: 'φ=0.04 (far below φ_c≈0.458): consensus, S/N large',
    params: { phi: 0.04, gamma: 10, N: 400, k: 4, topo: 'er', speed: 5 },
    steps: 200,
    expected: 'consensus',
    threshold: 0.5, // S/N > 0.5 in consensus regime
  },
  {
    name: 'φ=0.96 (far above φ_c): fragmentation, S/N small',
    params: { phi: 0.96, gamma: 10, N: 400, k: 4, topo: 'er', speed: 5 },
    steps: 200,
    expected: 'fragmented',
    threshold: 0.10, // S/N < 0.10 in fragmentation regime (mean group ≈ γ/N = 10/400 = 0.025)
  },
];

let failed = 0;
console.log(`voter (Holme-Newman PRE 74 056108, 2006) acceptance tests`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'consensus' ? final > tc.threshold : final < tc.threshold;
  if (pass) {
    console.log(`✓ (S/N=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (S/N=${final.toFixed(4)}, expected ${tc.expected} (threshold ${tc.threshold}))`);
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
