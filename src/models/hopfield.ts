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

The synchronous update is

X[t+1, i] = sign( Σ_j W[i, j] · X[t, j] )

— for each node, the new value is the sign of a weighted vote of all other nodes. Starting from a corrupted cue, the network's energy landscape funnels the state into the nearest stored pattern.

This demo stores **four 32×32 patterns** (X, O, +, ◻) and lets you pick which one to start from with a chosen fraction of pixels flipped. Hit *reset* and the dynamics typically converge in 2–5 synchronous steps.

The σ time-series shows the **overlap** with the target pattern: ranges from ≈ 0 (random / orthogonal) to 1 (perfect recall). When recall succeeds it climbs sharply to 1; when the cue lands in the wrong basin (try noise > 0.4) it converges to a different stored pattern, or to a spurious mixture state.

This is also the simplest concrete instance of the "fast-weight programmer" substrate framing: patterns are written into W, retrieval is a single sparse matvec on X.

Reference: Hopfield, *PNAS* 79, 2554 (1982).`,

  view: 'grid',

  params: {
    pattern: { label: 'recall pattern', options: PATTERN_NAMES, default: 'X', live: false },
    noise:   { label: 'noise level',   min: 0,  max: 0.5, step: 0.01, default: 0.30, live: false },
    size:    { label: 'grid size',     min: 16, max: 48,  step: 8,    default: 32,   live: false },
  },

  init(params: ParamValues, rng: RNG): HopfieldState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const noise = params.noise as number;
    const targetName = params.pattern as PatternName;

    const patterns = (PATTERN_NAMES as readonly PatternName[]).map((n) =>
      PATTERN_BUILDERS[n](size),
    );
    const targetIdx = (PATTERN_NAMES as readonly string[]).indexOf(targetName);
    if (targetIdx < 0) throw new Error(`unknown pattern: ${targetName}`);

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
    };
  },

  step(state: HopfieldState, _params: ParamValues, rng: RNG): void {
    const { N, X, W } = state;
    // Asynchronous update — Hopfield's original 1982 formulation: pick a
    // random node, set X[i] = sign(Σ_j W[i,j] · X[j]), repeat. Visually
    // satisfying (cells flip one at a time as the static-y noise resolves
    // into the stored pattern) and avoids the spurious 2-cycles that
    // synchronous updates can fall into.
    //
    // Rate is tuned so a 32×32 grid (N=1024) takes a few seconds to
    // converge on screen — about half the grid swept per visible second.
    const updatesPerFrame = Math.max(1, (N / 64) | 0);
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
