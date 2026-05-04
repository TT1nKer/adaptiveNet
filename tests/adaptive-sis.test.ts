// Acceptance test for src/models/adaptive-sis.ts against Gross-D'Lima-Blasius
// (PRL 96, 208701, 2006). Runs the model in two parameter regimes and checks
// the stationary infected fraction matches the paper's analytical predictions:
//
//   1. WITHOUT REWIRING (w=0):
//      - Below threshold (p < r/⟨k⟩): infection dies out, i_∞ ≈ 0
//      - Above threshold (p > r/⟨k⟩): endemic, i_∞ > 0
//
//   2. WITH REWIRING (w=0.3) — paper Eq. 1:
//      Threshold shifts UP to p* = w / [⟨k⟩ (1 − exp(−w/r))], so at p just
//      above r/⟨k⟩ but below the rewiring-shifted threshold, infection should
//      die out where it would have persisted on a static graph.
//
// Run with:  bun run tests/adaptive-sis.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/adaptive-sis.ts';

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expectedFinal: 'die_out' | 'endemic';
  threshold?: number; // for 'die_out': i_final must be < threshold; for 'endemic': i_final must be > threshold
}

function runOne(params: Record<string, number | string>, steps: number, seed: number): number {
  const rng = new RNG(seed);
  const fullParams: Record<string, number | string> = {};
  // Fill missing params from defaults
  for (const [k, spec] of Object.entries(model.params)) {
    fullParams[k] = (k in params) ? params[k]! : (spec as { default: number | string }).default;
  }
  const state = model.init(fullParams as any, rng);
  for (let s = 0; s < steps; s++) {
    model.step(state, fullParams as any, rng);
  }
  // measure: fraction infected
  let count = 0;
  for (let i = 0; i < state.N; i++) if (state.X[i] === 1) count++;
  return count / state.N;
}

const cases: TestCase[] = [
  // === Regime 1: w=0, p well below r/⟨k⟩ → die out ===
  // r=0.05, ⟨k⟩=6 → r/⟨k⟩ ≈ 0.0083. Use p=0.003 (3.6× below threshold).
  // After 200 steps, infection should be essentially gone (< 0.02 fraction).
  {
    name: 'w=0, p=0.003 (below threshold p* ≈ 0.0083) → dies out',
    params: { w: 0, p: 0.003, r: 0.05, init_inf: 0.10, N: 300, k: 6, topo: 'er', speed: 1 },
    steps: 200,
    expectedFinal: 'die_out',
    threshold: 0.02,
  },
  // === Regime 2: w=0, p well above r/⟨k⟩ → endemic ===
  // r=0.05, ⟨k⟩=6, p=0.05 (6× above threshold). Endemic state: i_∞ > 0.10.
  {
    name: 'w=0, p=0.05 (above threshold p* ≈ 0.0083) → endemic',
    params: { w: 0, p: 0.05, r: 0.05, init_inf: 0.10, N: 300, k: 6, topo: 'er', speed: 1 },
    steps: 200,
    expectedFinal: 'endemic',
    threshold: 0.10,
  },
  // === Regime 3: w=0.3, paper Eq. 1 threshold p* = 0.3/(6·(1-exp(-6))) ≈ 0.050 ===
  // p=0.030 is below the shifted threshold but above r/⟨k⟩ (0.0083).
  // On a STATIC graph, p=0.030 would be endemic. With rewiring, should die.
  {
    name: 'w=0.3, p=0.030 (below paper Eq. 1 threshold p* ≈ 0.050) → dies out',
    params: { w: 0.3, p: 0.030, r: 0.05, init_inf: 0.10, N: 300, k: 6, topo: 'er', speed: 1 },
    steps: 300,
    expectedFinal: 'die_out',
    threshold: 0.05,
  },
];

let failed = 0;
console.log(`adaptive-sis acceptance tests (paper: Gross-D'Lima-Blasius PRL 96 208701, 2006)`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const t = tc.threshold ?? 0.05;
  const pass = tc.expectedFinal === 'die_out'
    ? final < t
    : final > t;
  if (pass) {
    console.log(`✓ (i_final=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (i_final=${final.toFixed(4)}, expected ${tc.expectedFinal} (threshold ${t}))`);
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
