// Modern Hopfield Network (Ramsauer et al., 2020).
//
// Same substrate as the classical Hopfield demo — N binary nodes, P stored
// patterns trained Hebbian-style — but with a different energy function:
//
//   E_modern(X) = -1/β · log Σ_p exp(β · ξ_p · X)
//
// Equivalently, the retrieval rule is
//
//   X_new = sign( Σ_p softmax(β · ξ_p · X) · ξ_p )
//
// — compute overlap with each stored pattern, softmax with inverse
// temperature β, then sum the patterns weighted by softmax. The new state
// is the sign of that weighted sum.
//
// Two consequences:
//
// 1. Storage capacity jumps from α_c ≈ 0.138·N (classical, see the
//    Hopfield Capacity demo) to **exponential in N**. At sufficiently high
//    β the softmax sharpens to nearly one-hot, so retrieval picks the
//    single nearest pattern — and that works for exponentially many
//    patterns as long as none lie pathologically close.
//
// 2. The retrieval rule IS Transformer attention. Identify Ξ (matrix of
//    stored patterns) with the keys/values, X with the query, β with
//    1/√d_k. One step of Modern Hopfield = one attention layer.
//
// This is the math underneath why Transformer attention has the recall
// power that classical neural nets can't reach.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

interface ModernState extends ModelState {
  patterns: Float64Array[];   // P stored patterns, length N each
  targetPattern: number;      // always 0 — we recall pattern[0]
  alpha: number;              // P / N
}

function emptyGraph(N: number): Graph {
  return {
    N,
    adj: Array.from({ length: N }, () => []),
    edges: [],
    deg: new Int32Array(N),
  };
}

function randomPattern(N: number, rng: RNG): Float64Array {
  const X = new Float64Array(N);
  for (let i = 0; i < N; i++) X[i] = rng.next() < 0.5 ? 1 : -1;
  return X;
}

