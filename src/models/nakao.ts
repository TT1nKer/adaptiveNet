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
  name_zh: '网络 Turing 图样',
  short_zh: '图上的反应-扩散；D_v ≫ D_u 时自发出现高/低浓度簇。',
  long_zh: `每个节点上跑一个 Mimura-Murray 活化-抑制反应。扩散通过图 Laplacian 实现——每个节点的浓度向其邻居靠近。当抑制剂的扩散速率远高于活化剂 (D_v ≫ D_u) 时，均匀态失稳，网络自发分裂成高 u / 低 u 两簇。

切换拓扑到 Barabási-Albert 后，高度数 hub 节点变成图样的组织者。

**教师向 — 五道 Δ 实验适合作为习题**

**1. 寻找 Turing 阈值。** 固定所有反应参数和平均度。在 1 (无扩散对比) 到 50 之间扫描 D_v / D_u。每个比值下观察空间异质性是否涌现并稳定。定位阈值。经典 1D Mimura-Murray 分析预测一个特定临界值——网络版本给出相同阈值，还是有偏移？

**2. 拓扑依赖性。** 在阈值上方一点处，分别用三种拓扑 (ER、BA、WS) 跑同样的平均度。空间图样定性上是否不同？BA 图上，高度数 hub 节点变成"高 u"还是"低 u" 节点？论证 hub 中心性为何决定它落在双稳态的哪一侧。

**3. Hub 角色。** 在 BA 网络上，识别度数最高的前 10% 节点。图样稳定后，其中多大比例处于高 u 态 vs 低 u 态？与最低 10% 节点 (低度数) 同样比例做对比。这种不对称性量化了网络度异质性对图样的决定程度。

**4. 从网络到格子。** 比较图上 Nakao 图样 (本 demo) 和 2D 格子上的经典 Brusselator/Turing 图样 (*经典 Turing* demo)，参数匹配。格子版给出条纹/斑点；图版给出 hub 主导的聚类。论证哪种拓扑特征决定了这个差异。

**5. 序参量。** 哪个标量能干净地区分均匀态 (无图样) 与有图样态？试 (a) u 在节点间的方差，(b) max-u 与 min-u 之间的差距，(c) u 分布的双峰系数。哪个是最干净的序参量？哪个在有限 N 下最数值稳定？

参考文献：Nakao & Mikhailov, *Nature Physics* 6, 544–550 (2010).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/nakao.ts 中的 long_zh 字段。]*`,
  long: `On each node, a Mimura–Murray activator–inhibitor reaction. Diffusion happens through the graph Laplacian — each node's concentration moves toward its neighbors'. When the inhibitor diffuses much faster than the activator (D_v ≫ D_u), the homogeneous state is unstable and the network spontaneously splits into high-u / low-u clusters.

Switch the topology to Barabási–Albert and the high-degree hubs act as pattern organizers.

**For instructors — five Δ-experiments suitable for problem sets**

**1. Find the Turing threshold.** Hold all reaction parameters fixed and the average degree fixed. Sweep D_v / D_u from 1 (no diffusion contrast) up to 50. For each ratio, observe whether spatial heterogeneity emerges and stabilizes. Locate the threshold ratio. The classical 1D Mimura-Murray analysis predicts a specific critical value — does the network version give the same threshold, or is it shifted?

**2. Topology dependence.** Run at D_v / D_u just above threshold under three topologies (ER, BA, WS) at the same average degree. Does the spatial pattern look qualitatively different? On the BA graph, do the high-degree hubs become "high-u" or "low-u" nodes? Argue why hub centrality matters for which side of the bistability they fall on.

**3. Hub role.** On a BA network, identify the top 10% highest-degree nodes. After patterns stabilize, what fraction of them are in the high-u state vs low-u? Compare to the same fraction for the bottom 10% (low-degree) nodes. The asymmetry quantifies how much the network's degree heterogeneity determines its pattern.

**4. From network to grid.** Compare a Nakao pattern on a graph (this demo) to a classical Brusselator/Turing pattern on a 2D grid (the *Classical Turing* demo) at matched parameters. The grid version produces stripes / spots; the graph version produces hub-organized clusters. Argue what topological feature is responsible for the difference.

**5. Order parameter.** What scalar quantity cleanly distinguishes the homogeneous (no-pattern) state from the patterned state? Try (a) variance of u across nodes, (b) gap between max-u and min-u, (c) bimodality coefficient of the u distribution. Which is the cleanest order parameter for this transition? Which is most numerically stable under finite N?

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
      short: 'D_v / D_u = 60, well above the Turing threshold (~12 for these reaction params). Hubs lock to one branch and shape the pattern.',
      params: { Du: 0.05, Dv: 3.0, N: 200, k: 6, topo: 'ba' },
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
