// Hopfield (PNAS 79, 2554, 1982): a content-addressable memory built from
// a recurrent network with Hebbian-learned symmetric weights.
//
// Each of the K stored patterns ξ_p ∈ {-1, +1}^N becomes a fixed point of
// the synchronous dynamics X[t+1, i] = sign(Σ_j W[i, j] · X[t, j]) when the
// weight matrix is set to the Hebbian rule
//
//     W[i, j] = (1 / N) Σ_p ξ_p[i] · ξ_p[j]   (with W[i, i] = 0)
//
// Starting from a noisy / partial cue, the dynamics flow downhill in the
// associated energy landscape and converge to the nearest stored pattern.
// This is the simplest concrete realisation of the "fast weight programmer"
// substrate idea — patterns live in W, retrieval is a sparse matvec on X.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

const PATTERN_NAMES = ['X', 'O', '+', '◻'] as const;
type PatternName = (typeof PATTERN_NAMES)[number];

interface HopfieldState extends ModelState {
  W: Float64Array;        // length N*N, row-major, dense
  patterns: Float64Array[];
  targetPattern: number;  // index into patterns[] — what we expect to recall
  mode: 'geometric' | 'random';
  alpha: number;          // P / N — load ratio (only meaningful for random mode)
}

// ---------- pattern bitmaps ----------
function patternX(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const t = Math.max(1, (size / 16) | 0);
  for (let i = 0; i < size; i++) {
    for (let dt = -t; dt <= t; dt++) {
      const j1 = i + dt;
      const j2 = size - 1 - i + dt;
      if (j1 >= 0 && j1 < size) X[i * size + j1] = 1;
      if (j2 >= 0 && j2 < size) X[i * size + j2] = 1;
    }
  }
  return X;
}

function patternO(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size / 3;
  const t = Math.max(1.2, size / 16);
  for (let r0 = 0; r0 < size; r0++) {
    for (let c0 = 0; c0 < size; c0++) {
      const dx = c0 - cx;
      const dy = r0 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - r) < t) X[r0 * size + c0] = 1;
    }
  }
  return X;
}

function patternPlus(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const t = Math.max(1, (size / 8) | 0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (Math.abs(c - cx) < t || Math.abs(r - cy) < t) {
        X[r * size + c] = 1;
      }
    }
  }
  return X;
}

function patternSquare(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const m = Math.max(2, (size / 8) | 0);
  const t = Math.max(1, (size / 16) | 0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const onTop = r >= m && r < m + t;
      const onBot = r >= size - m - t && r < size - m;
      const onLft = c >= m && c < m + t;
      const onRgt = c >= size - m - t && c < size - m;
      const inH = c >= m && c < size - m && (onTop || onBot);
      const inV = r >= m && r < size - m && (onLft || onRgt);
      if (inH || inV) X[r * size + c] = 1;
    }
  }
  return X;
}

// ---------- Hebbian training ----------
function hebbianTrain(patterns: Float64Array[], N: number): Float64Array {
  const W = new Float64Array(N * N);
  for (const p of patterns) {
    for (let i = 0; i < N; i++) {
      const pi = p[i]!;
      const off = i * N;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        W[off + j] += pi * p[j]!;
      }
    }
  }
  const inv = 1 / N;
  for (let i = 0; i < N * N; i++) W[i] *= inv;
  return W;
}

// Empty graph (no edges). The W matrix lives separately in state.W; the
// `graph` field is only here to satisfy the substrate interface.
function emptyGraph(N: number): Graph {
  return {
    N,
    adj: Array.from({ length: N }, () => []),
    edges: [],
    deg: new Int32Array(N),
  };
}

// Random ±1 pattern of length N. Uncorrelated patterns are what
// Amit-Gutfreund-Sompolinsky's α_c = 0.138 capacity theorem assumes.
function randomPattern(N: number, rng: RNG): Float64Array {
  const X = new Float64Array(N);
  for (let i = 0; i < N; i++) X[i] = rng.next() < 0.5 ? 1 : -1;
  return X;
}

const PATTERN_BUILDERS: Record<PatternName, (size: number) => Float64Array> = {
  'X': patternX,
  'O': patternO,
  '+': patternPlus,
  '◻': patternSquare,
};