const modernHopfield: Model<ModernState> = {
  id: 'hopfield-modern',
  name: 'Modern Hopfield (Attention-Equivalent)',
  short: 'Replace classical Hopfield\'s quadratic energy with log-sum-exp. Capacity jumps from 0.138·N to exponential, and the retrieval rule becomes Transformer attention.',
  long: `**Classical Hopfield** (the recall and capacity demos) stores patterns by Hebbian outer products and retrieves by sign(W·X). Capacity tops out at α_c ≈ 0.138·N — try to store more, the spin-glass phase wipes the memory.

**Modern Hopfield** (Ramsauer et al. 2020) keeps the same substrate but uses

E(X) = −1/β · log Σ_p exp(β · ξ_p · X)

which gives the retrieval rule

X_new = sign( Σ_p softmax(β · ξ_p · X) · ξ_p )

In words: compute overlap with each stored pattern; apply softmax with inverse temperature β; weight each pattern by its softmax value; sum; take signs. Two things follow.

**(1) Capacity is exponential in N.** When β is large, softmax sharpens to nearly one-hot — retrieval picks the *single nearest* pattern. That works for exponentially many patterns as long as none cluster pathologically close. The classical α_c = 0.138 limit dissolves.

**(2) This is Transformer attention.** Identify

  Ξ (stored patterns matrix) ↔ keys / values
  X (current state)           ↔ query
  β                            ↔ 1/√d_k

One step of Modern Hopfield = one attention layer. The strong recall capacity of attention IS the strong storage capacity of this Hopfield variant.

**Try the presets** to walk through the regime classical Hopfield can't reach. P=200 is past the classical α_c=0.138 — the classical capacity demo collapses there; the modern version still recalls cleanly. P=1000 with N=1024 is α≈1.0, ten times past classical's limit, and it still works.

**Lowering β** softens the softmax — retrieval becomes a weighted *mixture* of patterns rather than the closest one. This is what attention with low temperature does, and it's how classical Hopfield's spurious mixed states show up here in a controllable way.

Reference: Ramsauer et al., *Hopfield Networks Is All You Need*, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217) (2020).`,

  view: 'grid',

  params: {
    num_patterns: { label: 'P (num patterns)',  min: 2,   max: 1000, step: 1,    default: 200,  live: false },
    beta:         { label: 'β (sharpness)',     min: 0.1, max: 50,   step: 0.1,  default: 10.0, live: true },
    noise:        { label: 'cue noise',         min: 0,   max: 1,    step: 0.01, default: 0.30, live: false },
    size:         { label: 'grid size',         min: 16,  max: 48,   step: 8,    default: 32,   live: false },
    speed:        { label: 'speed',             min: 0.1, max: 5,    step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'classical-equivalent',
      name: 'classical-equivalent (α=0.05)',
      short: 'P=50 patterns, α=0.049. Classical handles this; modern handles this trivially with high β. Baseline comparison.',
      params: { num_patterns: 50, beta: 10, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'past-classical-limit',
      name: 'past classical α_c (α=0.20)',
      short: 'P=200, α=0.196 — classical Hopfield collapses here (see hopfield-capacity spin-glass preset). Modern recalls perfectly with β=10. Side-by-side comparison: open the classical capacity demo with the same P.',
      params: { num_patterns: 200, beta: 10, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'massive-capacity',
      name: 'massive capacity (α=1.0)',
      short: 'P=1024 patterns in N=1024 cells, α≈1.0. Ten times past classical α_c. Modern Hopfield with β=20 still recalls. The capacity that makes Transformer attention practical.',
      params: { num_patterns: 1024, beta: 20, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'low-temperature',
      name: 'low temperature β=1 (mixture states)',
      short: 'Low β → soft softmax → multiple patterns blend in the retrieval. Output is a mixture (weighted average of nearby patterns). This is what attention with low temperature does. Recall becomes "average of nearby memories" rather than "the nearest one".',
      params: { num_patterns: 100, beta: 1.0, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'high-temperature',
      name: 'high temperature β=30 (sharp recall)',
      short: 'Very high β → softmax is essentially one-hot → exact retrieval of the single nearest pattern. The infinite-capacity limit in spirit; the system always nails the closest pattern even with many stored.',
      params: { num_patterns: 500, beta: 30, noise: 0.3, size: 32 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): ModernState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const P = Math.max(1, Math.round(params.num_patterns as number));
    const noise = params.noise as number;

    const patterns: Float64Array[] = [];
    for (let p = 0; p < P; p++) patterns.push(randomPattern(N, rng));

    const target = patterns[0]!;
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      X[i] = rng.next() < noise ? -target[i]! : target[i]!;
    }

    return {
      N,
      d: 1,
      X,
      graph: emptyGraph(N),
      t: 0,
      step_count: 0,
      cols: size,
      rows: size,
      patterns,
      targetPattern: 0,
      alpha: P / N,
    };
  },

  step(state: ModernState, params: ParamValues, rng: RNG): void {
    const { N, X, patterns } = state;
    const P = patterns.length;
    const beta = params.beta as number;
    const speed = params.speed as number;

    const aux = state as ModernState & {
      _overlaps?: Float64Array;
      _Xtarget?: Float64Array;
    };
    if (!aux._overlaps || aux._overlaps.length !== P) aux._overlaps = new Float64Array(P);
    if (!aux._Xtarget || aux._Xtarget.length !== N) aux._Xtarget = new Float64Array(N);
    const overlaps = aux._overlaps;
    const X_target = aux._Xtarget;

    // Step 1: compute overlap with each pattern  a_p = (1/N) Σ_i ξ_p[i] · X[i]
    for (let p = 0; p < P; p++) {
      let s = 0;
      const pat = patterns[p]!;
      for (let i = 0; i < N; i++) s += pat[i]! * X[i]!;
      overlaps[p] = s / N;
    }

    // Step 2: softmax — w_p = exp(β·a_p) / Σ_q exp(β·a_q), with max-shift
    let maxA = -Infinity;
    for (let p = 0; p < P; p++) if (overlaps[p]! > maxA) maxA = overlaps[p]!;
    let sum = 0;
    for (let p = 0; p < P; p++) {
      const e = Math.exp(beta * (overlaps[p]! - maxA));
      overlaps[p] = e;
      sum += e;
    }
    const invSum = 1 / sum;
    for (let p = 0; p < P; p++) overlaps[p] = overlaps[p]! * invSum;

    // Step 3: X_target[i] = sign( Σ_p w_p · ξ_p[i] )
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let p = 0; p < P; p++) s += overlaps[p]! * patterns[p]![i]!;
      X_target[i] = s >= 0 ? 1 : -1;
    }

    // Step 4: gradually move X toward X_target via async cell updates,
    // so the user can see the convergence animate (instead of one frame).
    const updatesPerFrame = Math.max(1, ((N / 32) * speed) | 0);
    for (let s = 0; s < updatesPerFrame; s++) {
      const i = rng.int(N);
      X[i] = X_target[i]!;
    }

    state.step_count++;
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModernState, i: number): string {
      return state.X[i]! > 0 ? '#e8edf4' : '#1a1f2a';
    },
    nodeSize(): number {
      return 1;
    },
  },

  observe: {
    histogram: {
      label: 'spin distribution',
      range: [-1, 1],
      bins: 2,
      values(state: ModernState): Float64Array {
        return state.X;
      },
    },
    timeSeries: {
      label: 'σ = overlap with target pattern',
      value(state: ModernState): number {
        const N = state.N;
        const target = state.patterns[state.targetPattern]!;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i]! * target[i]!;
        return s / N;
      },
    },
  },
};

export default modernHopfield;
