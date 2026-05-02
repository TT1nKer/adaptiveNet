// Brusselator on a 2D square lattice — the canonical Turing pattern demo.
//
//   du/dt = D_u ∇²u + a − (b + 1) u + u² v
//   dv/dt = D_v ∇²v + b u − u² v
//
// Homogeneous fixed point: (u*, v*) = (a, b / a).
// Linear stability:
//   trace J = b − 1 − a²    →  well-mixed stable when b < 1 + a².
//   det   J = a²
// Turing instability requires the inhibitor (v) to diffuse much faster than
// the activator (u). Above the threshold D_v / D_u, the homogeneous state
// goes unstable and spontaneous spatial patterns (stripes, spots, mazes)
// emerge from arbitrarily small noise — Turing 1952.
//
// This is the same "activator-inhibitor + diffusion" mechanism Nakao used
// on a network. Same physics, same substrate; only the topology differs.

import type { Model, ModelState, ParamValues } from '../types.ts';
import type { Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

function buildGrid(cols: number, rows: number): Graph {
  const N = cols * rows;
  const adj: number[][] = Array.from({ length: N }, () => []);
  const edges: Array<[number, number]> = [];
  const link = (i: number, j: number): void => {
    adj[i]!.push(j);
    adj[j]!.push(i);
    edges.push([i, j]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) link(i, r * cols + (c + 1));
      if (r + 1 < rows) link(i, (r + 1) * cols + c);
    }
  }
  const deg = new Int32Array(N);
  for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
  return { N, adj, edges, deg };
}

const brusselator: Model = {
  id: 'brusselator-grid',
  name: 'Classical Turing (Brusselator)',
  short: 'Two species, two diffusion rates, a regular 2D lattice. The original 1952 Turing mechanism — stripes, spots, mazes from any small perturbation.',
  long: `Each cell holds two chemical concentrations *u* and *v*, governed by the Brusselator kinetics:

— **u** is produced at constant rate *a*, decays at rate *b* + 1, and is autocatalytically promoted by reaction with *v* (rate u² v).
— **v** is produced from *u* at rate *b u*, consumed in the same autocatalytic reaction.

The homogeneous fixed point (u, v) = (a, b/a) is locally stable in a well-mixed reactor (no diffusion). Adding diffusion can **destabilise** it: when the inhibitor *v* diffuses much faster than the activator *u*, any tiny noise grows into a spatial pattern. This is **Turing's 1952 mechanism** — the original theory of how chemistry alone can break spatial symmetry.

Default parameters (a = 4.5, b = 7.5, D_v / D_u = 8) sit well inside the Turing-unstable region. Watch the homogeneous gray flicker resolve into clean **stripes**.

— Lower b (around 5) → smaller-amplitude pattern, sometimes spots.
— Higher b → longer transients before saturation.
— Lower D_v / D_u → no pattern (subcritical regime).

Compare with the **Network Turing** demo: same chemistry on a random graph instead of a lattice. The substrate (X + W + synchronous update) is identical; only the topology differs.

Reference: Turing, *Phil. Trans. R. Soc. B* 237, 37 (1952). Brusselator: Prigogine & Lefever (1968).`,

  view: 'grid',

  params: {
    a:    { label: 'a',                   min: 1,    max: 8,   step: 0.1,   default: 4.5,  live: true },
    b:    { label: 'b',                   min: 1,    max: 12,  step: 0.1,   default: 7.5,  live: true },
    Du:   { label: 'D_u (activator)',     min: 0,    max: 2,   step: 0.01,  default: 0.50, live: true },
    Dv:   { label: 'D_v (inhibitor)',     min: 0,    max: 12,  step: 0.05,  default: 4.00, live: true },
    size: { label: 'grid size',           min: 32,   max: 200, step: 8,     default: 96,   live: false },
  },

  init(params: ParamValues, rng: RNG): ModelState {
    const size = Math.round(params.size as number);
    const a = params.a as number;
    const b = params.b as number;
    const N = size * size;
    const graph = buildGrid(size, size);

    // Initialize at the homogeneous fixed point (a, b/a) plus small noise.
    // No seed needed — Turing instability amplifies noise into pattern.
    const u0 = a;
    const v0 = b / a;
    const X = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      X[i * 2] = u0 + rng.uniform(-0.05, 0.05);
      X[i * 2 + 1] = v0 + rng.uniform(-0.05, 0.05);
    }

    return {
      N,
      d: 2,
      X,
      graph,
      t: 0,
      step_count: 0,
      cols: size,
      rows: size,
    };
  },

  step(state: ModelState, params: ParamValues): void {
    const Du = params.Du as number;
    const Dv = params.Dv as number;
    const a = params.a as number;
    const b = params.b as number;
    const { N, X, graph } = state;
    const adj = graph.adj;

    // Brusselator is moderately stiff — small dt + many substeps.
    const DT = 0.05;
    const SUB = 10;

    const du = new Float64Array(N);
    const dv = new Float64Array(N);
    for (let s = 0; s < SUB; s++) {
      for (let i = 0; i < N; i++) {
        const u = X[i * 2]!;
        const v = X[i * 2 + 1]!;
        const reactU = a - (b + 1) * u + u * u * v;
        const reactV = b * u - u * u * v;

        let su = 0;
        let sv = 0;
        const ai = adj[i]!;
        for (let p = 0; p < ai.length; p++) {
          const j = ai[p]!;
          su += X[j * 2]! - u;
          sv += X[j * 2 + 1]! - v;
        }
        // Unnormalised graph Laplacian (sum of neighbour differences). On a
        // 4-regular interior cell this equals 4× the textbook stencil; the
        // slider defaults compensate.
        du[i] = reactU + Du * su;
        dv[i] = reactV + Dv * sv;
      }
      for (let i = 0; i < N; i++) {
        let nu = X[i * 2]! + DT * du[i]!;
        let nv = X[i * 2 + 1]! + DT * dv[i]!;
        // Loose clamp so a bad slider drag can't NaN out the simulation.
        if (nu < 0) nu = 0; else if (nu > 20) nu = 20;
        if (nv < 0) nv = 0; else if (nv > 20) nv = 20;
        X[i * 2] = nu;
        X[i * 2 + 1] = nv;
      }
      state.step_count++;
    }
    state.t = state.step_count * DT;
  },

  render: {
    nodeColor(state: ModelState, i: number, params: ParamValues): string {
      // Diverging colormap centred on the fixed point u* = a.
      // Same red / blue palette as the Nakao network-Turing demo so that
      // visual comparisons line up.
      const u = state.X[i * 2]!;
      const u0 = params.a as number;
      const half = Math.max(0.1, u0 * 0.6);
      let t = (u - u0) / half;
      if (t < -1) t = -1;
      else if (t > 1) t = 1;
      const a = (t + 1) / 2;
      const r = Math.round(44 + (230 - 44) * a);
      const g = Math.round(95 + (57 - 95) * a);
      const b = Math.round(191 + (70 - 191) * a);
      return `rgb(${r},${g},${b})`;
    },
    nodeSize(): number {
      return 1;
    },
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
      label: 'σ(u) — pattern amplitude',
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

export default brusselator;
