// Gray-Scott reaction-diffusion on a 2D square lattice.
//
//   du/dt = D_u ∇²u  -  u v²  +  f (1 - u)
//   dv/dt = D_v ∇²v  +  u v²  -  (f + k) v
//
// The classical Pearson "U-skate world" parameter map: depending on (f, k)
// the system produces spots, splitting spots (mitosis), stripes, mazes,
// bubbles, or worms. The diffusion is the graph Laplacian on a 4-neighbour
// grid, which on a regular lattice is the standard 5-point stencil.

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

const grayScott: Model = {
  id: 'gray-scott',
  name: 'Gray–Scott on a 2D Grid',
  short: 'Reaction–diffusion on a square lattice. Spots, mazes, mitosis — different (f, k) give wildly different patterns.',
  long: `Two chemical species *u* and *v* live on every cell of a 2D square lattice. They react and diffuse:

— **u** is fed in from the outside at rate **f** (1 − u).
— **u** is consumed by reaction with **v**: u + 2v → 3v.
— **v** decays at rate (f + k).

This single reaction with two parameters produces an extraordinary range of self-organising patterns:

— **f = 0.0367, k = 0.0649** → spots that **divide**, like cellular mitosis.
— **f = 0.04, k = 0.06** → wandering worms.
— **f = 0.055, k = 0.062** → a steady-state **maze** of stripes.
— **f = 0.078, k = 0.061** → a chaotic mix of spots and worms.
— **f = 0.098, k = 0.057** → bubbles that nucleate and grow.

Drag the **f** and **k** sliders live to walk through the **Pearson map** of phenomena. Reset to start over from a small seeded perturbation in the centre of the grid.

Reference: Pearson, *Science* 261, 189 (1993). Original chemistry: Gray & Scott (1984).`,

  view: 'grid',

  presets: [
    {
      id: 'mitosis',
      name: 'mitosis (spots that divide)',
      short: 'f=0.0367, k=0.0649. A seed disc divides, divides again, eventually fills the canvas with replicating spots.',
      params: { Du: 0.04, Dv: 0.02, f: 0.0367, k: 0.0649, size: 96 },
      seed: 1,
    },
    {
      id: 'excitable',
      name: 'excitable waves (never settles)',
      short: 'Low f. Wave fronts propagate, reflect off boundaries, annihilate on collision — full excitable-medium phenomenology, no stationary state ever.',
      params: { Du: 0.04, Dv: 0.02, f: 0.014, k: 0.045, size: 96 },
      seed: 1,
    },
    {
      id: 'spreading',
      name: 'slow spreading',
      short: 'f=0.04, k=0.06. The seed slowly grows outward into stripe-like structures. Less iconic than mitosis but visibly diffusing.',
      params: { Du: 0.04, Dv: 0.02, f: 0.04, k: 0.06, size: 96 },
      seed: 1,
    },
  ],

  params: {
    // Note: defaults are 1/4 of the standard literature values because we use
    // the unnormalised graph Laplacian (sum of neighbour differences) and the
    // textbook stencil (1/4)*Σ.  Graph 0.04 ≡ stencil 0.16.
    Du:   { label: 'D_u (substrate)',  min: 0,    max: 0.2,  step: 0.005, default: 0.040,  live: true },
    Dv:   { label: 'D_v (activator)',  min: 0,    max: 0.1,  step: 0.001, default: 0.020,  live: true },
    f:    { label: 'feed rate (f)',    min: 0,    max: 0.12, step: 0.001, default: 0.0367, live: true },
    k:    { label: 'kill rate (k)',    min: 0.04, max: 0.08, step: 0.001, default: 0.0649, live: true },
    size: { label: 'grid size',        min: 32,   max: 200,  step: 8,     default: 96,     live: false },
  },

  init(params: ParamValues, rng: RNG): ModelState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const graph = buildGrid(size, size);

    const X = new Float64Array(N * 2);
    // Homogeneous fixed point of Gray-Scott: u = 1, v = 0.
    for (let i = 0; i < N; i++) {
      X[i * 2] = 1;
      X[i * 2 + 1] = 0;
    }
    // Single central seed — small disc of activator. Without a seed the
    // homogeneous (1, 0) state stays flat forever; with too many seeds the
    // mitosis demo loses its iconic "one spot divides" character.
    const cx = (size / 2) | 0;
    const cy = (size / 2) | 0;
    const radius = Math.max(4, (size / 12) | 0);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const r = cy + dy;
        const c = cx + dx;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const i = r * size + c;
        X[i * 2] = 0.5 + rng.uniform(-0.05, 0.05);
        X[i * 2 + 1] = 0.25 + rng.uniform(-0.05, 0.05);
      }
    }
    // tiny global noise to break pixel-perfect symmetry
    for (let i = 0; i < N; i++) {
      X[i * 2] += rng.uniform(-0.005, 0.005);
      X[i * 2 + 1] += rng.uniform(-0.005, 0.005);
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
    const f = params.f as number;
    const k = params.k as number;
    const { N, X, graph } = state;
    const adj = graph.adj;

    // Forward Euler. dt = 1 is standard for Gray-Scott. 8 substeps per frame
    // keeps pattern formation visible without burning CPU.
    const DT = 1.0;
    const SUB = 8;

    const du = new Float64Array(N);
    const dv = new Float64Array(N);
    for (let s = 0; s < SUB; s++) {
      for (let i = 0; i < N; i++) {
        const u = X[i * 2]!;
        const v = X[i * 2 + 1]!;
        const reactU = -u * v * v + f * (1 - u);
        const reactV = u * v * v - (f + k) * v;

        let su = 0;
        let sv = 0;
        const ai = adj[i]!;
        for (let p = 0; p < ai.length; p++) {
          const j = ai[p]!;
          su += X[j * 2]! - u;
          sv += X[j * 2 + 1]! - v;
        }
        // Unnormalised graph Laplacian (sum of neighbour differences). On a
        // 4-regular interior cell this is 4× the standard normalised
        // 5-point stencil — the slider defaults compensate.
        du[i] = reactU + Du * su;
        dv[i] = reactV + Dv * sv;
      }
      for (let i = 0; i < N; i++) {
        let nu = X[i * 2]! + DT * du[i]!;
        let nv = X[i * 2 + 1]! + DT * dv[i]!;
        if (nu < 0) nu = 0;
        else if (nu > 1.5) nu = 1.5;
        if (nv < 0) nv = 0;
        else if (nv > 1.5) nv = 1.5;
        X[i * 2] = nu;
        X[i * 2 + 1] = nv;
      }
      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      // Color by v concentration. Dark navy → orange → bright yellow.
      const v = state.X[i * 2 + 1]!;
      let t = v / 0.45;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      // 3-stop gradient: navy (0) → red-orange (0.5) → bright yellow (1)
      let r: number, g: number, b: number;
      if (t < 0.5) {
        const u = t * 2;
        r = Math.round(20 + (220 - 20) * u);
        g = Math.round(28 + (62 - 28) * u);
        b = Math.round(60 + (38 - 60) * u);
      } else {
        const u = (t - 0.5) * 2;
        r = Math.round(220 + (255 - 220) * u);
        g = Math.round(62 + (220 - 62) * u);
        b = Math.round(38 + (60 - 38) * u);
      }
      return `rgb(${r},${g},${b})`;
    },
    nodeSize(): number {
      // unused for grid view — runtime fills cells based on grid dimensions
      return 1;
    },
  },

  observe: {
    histogram: {
      label: 'v concentration distribution',
      range: [0, 0.5],
      bins: 30,
      values(state: ModelState): Float64Array {
        const N = state.N;
        const out = new Float64Array(N);
        for (let i = 0; i < N; i++) out[i] = state.X[i * 2 + 1]!;
        return out;
      },
    },
    timeSeries: {
      label: 'mean v concentration',
      value(state: ModelState): number {
        let s = 0;
        for (let i = 0; i < state.N; i++) s += state.X[i * 2 + 1]!;
        return s / state.N;
      },
    },
  },
};

export default grayScott;
