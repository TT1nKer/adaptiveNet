// Nakao & Mikhailov (2010). "Turing patterns in network-organized
// activator-inhibitor systems." Nature Physics 6, 544-550. arXiv: 1005.1986.
//
// PAPER-VERIFIED 2026-05-04 against arXiv 1005.1986 (PDF fetched + pdftotext).
// Equations (2) of the paper:
//
//   du_i/dt = f(u_i, v_i) + ε Σ_j L_ij u_j
//   dv_i/dt = g(u_i, v_i) + σε Σ_j L_ij v_j
//
// where L_ij = A_ij - k_i δ_ij is the (unnormalised) graph Laplacian, A_ij is
// the adjacency matrix, and Σ_j L_ij u_j = Σ_j A_ij (u_j - u_i) is Fick's-law
// diffusive flux into node i. ε = D_act = activator diffusion; σε = D_inh =
// inhibitor diffusion; σ = D_inh/D_act is the ratio that controls Turing
// instability.
//
// REACTION TERMS (Mimura-Murray, paper Methods section line 517):
//
//   f(u, v) = {(a + b·u - u²)/c - v}·u
//   g(u, v) = {u - (1 + d·v)}·v
//
// PAPER PARAMETERS (Methods, line 518):
//   a = 35, b = 16, c = 9, d = 2/5 = 0.4  → fixed point (ū, v̄) = (5, 10)
//   ε = 0.12 (intermediate), σ = 15.6 (slightly above σ_c ≈ 15.5) — paper Fig 4.
//
// IMPLEMENTATION DEFAULTS (browser interactivity):
//   Du = 0.05 (≈ paper's ε scaled), Dv = 3.0 (σ ≈ 60, well above critical for
//   robust visible patterns rather than near-threshold marginal patterns).
//   See preset 'paper-near-critical' for σ ≈ paper Fig 4.
//
// Acceptance test in tests/nakao.test.ts:
//   - Below threshold (σ = 10): pattern doesn't form, σ(u) stays small (~0.5)
//   - Above threshold (σ = 30): pattern forms, σ(u) grows large (~2+)
//
// The implementation already matched the paper before this audit — this audit
// confirms the equations / parameters / diffusion form are paper-faithful.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

const nakao: Model = {
  id: 'nakao-2010',
  name: 'Network Turing Patterns',
  short: 'Reaction–diffusion on a graph; D_v ≫ D_u creates spontaneous high/low clusters.',
  name_zh: '网络 Turing 图样',
  short_zh: '图上的反应-扩散；D_v ≫ D_u 时自发出现高/低浓度簇。',
  long_zh: `每个节点上跑一个 Mimura-Murray 活化-抑制反应。扩散通过图 Laplacian 实现——每个节点的浓度向其邻居靠近。当抑制剂的扩散速率远高于活化剂 (D_v ≫ D_u) 时，均匀态失稳，网络自发分裂成高 u / 低 u 两簇。

切换拓扑到 Barabási-Albert 后，高度数 hub 节点变成图样的组织者。

**尝试**

— 默认参数：D_v / D_u ≈ 60，远高于 Turing 阈值。Hub 锁定到某一支。
— 在匹配参数下试 ER vs BA。ER 上 hub 主导特征消失。
— 把 D_v / D_u 降到 ~10（亚临界）——无图样，网络停在不动点。

参考文献：Nakao & Mikhailov, *Nature Physics* 6, 544–550 (2010).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/nakao.ts 中的 long_zh 字段。]*`,
  long: `On each node, a Mimura–Murray activator–inhibitor reaction. Diffusion happens through the graph Laplacian — each node's concentration moves toward its neighbors'. When the inhibitor diffuses much faster than the activator (D_v ≫ D_u), the homogeneous state is unstable and the network spontaneously splits into high-u / low-u clusters.

Switch the topology to Barabási–Albert and the high-degree hubs act as pattern organizers.

**Things to try**

— Default: D_v / D_u ≈ 60, well above Turing threshold. Hubs lock to one branch.
— Try ER vs BA topology at matched parameters. Hub-organisation vanishes on ER.
— Drop D_v / D_u to ~10 (subcritical) — no pattern, network sits at the fixed point.

Reference: Nakao & Mikhailov, *Nature Physics* 6, 544–550 (2010).`,

  params: {
    Du:   { label: 'D_u (activator)', min: 0,  max: 1,    step: 0.001, default: 0.05, live: true },
    Dv:   { label: 'D_v (inhibitor)', min: 0,  max: 10,   step: 0.01,  default: 3.00, live: true },
    N:    { label: 'nodes',           min: 50, max: 1000, step: 10,    default: 200,  live: false },
    k:    { label: 'avg degree',      min: 2,  max: 14,   step: 1,     default: 6,    live: false },
    topo:  { label: 'topology',       options: TOPO_OPTS, default: 'ba',              live: false },
    speed: { label: 'speed',          min: 0.1, max: 5, step: 0.1, default: 1.0,      live: true },
  },

  presets: [
    {
      id: 'ba-strong',
      name: 'BA · strong Turing (default)',
      short: 'D_v / D_u = 60, well above the Turing threshold σ_c ≈ 15.5 for Mimura-Murray. Hubs lock to one branch and shape the pattern.',
      params: { Du: 0.05, Dv: 3.0, N: 200, k: 6, topo: 'ba' },
      seed: 1,
    },
    {
      id: 'paper-near-critical',
      name: 'paper Fig 4 (ε=0.12, σ ≈ 15.6, near σ_c)',
      short: 'Paper\'s near-threshold parameters. Pattern develops slowly; outcome sensitive to initial perturbation. Demonstrates Turing instability onset.',
      params: { Du: 0.12, Dv: 0.12 * 15.6, N: 200, k: 6, topo: 'ba' },
      seed: 1,
    },
    {
      id: 'ba-subcritical',
      name: 'BA · subcritical (no pattern)',
      short: 'D_v / D_u = 10. Below the Turing threshold for Mimura–Murray at (a, b, c, d) = (35, 16, 9, 0.4) — homogeneous state stays stable, the network just sits at the fixed point.',
      params: { Du: 0.05, Dv: 0.5, N: 200, k: 6, topo: 'ba' },
      seed: 1,
    },
    {
      id: 'er-strong',
      name: 'Erdős–Rényi · strong Turing',
      short: 'Same dynamics as default, but on a roughly homogeneous random graph. Pattern still forms but the "hub-organizer" effect goes away — clusters are determined by Laplacian eigenvectors instead of by degree.',
      params: { Du: 0.05, Dv: 3.0, N: 200, k: 6, topo: 'er' },
      seed: 1,
    },
    {
      id: 'ws-strong',
      name: 'Watts–Strogatz · small-world',
      short: 'Strong Turing on a small-world topology — long-range shortcuts in a mostly local lattice. Pattern shows partial locality with occasional cross-links.',
      params: { Du: 0.05, Dv: 3.0, N: 200, k: 6, topo: 'ws' },
      seed: 1,
    },
  ],

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
    const SUB = Math.max(1, Math.round(25 * (params.speed as number)));

    const aux = state as ModelState & { _du?: Float64Array; _dv?: Float64Array };
    if (!aux._du || aux._du.length !== N) aux._du = new Float64Array(N);
    if (!aux._dv || aux._dv.length !== N) aux._dv = new Float64Array(N);
    const du = aux._du;
    const dv = aux._dv;
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
