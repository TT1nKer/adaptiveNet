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

/**
 * Spatially-correlated noise on a `size`×`size` grid. Sample white noise on
 * a coarser `size/scale` grid and bilinearly upsample. Output values are in
 * [0, 1]. Larger `scale` → larger blobs.
 */
function coarseNoise(size: number, scale: number, rng: RNG): Float64Array {
  const coarseSize = Math.max(2, (size / scale) | 0);
  const coarse = new Float64Array(coarseSize * coarseSize);
  for (let i = 0; i < coarse.length; i++) coarse[i] = rng.next();

  const out = new Float64Array(size * size);
  const cMax = coarseSize - 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cr = (r / size) * cMax;
      const cc = (c / size) * cMax;
      const r0 = cr | 0;
      const r1 = Math.min(r0 + 1, cMax);
      const c0 = cc | 0;
      const c1 = Math.min(c0 + 1, cMax);
      const fr = cr - r0;
      const fc = cc - c0;
      const v00 = coarse[r0 * coarseSize + c0]!;
      const v01 = coarse[r0 * coarseSize + c1]!;
      const v10 = coarse[r1 * coarseSize + c0]!;
      const v11 = coarse[r1 * coarseSize + c1]!;
      const top = v00 * (1 - fc) + v01 * fc;
      const bot = v10 * (1 - fc) + v11 * fc;
      out[r * size + c] = top * (1 - fr) + bot * fr;
    }
  }
  return out;
}

function buildGrid(cols: number, rows: number, periodic = true): Graph {
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
      if (periodic) {
        // wrap: every cell has exactly 4 neighbours, including the edges
        link(i, r * cols + ((c + 1) % cols));
        link(i, ((r + 1) % rows) * cols + c);
      } else {
        // Neumann (zero-flux): edge cells have 2-3 neighbours
        if (c + 1 < cols) link(i, r * cols + (c + 1));
        if (r + 1 < rows) link(i, (r + 1) * cols + c);
      }
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
    // ---- stable / quasi-stable regimes ----
    {
      id: 'mitosis',
      name: 'mitosis (spots that divide)',
      short: 'f=0.0367, k=0.0649. Spots emerge from noise and divide repeatedly, filling the periodic grid with replicating dots.',
      params: { Du: 0.04, Dv: 0.02, f: 0.0367, k: 0.0649, size: 160 },
      seed: 1,
    },
    {
      id: 'worms',
      name: 'worms / labyrinth',
      short: 'f=0.04, k=0.06. Wandering filaments form across the grid, slowly extending and merging. Munafo λ region.',
      params: { Du: 0.04, Dv: 0.02, f: 0.04, k: 0.06, size: 160 },
      seed: 1,
    },
    {
      id: 'maze',
      name: 'maze (stationary stripes)',
      short: 'f=0.062, k=0.061. Stripes nucleate everywhere, lock into a stationary maze. Munafo ε region.',
      params: { Du: 0.04, Dv: 0.02, f: 0.062, k: 0.061, size: 160 },
      seed: 1,
    },

    // ---- on / near the critical curve — never-settles dynamics ----
    {
      id: 'excitable',
      name: 'excitable chaos',
      short: 'f=0.014, k=0.045. Deep in the excitable region. Wave fronts collide and annihilate; system never reaches a stationary state. Chaotic, no stable structures.',
      params: { Du: 0.04, Dv: 0.02, f: 0.014, k: 0.045, size: 160 },
      seed: 1,
    },
    {
      id: 'drifting',
      name: 'drifting waves',
      short: 'f=0.017, k=0.05. Between chaotic excitable and U-skate gliders. Persistent waves with semi-stable filaments slowly drifting and recombining.',
      params: { Du: 0.04, Dv: 0.02, f: 0.017, k: 0.05, size: 160 },
      seed: 1,
    },
    {
      id: 'u-skate',
      name: 'U-skate / gliders',
      short: 'f=0.0203, k=0.0535. Munafo\'s U-skate world. Small wave packets glide stably across the periodic grid until they collide with each other.',
      params: { Du: 0.04, Dv: 0.02, f: 0.0203, k: 0.0535, size: 160 },
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
    size: { label: 'grid size',        min: 32,   max: 256,  step: 8,     default: 160,    live: false },
  },

  init(params: ParamValues, rng: RNG): ModelState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const graph = buildGrid(size, size, /* periodic */ true);

    // Spatially-correlated noise on both fields gives the initial state
    // visible "regions" rather than uniform statistics. Each blob acts as
    // its own incipient pattern domain — exactly what maze and worm regimes
    // amplify. Two independent fields at slightly different scales so u and
    // v don't trivially correlate.
    const uField = coarseNoise(size, 10, rng);
    const vField = coarseNoise(size, 8, rng);
    const X = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      // u: 0.85–1.00 with smooth blobs of slight depletion
      X[i * 2] = 0.85 + 0.15 * uField[i]! + rng.uniform(-0.01, 0.01);
      // v: 0–0.20 with smooth blobs of activator
      X[i * 2 + 1] = 0.20 * vField[i]! + rng.uniform(0, 0.01);
    }
    // Add a slightly stronger central seed so the mitosis demo has a clean
    // "first spot" amid the textured background.
    const cx = (size / 2) | 0;
    const cy = (size / 2) | 0;
    const radius = Math.max(4, (size / 16) | 0);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const r = cy + dy;
        const c = cx + dx;
        if (r < 0 || r >= size || c < 0 || c >= size) continue;
        const i = r * size + c;
        X[i * 2] = 0.5 + rng.uniform(-0.05, 0.05);
        X[i * 2 + 1] = 0.30 + rng.uniform(-0.05, 0.05);
      }
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
