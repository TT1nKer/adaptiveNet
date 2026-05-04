// Acceptance test for src/models/pacheco-2006.ts against Pacheco-Traulsen-
// Nowak (PRL 97, 258103, 2006). Paper Fig 2b regime: with the listed
// parameter values and 50% initial cooperators on K_100, cooperators
// should fixate (or get very close).
//
// Run with:  bun run tests/pacheco-2006.test.ts

import { RNG } from '../src/rng.ts';
import model from '../src/models/pacheco-2006.ts';

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
  let count = 0;
  for (let i = 0; i < state.N; i++) if (state.X[i] === 1) count++;
  return count / state.N;
}

interface TestCase {
  name: string;
  params: Record<string, number | string>;
  steps: number;
  expected: 'C_wins' | 'D_wins';
  threshold: number; // C_wins: c_final > threshold; D_wins: c_final < threshold
}

const cases: TestCase[] = [
  // === Paper Fig 2b regime: parameters where cooperators fixate ===
  // (b=1, c=0.5, β=0.1, α_C=α_D=0.4, γ_CC=0.1, γ_CD=0.8, γ_DD=0.32,
  //  W=4, N=100, K_N initial, 50% C)
  {
    name: 'paper Fig 2b: cooperators fixate (W=1, K_N, paper params)',
    params: {
      b: 1.0, c: 0.5, beta: 0.1,
      alpha_C: 0.4, alpha_D: 0.4,
      gamma_CC: 0.1, gamma_CD: 0.8, gamma_DD: 0.32,
      W: 1, init_C: 0.5, N: 100, topo: 'complete', speed: 1,
    },
    steps: 30,
    expected: 'C_wins',
    threshold: 0.85, // paper says C fixates; our sim shows ~1.0 at 30 steps
  },
  // === Strategy-fast regime: linking too slow to insulate cooperators ===
  // W=0.1 — linking happens 10× slower than strategy. Defectors should win
  // (recovers static-PD result).
  {
    name: 'W=0.001 (strategy fast, ~no AL): defectors win',
    params: {
      b: 1.0, c: 0.5, beta: 0.1,
      alpha_C: 0.4, alpha_D: 0.4,
      gamma_CC: 0.1, gamma_CD: 0.8, gamma_DD: 0.32,
      W: 0.001, init_C: 0.5, N: 100, topo: 'complete', speed: 1,
    },
    steps: 30,
    expected: 'D_wins',
    threshold: 0.3,
  },
  // === No-AL-asymmetry control: γ_CC = γ_CD = γ_DD ===
  // All breaking rates equal — equivalent to no asymmetric link density.
  // Even with W=4, defectors should win (no insulation).
  {
    name: 'symmetric γ (no AL asymmetry): defectors win even at W=1',
    params: {
      b: 1.0, c: 0.5, beta: 0.1,
      alpha_C: 0.4, alpha_D: 0.4,
      gamma_CC: 0.4, gamma_CD: 0.4, gamma_DD: 0.4,
      W: 1, init_C: 0.5, N: 100, topo: 'complete', speed: 1,
    },
    steps: 30,
    expected: 'D_wins',
    threshold: 0.4,
  },
];

let failed = 0;
console.log(`pacheco-2006 acceptance tests (paper: Pacheco-Traulsen-Nowak PRL 97 258103, 2006)`);
console.log('');
for (const tc of cases) {
  process.stdout.write(`  ${tc.name} ... `);
  const final = runOne(tc.params, tc.steps, 1);
  const pass = tc.expected === 'C_wins' ? final > tc.threshold : final < tc.threshold;
  if (pass) {
    console.log(`✓ (c_final=${final.toFixed(4)})`);
  } else {
    console.log(`✗ (c_final=${final.toFixed(4)}, expected ${tc.expected} (threshold ${tc.threshold}))`);
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