// ---------- the model ----------
const hopfield: Model<HopfieldState> = {
  id: 'hopfield',
  name: 'Hopfield Retrieval',
  short: 'Patterns encoded in dense edge weights via Hebbian learning. A noisy initial state converges to the nearest stored memory.',
  long: `A Hopfield network stores K patterns ξ_p ∈ {-1, +1}^N as fixed points of its dynamics by setting the symmetric weight matrix to the Hebbian rule:

W[i, j] = (1 / N) Σ_p ξ_p[i] · ξ_p[j]    (W[i, i] = 0)

The async update is X[i] ← sign(Σ_j W[i, j] · X[j]) — each node's new value is the sign of a weighted vote of all others. Starting from a corrupted cue, the energy landscape funnels the state into the nearest stored pattern.

**Two modes:**

— **Geometric** (default): stores the four 32×32 patterns X, O, +, ◻. Pick which to recall with the *pattern* dropdown, set the noise level, watch convergence in a few seconds.

— **Random**: stores P uncorrelated random ±1 patterns (P set by the *num_patterns* slider). This is the setup analysed by Amit, Gutfreund & Sompolinsky (1985–87) and exhibits a true second-order **phase transition** at the critical load α = P / N ≈ **0.138**:

  α < 0.138  →  stored patterns are stable attractors, recall works
  α ≈ 0.138  →  critical fluctuations — recall succeeds for some seeds, fails for others
  α > 0.138  →  spin-glass phase — exponentially many spurious attractors, no useful recall

The σ time-series shows overlap with the target pattern. Below α_c at noise=0 it stays at 1. Above α_c it falls toward 0 even from the exact pattern — capacity has collapsed and the pattern is no longer a fixed point. Same kind of object as the Ising T_c critical point: a phase boundary you walk by dragging a slider.

This is also the simplest concrete instance of the "fast-weight programmer" substrate framing: patterns are written into W, retrieval is a single sparse matvec on X. Modern Hopfield Networks (Ramsauer et al. 2020, arXiv:2008.02217) replace the quadratic energy with a log-sum-exp form, raising α_c from 0.138 to **exponential in N** — and that variant is mathematically equivalent to Transformer attention.

References: Hopfield, *PNAS* 79, 2554 (1982). Capacity theorem: Amit, Gutfreund & Sompolinsky (1985–87) via spin-glass replica method.`,

  view: 'grid',

  params: {
    mode:         { label: 'pattern mode',  options: ['geometric', 'random'] as const, default: 'geometric', live: false },
    pattern:      { label: 'recall pattern (geometric mode)', options: PATTERN_NAMES, default: 'X', live: false },
    num_patterns: { label: 'P (num random patterns)',         min: 2,  max: 300, step: 1,    default: 50,   live: false },
    noise:        { label: 'noise level',                     min: 0,  max: 1,   step: 0.01, default: 0.30, live: false },
    size:         { label: 'grid size (N = size²)',           min: 16, max: 48,  step: 8,    default: 32,   live: false },
    speed:        { label: 'speed',                           min: 0.1, max: 5,  step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    // ---- geometric mode: clean recall demos with the 4 hand-drawn patterns ----
    {
      id: 'clean',
      name: 'clean recall (geometric)',
      short: 'noise=0.3 from X. Initial state is most-X-with-some-flips; dynamics fix the wrong pixels in a few seconds. The standard "associative memory" demo.',
      params: { mode: 'geometric', pattern: 'X', noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'basin-boundary',
      name: 'basin boundary (noise = 0.5)',
      short: 'noise=0.5 — initial state has ~zero overlap with the chosen pattern (essentially random). Outcome depends on which of the 8 real attractors and ~16 spurious ones the random seed happens to be closest to.',
      params: { mode: 'geometric', pattern: 'X', noise: 0.5, size: 32 },
      seed: 1,
    },
    {
      id: 'spurious-mixture',
      name: 'spurious mixed state (3-pattern)',
      short: 'A specific seed and grid size that lands in a 3-pattern spurious attractor: looks like X, O, +, ◻ all faintly superimposed. Not any single stored memory — Hopfield\'s classical failure mode.',
      params: { mode: 'geometric', pattern: 'O', noise: 0.5, size: 48 },
      seed: 499708377,
    },
    {
      id: 'inverse',
      name: 'inverse recall (high noise)',
      short: 'noise=0.9 — most pixels are flipped from the cue. Converges to the *inverse* of the chosen pattern (Hopfield energy is symmetric under X → -X, so every stored pattern\'s negative is equally stable).',
      params: { mode: 'geometric', pattern: 'X', noise: 0.9, size: 32 },
      seed: 1,
    },

    // ---- random mode: capacity / α_c phase transition (AGS 1985-87) ----
    // For size=32 (N=1024), the critical load α_c ≈ 0.138 corresponds to P ≈ 141.
    {
      id: 'safe-load',
      name: 'safe load (α ≈ 0.05)',
      short: 'P=50 random patterns, N=1024, so α=P/N=0.049 — well below α_c=0.138. Stored patterns are clean attractors. With noise=0 the recall is perfect; with noise=0.2 you see fast clean convergence. Random binary patterns instead of the geometric set.',
      params: { mode: 'random', num_patterns: 50, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'critical-load',
      name: 'critical load (α ≈ α_c = 0.138)',
      short: 'P=141, α=0.138 — Amit-Gutfreund-Sompolinsky\'s critical load. The capacity phase transition. With noise=0, recall sometimes succeeds and sometimes fails depending on the seed — we\'re sitting on the boundary between memory and spin-glass phases. Same kind of phase boundary as Ising T_c.',
      params: { mode: 'random', num_patterns: 141, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'spin-glass',
      name: 'spin-glass phase (α = 0.20, capacity collapsed)',
      short: 'P=205, α=0.20 — well above α_c. Stored patterns are no longer fixed points. Even from noise=0 the dynamics flow away from the target and settle into a spurious attractor. The σ time-series collapses — capacity has broken. Demonstrates the AGS prediction visually.',
      params: { mode: 'random', num_patterns: 205, noise: 0.0, size: 32 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): HopfieldState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const noise = params.noise as number;
    const mode = (params.mode as 'geometric' | 'random') ?? 'geometric';

    let patterns: Float64Array[];
    let targetIdx: number;

    if (mode === 'random') {
      // P uncorrelated random binary patterns — the AGS setup.
      const P = Math.max(1, Math.round(params.num_patterns as number));
      patterns = [];
      for (let p = 0; p < P; p++) patterns.push(randomPattern(N, rng));
      targetIdx = 0; // recall the first stored pattern
    } else {
      // Geometric mode: the 4 hand-drawn patterns.
      patterns = (PATTERN_NAMES as readonly PatternName[]).map((n) =>
        PATTERN_BUILDERS[n](size),
      );
      const targetName = params.pattern as PatternName;
      targetIdx = (PATTERN_NAMES as readonly string[]).indexOf(targetName);
      if (targetIdx < 0) targetIdx = 0;
    }

    const W = hebbianTrain(patterns, N);

    // initial state: target pattern with `noise` fraction of pixels flipped
    const X = new Float64Array(N);
    const target = patterns[targetIdx]!;
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
      W,
      patterns,
      targetPattern: targetIdx,
      mode,
      alpha: patterns.length / N,
    };
  },

  step(state: HopfieldState, params: ParamValues, rng: RNG): void {
    const { N, X, W } = state;
    // Asynchronous update — Hopfield's original 1982 formulation: pick a
    // random node, set X[i] = sign(Σ_j W[i,j] · X[j]), repeat. Visually
    // satisfying (cells flip one at a time as the static-y noise resolves
    // into the stored pattern) and avoids the spurious 2-cycles that
    // synchronous updates can fall into.
    //
    // Rate is tuned so a 32×32 grid (N=1024) takes a few seconds to
    // converge at speed=1× — about half the grid swept per visible second.
    const speed = params.speed as number;
    const updatesPerFrame = Math.max(1, ((N / 64) * speed) | 0);
    for (let s = 0; s < updatesPerFrame; s++) {
      const i = rng.int(N);
      let sum = 0;
      const off = i * N;
      for (let j = 0; j < N; j++) sum += W[off + j]! * X[j]!;
      X[i] = sum >= 0 ? 1 : -1;
    }
    state.step_count += updatesPerFrame;
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: HopfieldState, i: number): string {
      return state.X[i]! > 0 ? '#e8edf4' : '#1a1f2a';
    },
    nodeSize(): number {
      return 1;
    },
  },

  observe: {
    histogram: {
      label: 'state distribution',
      range: [-1, 1],
      bins: 2,
      values(state: HopfieldState): Float64Array {
        return state.X;
      },
    },
    timeSeries: {
      label: 'overlap with target pattern',
      value(state: HopfieldState): number {
        const N = state.N;
        const target = state.patterns[state.targetPattern]!;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i]! * target[i]!;
        return s / N;
      },
    },
  },
};

export default hopfield;
