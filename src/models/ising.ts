// Ising model on a 2D square lattice with periodic boundary conditions.
//
//   E(s) = -J · Σ_{<i,j>}  s_i · s_j     ferromagnetic, nearest-neighbour only
//
// Glauber heat-bath dynamics at temperature T:
//   P(s_i = +1 | rest) = sigmoid(2 β h_i),     β = 1/T,   h_i = Σ_{j~i} s_j
//
// Onsager (1944) showed this 2D model has an exact second-order phase
// transition at T_c = 2 / ln(1 + √2) ≈ 2.269 (in units of J). Below T_c the
// system spontaneously magnetises; above, thermal noise destroys order; at
// T_c there are scale-invariant fractal clusters at every length.
//
// Conceptually: this is the "vanilla" version of the same machinery
// underlying the Hopfield network. There the weights are Hebbian-learned
// and dense; here they are uniform J on nearest neighbours only. So the
// Hopfield demo and this one share the substrate exactly — only the W
// matrix differs.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

function buildGrid(cols: number, rows: number): Graph {
  const N = cols * rows;
  const adj: number[][] = Array.from({ length: N }, () => []);
  const edges: Array<[number, number]> = [];
  const link = (i: number, j: number): void => {
    if (i === j) return;
    if (adj[i]!.includes(j)) return;
    adj[i]!.push(j);
    adj[j]!.push(i);
    edges.push(i < j ? [i, j] : [j, i]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      link(i, r * cols + ((c + 1) % cols));
      link(i, ((r + 1) % rows) * cols + c);
    }
  }
  const deg = new Int32Array(N);
  for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
  return { N, adj, edges, deg };
}

const ising: Model = {
  id: 'ising',
  name: 'Ising Model (2D Lattice)',
  short: 'The classical statistical-mechanics model. Spins align with neighbours under ferromagnetic coupling; phase transition at T_c ≈ 2.269.',
  long: `Each cell of a 2D square lattice carries a spin s ∈ {-1, +1}. Spins prefer to align with their four nearest neighbours: the energy is

E(s) = − Σ_{⟨i, j⟩} s_i · s_j     (sum over edges)

The system runs at temperature **T**: at each step a random cell looks at its four neighbours and is set to ±1 with probabilities given by the local Boltzmann factor. Equivalently, P(s_i = +1) = sigmoid(2 · h_i / T), where h_i is the neighbour sum.

This 2D lattice has a famous **second-order phase transition** at

T_c = 2 / ln(1 + √2) ≈ 2.269

(Onsager, *Phys. Rev.* 65, 117 — 1944, the first exact solution of an interacting many-body model). Below T_c the spins **spontaneously magnetise**: thermal noise can't keep up with the alignment force, and the lattice settles into a single domain (or two, separated by a wall). Above T_c thermal fluctuations win and the system stays disordered.

At **exactly T_c** the system is **scale-invariant**: domain clusters appear at every length scale, the lattice looks like a fractal, and the dynamics are critically slow — the order parameter never settles. The whole modern theory of critical phenomena (renormalisation group, universality classes) was built on top of this single observation.

**Try:**
- T = 1.0 → ordered phase, system magnetises (almost all spins aligned).
- T = 2.27 → critical point. Watch the fractal cluster structure persist forever.
- T = 4.0 → disordered phase, looks like static.
- T = 0.05 → deterministic. Dynamics often freeze in striped configurations rather than the all-aligned ground state — the **Ising coarsening problem**, related to grain growth in metallurgy.

**Connection to Hopfield**: the substrate is the same — binary states on nodes, energy = − Σ W[i,j] s_i s_j, Glauber update. Hopfield is this model with **dense Hebbian-learned W**; classical Ising is the same model with **sparse uniform J**.`,

  view: 'grid',

  params: {
    T:    { label: 'temperature T', min: 0.05, max: 5.0, step: 0.01, default: 2.27, live: true },
    size:  { label: 'grid size',    min: 32,   max: 256, step: 8,    default: 128,  live: false },
    speed: { label: 'speed',        min: 0.1,  max: 5,   step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'ordered',
      name: 'ordered phase (T = 1.0)',
      short: 'Far below T_c. Domains coarsen quickly and the system magnetises into a single colour. Order parameter |⟨s⟩| → 1.',
      params: { T: 1.0, size: 128 },
      seed: 1,
    },
    {
      id: 'critical',
      name: 'critical point (T = T_c ≈ 2.269)',
      short: 'Onsager\'s exact critical temperature. Fractal cluster structure at every length scale, dynamics never settle, magnetisation fluctuates around 0. The classic image of a phase transition.',
      params: { T: 2.269, size: 128 },
      seed: 1,
    },
    {
      id: 'disordered',
      name: 'disordered phase (T = 4.0)',
      short: 'Far above T_c. Thermal noise dominates, no large-scale order. Spins flicker at random.',
      params: { T: 4.0, size: 128 },
      seed: 1,
    },
    {
      id: 'zero-T-coarsening',
      name: 'T → 0 — coarsening problem',
      short: 'Deterministic energy descent (no thermal noise). Domains grow as L(t) ~ √t, but the system typically freezes in a striped configuration rather than reaching the ground state. About 1/3 chance of full alignment from random init.',
      params: { T: 0.05, size: 128 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): ModelState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const graph = buildGrid(size, size);

    // Random ±1 — equivalent to T = ∞ initial condition, lets the system
    // settle to whatever phase the running T dictates.
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < 0.5 ? 1 : -1;

    return { N, d: 1, X, graph, t: 0, step_count: 0, cols: size, rows: size };
  },

  step(state: ModelState, params: ParamValues, rng: RNG): void {
    const { N, X, graph } = state;
    const adj = graph.adj;
    const T = Math.max(0.001, params.T as number);
    const beta = 1 / T;

    // Glauber heat-bath update: directly assign s_i = ±1 from its
    // conditional Boltzmann distribution given the neighbours. ~N/4
    // updates per frame at speed=1× so the lattice is swept ~4 times
    // per second at 60fps — fast enough to see dynamics, slow enough
    // to follow critical fluctuations at T_c.
    const speed = params.speed as number;
    const updatesPerFrame = Math.max(1, ((N / 4) * speed) | 0);
    for (let s = 0; s < updatesPerFrame; s++) {
      const i = rng.int(N);
      const ai = adj[i]!;
      let h = 0;
      for (let p = 0; p < ai.length; p++) h += X[ai[p]!]!;
      // sigmoid(2 β h); Math.exp handles overflow gracefully (gives 0 or +Inf)
      const pPlus = 1 / (1 + Math.exp(-2 * beta * h));
      X[i] = rng.next() < pPlus ? 1 : -1;
    }
    state.step_count += updatesPerFrame;
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
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
      values(state: ModelState): Float64Array {
        return state.X;
      },
    },
    timeSeries: {
      label: '|magnetization| = |⟨s⟩|',
      value(state: ModelState): number {
        let sum = 0;
        for (let i = 0; i < state.N; i++) sum += state.X[i]!;
        return Math.abs(sum / state.N);
      },
    },
  },
};

export default ising;
