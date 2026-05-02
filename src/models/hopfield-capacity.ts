// Hopfield network capacity / α_c phase transition.
//
// Stores P uncorrelated random binary patterns in a Hopfield network of N
// neurons. The Hebbian rule is the same as the geometric Hopfield demo,
// but with random patterns instead of hand-drawn shapes — this is the
// canonical setup analysed by Amit, Gutfreund & Sompolinsky (1985-87)
// using the spin-glass replica method.
//
// The result is a true second-order phase transition at the critical load
//
//   α_c ≡ P / N  ≈  0.138
//
// This demo stages the transition: pick a load α via the num_patterns
// slider, start the system at the exact stored target pattern (noise=0),
// and watch the σ time-series. Below α_c it stays at 1 forever — the
// pattern is a fixed point. Above α_c it collapses toward 0 — the
// pattern is no longer a fixed point and the dynamics flow into a
// spin-glass spurious attractor. The phase boundary at α_c ≈ 0.138 is
// sharp and lines up with AGS's analytical prediction.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

interface CapacityState extends ModelState {
  W: Float64Array;
  patterns: Float64Array[];
  targetPattern: number;   // always 0 — we recall pattern[0]
  alpha: number;           // P / N
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

const capacity: Model<CapacityState> = {
  id: 'hopfield-capacity',
  name: 'Hopfield Capacity (α_c Phase Transition)',
  short: 'Same machinery as the Hopfield demo but with random uncorrelated patterns. Slide the load P/N across 0.138 and watch capacity collapse — Amit–Gutfreund–Sompolinsky 1985.',
  long: `The Hopfield network's storage capacity is a **true second-order phase transition** with a precise critical load. This demo stages it.

**The setup.** Store P uncorrelated random binary patterns ξ_1, …, ξ_P in a Hopfield network of N neurons via the Hebbian rule W[i, j] = (1/N) Σ_p ξ_p[i] ξ_p[j]. Set the network's state to the first stored pattern (no noise — start *exactly* on the pattern). Run the dynamics. Watch the σ time-series, which tracks overlap with the target pattern.

**Three regimes**, controlled by α = P / N:

| α | regime | what σ does | name |
|---|---|---|---|
| α ≪ 0.138 | memory phase | stays at 1 forever | "safe load" |
| α ≈ 0.138 | critical line | depends on seed | **α_c = AGS critical load** |
| α ≫ 0.138 | spin-glass | collapses to ~0 | capacity gone |

The transition at α_c ≈ 0.138 is **sharp**. It's the same kind of object as the Ising T_c (the Ising demo's other critical line): a phase boundary you walk by dragging a slider. AGS derived 0.138 analytically by mapping the Hopfield network onto a Sherrington–Kirkpatrick spin glass and using the replica method — the Hopfield network's capacity is a corollary of Onsager-style statistical mechanics applied to neural networks.

**Try the three presets** to walk the transition. Below α_c the σ time-series sits at 1 (the stored pattern is a fixed point). At α_c it flutters — the seed determines whether recall holds. Above α_c it falls — even starting *exactly* on a stored pattern, the dynamics flow away to a spurious attractor. Bumping noise up makes everything worse, but the transition shows even at noise=0.

**Connections.**

— **Memory in real brains may operate near a similar critical point.** Cortical neural avalanches (Beggs & Plenz 2003), 1/f spectrum in EEG, power-law dynamics — all consistent with brain operating in a critical regime. Hopfield's α_c is a precise mathematical instance of the broader idea that complex systems do their work near phase boundaries.

— **Modern Hopfield Networks** (Ramsauer et al. 2020, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217)) replace the quadratic energy with a log-sum-exp form. The capacity jumps from 0.138·N to **exponential in N**. That same modified network is mathematically equivalent to **Transformer attention** — the strong recall capacity of attention is the strong storage capacity of a modern Hopfield variant. The classical α_c phase transition we walk here is what attention is *not* limited by.

References: Hopfield, *PNAS* 79, 2554 (1982); Amit, Gutfreund & Sompolinsky, *Phys. Rev. A* 32, 1007 (1985); *Annals of Physics* 173, 30 (1987).`,

  view: 'grid',

  params: {
    num_patterns: { label: 'P (num patterns)',  min: 2,  max: 300, step: 1,    default: 50,   live: false },
    noise:        { label: 'cue noise',         min: 0,  max: 1,   step: 0.01, default: 0.0,  live: false },
    size:         { label: 'grid size (N=size²)', min: 16, max: 48, step: 8,   default: 32,   live: false },
    speed:        { label: 'speed',             min: 0.1, max: 5,  step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'safe',
      name: 'safe load (α ≈ 0.05)',
      short: 'P=50, N=1024, α=0.049 — well below α_c=0.138. Pattern is a stable attractor. Even with noise=0 the σ trace stays pinned at 1: the stored pattern is a fixed point, the dynamics don\'t move it.',
      params: { num_patterns: 50, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'near-critical',
      name: 'near critical (α ≈ 0.13)',
      short: 'P=130, α=0.127 — just below the AGS critical load. Recall still mostly works but the basin is shallow. Reseed a few times to see σ occasionally drop instead of staying at 1 — finite-size critical fluctuations.',
      params: { num_patterns: 130, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'critical',
      name: 'critical line (α ≈ α_c = 0.138)',
      short: 'P=141, α=0.138 — sitting on AGS\'s analytical critical load. Boundary between memory phase and spin-glass phase. Recall succeeds for some seeds, fails for others — the very definition of a phase transition.',
      params: { num_patterns: 141, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'spin-glass',
      name: 'spin-glass phase (α = 0.20)',
      short: 'P=205, α=0.20 — well past α_c. Stored patterns no longer fixed points. From noise=0 the σ trace collapses sharply: dynamics flow *away* from the target into a spurious attractor. The capacity is broken.',
      params: { num_patterns: 205, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'deep-glass',
      name: 'deep spin-glass (α = 0.30)',
      short: 'P=307, α=0.30 — deep in the spin-glass regime. The energy landscape is dominated by spurious attractors with no useful structure. σ collapses immediately.',
      params: { num_patterns: 307, noise: 0.0, size: 32 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): CapacityState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const P = Math.max(1, Math.round(params.num_patterns as number));
    const noise = params.noise as number;

    const patterns: Float64Array[] = [];
    for (let p = 0; p < P; p++) patterns.push(randomPattern(N, rng));

    const W = hebbianTrain(patterns, N);

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
      W,
      patterns,
      targetPattern: 0,
      alpha: P / N,
    };
  },

  step(state: CapacityState, params: ParamValues, rng: RNG): void {
    const { N, X, W } = state;
    const speed = params.speed as number;
    // Asynchronous Hopfield update — same as the geometric demo.
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
    nodeColor(state: CapacityState, i: number): string {
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
      values(state: CapacityState): Float64Array {
        return state.X;
      },
    },
    // Two overlap traces tell different stories:
    //   target:  did we keep / recall the *intended* pattern?
    //   max:     did we recall *any* stored pattern?
    // Below α_c both ≈ 1. Just past α_c, target may drop while max stays high
    // (system fell into a wrong-but-still-stored attractor). Deep in spin
    // glass, both collapse — no stored pattern is a fixed point any more.
    timeSeries: {
      label: 'σ overlap with target',
      value(state: CapacityState): number {
        const N = state.N;
        const target = state.patterns[state.targetPattern]!;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i]! * target[i]!;
        return s / N;
      },
    },
    timeSeries2: {
      label: '|σ| max overlap with any stored',
      value(state: CapacityState): number {
        const N = state.N;
        let best = 0;
        for (let p = 0; p < state.patterns.length; p++) {
          const pat = state.patterns[p]!;
          let s = 0;
          for (let i = 0; i < N; i++) s += state.X[i]! * pat[i]!;
          const m = Math.abs(s) / N;
          if (m > best) best = m;
        }
        return best;
      },
    },
  },
};

export default capacity;
