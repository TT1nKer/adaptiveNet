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

/** Spatially-correlated noise on a `size`×`size` grid (see gray-scott.ts). */
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
        link(i, r * cols + ((c + 1) % cols));
        link(i, ((r + 1) % rows) * cols + c);
      } else {
        if (c + 1 < cols) link(i, r * cols + (c + 1));
        if (r + 1 < rows) link(i, (r + 1) * cols + c);
      }
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

**For instructors — five Δ-experiments suitable for problem sets**

**1. Find the Turing instability boundary.** Hold A and B fixed in a parameter region known to support patterns (e.g. A=2, B=5). Sweep D_v / D_u from 1 up. Locate the threshold ratio at which the homogeneous state first becomes unstable to spatial perturbations. Compare to the analytic Turing condition: the inhibitor must diffuse sufficiently faster than the activator. How close is your numerical threshold to the textbook prediction?

**2. Wavelength selection.** Above the Turing threshold, the system selects a characteristic spot/stripe wavelength λ. Measure λ from the resulting pattern. Vary D_u (keeping D_v/D_u fixed). Does λ scale as √D_u as the Turing analysis predicts?

**3. Pattern morphology.** With A and B fixed, is the asymptotic pattern (spots, stripes, mixed) deterministic — or does it depend on the random initial condition? Run 10 trials with different seeds at the same (A, B). What fraction give which morphology? This is *pattern selection under degenerate Turing instability* — an active area in nonlinear dynamics.

**4. From grid to graph.** Compare the asymptotic pattern here (Brusselator on a 2D lattice — stripes / spots) to the *Network Turing Patterns* demo (Brusselator-like reactions on a random graph — hub-organized clusters). What is the same? What is different? The chemistry is identical; only the topology changes. Argue what role spatial dimension plays in selecting morphology.

**5. Hopf vs Turing.** At small B, the homogeneous state may oscillate in time without forming spatial patterns (Hopf bifurcation), distinct from the Turing instability (spatial patterns from a stable temporal state). Find the (A, B) region where each occurs. Argue why time-oscillation and space-pattern instabilities can be present in the same model.

Reference: Turing, *Phil. Trans. R. Soc. B* 237, 37 (1952). Brusselator: Prigogine & Lefever (1968).`,

  view: 'grid',

  params: {
    a:    { label: 'a',                   min: 1,    max: 8,   step: 0.1,   default: 4.5,  live: true },
    b:    { label: 'b',                   min: 1,    max: 12,  step: 0.1,   default: 7.5,  live: true },
    Du:   { label: 'D_u (activator)',     min: 0,    max: 2,   step: 0.01,  default: 0.50, live: true },
    Dv:   { label: 'D_v (inhibitor)',     min: 0,    max: 12,  step: 0.05,  default: 4.00, live: true },
    size:  { label: 'grid size',          min: 32,   max: 256, step: 8,     default: 160,  live: false },
    speed: { label: 'speed',              min: 0.1,  max: 5,   step: 0.1,   default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'turing-onset',
      name: 'Turing onset (default)',
      short: 'a=4.5, b=7.5 with D_v/D_u = 8. Classical Brusselator Turing region — homogeneous state goes unstable, stripes / spots emerge from noise.',
      params: { a: 4.5, b: 7.5, Du: 0.5, Dv: 4.0, size: 160 },
      seed: 1,
    },
    {
      id: 'subcritical',
      name: 'subcritical (no pattern)',
      short: 'a=4.5, b=7.5 but D_v/D_u = 1. Below the Turing threshold; the homogeneous fixed point stays stable, noise just decays.',
      params: { a: 4.5, b: 7.5, Du: 2.0, Dv: 2.0, size: 160 },
      seed: 1,
    },
    {
      id: 'deep-turing',
      name: 'deep Turing',
      short: 'a=4.5, b=7.5 with D_v/D_u = 20. Well past the threshold — pattern forms faster and the wavelength is shorter.',
      params: { a: 4.5, b: 7.5, Du: 0.3, Dv: 6.0, size: 160 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): ModelState {
    const size = Math.round(params.size as number);
    const a = params.a as number;
    const b = params.b as number;
    const N = size * size;
    const graph = buildGrid(size, size, /* periodic */ true);

    // Initialize around the homogeneous fixed point (a, b/a) with
    // spatially-correlated noise. Amplitude has to be substantial relative
    // to the FP — otherwise the Turing-unstable mode takes too long to
    // grow visibly from rounding-level perturbations.
    const u0 = a;
    const v0 = b / a;
    const uField = coarseNoise(size, 10, rng);
    const vField = coarseNoise(size, 8, rng);
    const X = new Float64Array(N * 2);
    // noise spans ~30% of the FP magnitude — comfortably inside the basin
    // of attraction but big enough to see the pattern grow within seconds.
    const uAmp = u0 * 0.3;
    const vAmp = Math.max(0.3, v0 * 0.5);
    for (let i = 0; i < N; i++) {
      X[i * 2] = u0 + (uField[i]! - 0.5) * uAmp + rng.uniform(-0.02, 0.02);
      X[i * 2 + 1] = v0 + (vField[i]! - 0.5) * vAmp + rng.uniform(-0.02, 0.02);
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

    // Brusselator is stiff. At FP=(a, b/a) the reaction Jacobian fast
    // eigenvalue is around -12, plus diffusion contributes -D_v · Λ_max
    // (Λ_max=8 for a 4-regular periodic lattice) — combined ~ -45. Forward
    // Euler stability requires dt < 2/45 ≈ 0.044. Stay well below that.
    const DT = 0.02;
    const SUB = Math.max(1, Math.round(25 * (params.speed as number)));

    // Reuse work buffers — avoids GC pauses every ~0.5s at default 160² grid.
    const aux = state as ModelState & { _du?: Float64Array; _dv?: Float64Array };
    if (!aux._du || aux._du.length !== N) aux._du = new Float64Array(N);
    if (!aux._dv || aux._dv.length !== N) aux._dv = new Float64Array(N);
    const du = aux._du;
    const dv = aux._dv;
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
