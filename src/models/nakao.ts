// Nakao & Mikhailov (Nature Physics 6, 544–550, 2010): Turing patterns on networks.
// Per-node Mimura–Murray activator–inhibitor reaction; diffusion through the graph
// Laplacian. With D_v ≫ D_u the homogeneous fixed point is unstable and the network
// spontaneously splits into high-u / low-u clusters.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

const nakao: Model = {
  id: 'nakao-2010',
  name: 'Network Turing Patterns',
  short: 'Reaction–diffusion on a graph; D_v ≫ D_u creates spontaneous high/low clusters.',
  long: `On each node, a Mimura–Murray activator–inhibitor reaction. Diffusion happens through the graph Laplacian — each node's concentration moves toward its neighbors'. When the inhibitor diffuses much faster than the activator (D_v ≫ D_u), the homogeneous state is unstable and the network spontaneously splits into high-u / low-u clusters.

Switch the topology to Barabási–Albert and the high-degree hubs act as pattern organizers.

Reference: Nakao & Mikhailov, *Nature Physics* 6, 544–550 (2010).`,

  params: {
    Du:   { label: 'D_u (activator)', min: 0,  max: 1,    step: 0.001, default: 0.05, live: true },
    Dv:   { label: 'D_v (inhibitor)', min: 0,  max: 10,   step: 0.01,  default: 3.00, live: true },
    N:    { label: 'nodes',           min: 50, max: 1000, step: 10,    default: 200,  live: false },
    k:    { label: 'avg degree',      min: 2,  max: 14,   step: 1,     default: 6,    live: false },
    topo: { label: 'topology',        options: TOPO_OPTS, default: 'ba',              live: false },
  },

  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const generator = generators[topo];
    if (!generator) throw new Error(`unknown topology: ${topo}`);
    const graph = generator(N, k, rng);

    // Mimura–Murray fixed point at (5, 10) for (a, b, c, d) = (35, 16, 9, 0.4).
    const X = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      X[i * 2] = 5 + rng.uniform(-0.05, 0.05);
      X[i * 2 + 1] = 10 + rng.uniform(-0.05, 0.05);
    }
    return { N, d: 2, X, graph, t: 0, step_count: 0 };
  },

  step(state: ModelState, params: ParamValues): void {
    const { N, X, graph } = state;
    const adj = graph.adj;
    const Du = params.Du as number;
    const Dv = params.Dv as number;

    const A = 35;
    const B = 16;
    const C = 9;
    const D = 0.4;
    const DT = 0.002;
    const SUB = 25;

    const du = new Float64Array(N);
    const dv = new Float64Array(N);
    for (let s = 0; s < SUB; s++) {
      for (let i = 0; i < N; i++) {
        const u = X[i * 2]!;
        const v = X[i * 2 + 1]!;
        const fr = ((A + B * u - u * u) / C - v) * u;
        const gr = (u - 1 - D * v) * v;

        let su = 0;
        let sv = 0;
        const ai = adj[i]!;
        for (let p = 0; p < ai.length; p++) {
          const j = ai[p]!;
          su += X[j * 2]! - u;
          sv += X[j * 2 + 1]! - v;
        }
        du[i] = fr + Du * su;
        dv[i] = gr + Dv * sv;
      }
      for (let i = 0; i < N; i++) {
        X[i * 2] = X[i * 2]! + DT * du[i]!;
        X[i * 2 + 1] = X[i * 2 + 1]! + DT * dv[i]!;
      }
      state.t += DT;
      state.step_count++;
    }
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      const u = state.X[i * 2]!;
      let t = (u - 5) / 4.5;
      if (t < -1) t = -1;
      else if (t > 1) t = 1;
      const a = (t + 1) / 2;
      const r = Math.round(44 + (230 - 44) * a);
      const g = Math.round(95 + (57 - 95) * a);
      const b = Math.round(191 + (70 - 191) * a);
      return `rgb(${r},${g},${b})`;
    },
    nodeSize(state: ModelState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  observe: {
    histogram: {
      label: 'u distribution',
      range: [0, 12],
      bins: 30,
      values(state: ModelState): Float64Array {
        const N = state.N;
        const out = new Float64Array(N);
        for (let i = 0; i < N; i++) out[i] = state.X[i * 2]!;
        return out;
      },
    },
    timeSeries: {
      label: 'σ(u) over time',
      value(state: ModelState): number {
        const N = state.N;
        let s1 = 0;
        let s2 = 0;
        for (let i = 0; i < N; i++) {
          const u = state.X[i * 2]!;
          s1 += u;
          s2 += u * u;
        }
        const m = s1 / N;
        return Math.sqrt(Math.max(0, s2 / N - m * m));
      },
    },
  },
};

export default nakao;
