// Gross, D'Lima & Blasius (Phys. Rev. Lett. 96, 208701, 2006): adaptive SIS
// epidemic on a coevolving network. Each node is Susceptible (0) or Infected (1).
// Three concurrent processes:
//   - infection along an SI edge with rate p
//   - recovery I -> S with rate r
//   - rewiring along an SI edge with rate w: the S endpoint cuts the link to
//     the I and reconnects to a randomly chosen other S node (avoiding the I)
// Once w > 0 the topology coevolves with the disease and a *bistable* region
// appears: for the same parameters, healthy and endemic states can both be
// stable — the one you reach depends on initial condition. Sweeping p slowly
// up vs. down traces a hysteresis loop, an effect entirely absent in plain SIS.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['ba', 'er', 'ws'] as const;

const adaptiveSIS: Model = {
  id: 'adaptive-sis',
  name: 'Adaptive SIS Epidemic (Gross–D\'Lima–Blasius)',
  short: 'Susceptible nodes can rewire away from infected neighbours. The network topology coevolves with the disease — bistability and hysteresis appear that don\'t exist in static SIS.',
  name_zh: '自适应 SIS 流行病 (Gross–D\'Lima–Blasius)',
  short_zh: '易感节点可以从感染邻居那里重连离开。拓扑与疾病共同演化——出现了在静态图上不存在的双稳态和滞回。看着网络在感染簇周围自我隔离。',
  long_zh: `每个节点是**易感** (蓝) 或**感染** (红)。三个并发过程以下面的速率运行：

— **感染**沿 SI 边发生：S 节点以速率 **p** 染上疾病。
— **恢复**：I 节点自发以速率 **r** 变回 S。
— **重连**沿 SI 边以速率 **w** 发生：S 端断开与 I 邻居的连接，重新连到某个随机选择的另一个 S 节点。

当 **w = 0** 时这就是普通 SIS——p ≈ r 处一个相变，没有惊喜。**一旦 w > 0，网络与疾病共同演化**，*双稳态*区开启：同样的 (p, r, w) 允许两个稳态——健康和地方流行——你最终落到哪个取决于历史。慢慢把 p 拉上，再拉下：你画出滞回环。这是共演化结构产生静态图上不存在的动力学的最干净例子之一。

试预设 *"strong adaptation"*，看着流行病燃烧时网络重新结构化——未感染节点把它们的连接从感染邻居那里拉开，比疾病传播更快，从而把它隔离。

黄色次级时间序列是 **SI 边的比例**——自适应的签名。在静态图上它会与感染比例成比例追踪；这里它发散，因为网络在自我隔离。

**教师向 — 五道 Δ 实验适合作为习题**

**1. 普通 SIS 基线。** 设 w = 0。在 0.5 到 3.0 之间扫描 p / r。每个值下运行至感染比例稳定。定位相变点——应该在 p / r ≈ 1 (更精确地，平均场下 p × ⟨k⟩ / r = 1)。在 ER、BA、WS 拓扑上验证。无标度 (BA) 与同质 (ER) 之间阈值是否不同——Pastor-Satorras 2001 (无标度上流行病阈值 → 0) 是否帮助解释？

**2. 寻找双稳态区域。** 在 w = 0.3 下慢慢扫描 p (跨多个仿真步)。然后把 p 扫回去。绘制感染比例 vs p 的两个方向。应该出现滞回环——这就是普通 SIS 中不存在的双稳态。

**3. 网络重构速率。** 在强自适应 (w = 0.5) 下，测量系统平衡时 SI 边比例下降的速度。与感染比例稳定的速度比较。网络"学会"隔离感染簇——量化这种学习速率。

**4. I 子图 vs S 子图的拓扑。** 在 w > 0 下平衡后，分别计算 I 节点和 S 节点在各自子总体内的平均度数。I 子图应该比 S 子图稀疏得多 (S 在巩固连接；I 在失去连接)。量化这种不对称性。

**5. 从平均场到仿真。** Gross 2006 论文推出了一个矩闭合近似，解析地预测双稳态区。挑一个 (p, r, w) 点。计算稳态感染比例的平均场预测。用 20 个不同 seed 跑仿真。把仿真结果对平均场预测画图。闭合工作得多好？(这就是这类平台本应支持的*矩闭合验证*工作流。)

参考文献：Gross, D'Lima & Blasius, *Phys. Rev. Lett.* **96**, 208701 (2006). 平均场批评：Pastor-Satorras 等, *Rev. Mod. Phys.* 87, 925 (2015).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/adaptive-sis.ts 中的 long_zh 字段。]*`,
  long: `Each node is **Susceptible** (blue) or **Infected** (red). Three concurrent processes run at the rates shown:

— **Infection** along an SI edge: the S node catches the disease at rate **p**.
— **Recovery**: an I node spontaneously becomes S at rate **r**.
— **Rewiring** along an SI edge at rate **w**: the S endpoint disconnects from the I neighbour and reconnects to some other randomly-chosen S node.

When **w = 0** this is plain SIS — one phase transition at p ≈ r, no surprises. **Once w > 0, the network coevolves with the disease**, and a *bistable* region opens up: the same (p, r, w) admits two stable states — healthy and endemic — and which one you land in depends on history. Sweep p up slowly, then down: you trace a hysteresis loop. This is one of the cleanest examples of co-evolving structure producing dynamics absent on a fixed graph.

Try preset *"strong adaptation"* and watch the network restructure as the epidemic burns through it — uninfected nodes pull their links away from infected neighbours faster than the disease can spread, isolating it.

The yellow secondary trace is the **fraction of SI edges** — the adaptive signature. On a static graph it would track the infected fraction proportionally; here it diverges as the network self-quarantines.

**For instructors — five Δ-experiments suitable for problem sets**

**1. Plain SIS baseline.** Set w = 0. Sweep p / r from 0.5 to 3.0. For each value, run until the infected fraction stabilizes. Locate the transition point — should be at p / r ≈ 1 (more precisely, at p × ⟨k⟩ / r = 1 in mean-field). Verify on ER, BA, WS topologies. Does the threshold differ between scale-free (BA) and homogeneous (ER) — and does Pastor-Satorras 2001 (epidemic threshold → 0 on scale-free) help explain why?

**2. Find the bistable region.** With w = 0.3, sweep p slowly (over many simulation steps). Then sweep p back down. Plot infected fraction vs p for both directions. Hysteresis loop should appear — this is the bistability that does not exist in plain SIS.

**3. Network restructuring rate.** With strong adaptation (w = 0.5), measure how fast the SI-edge fraction drops as the system equilibrates. Compare to the rate at which the infected fraction stabilizes. The network "learns" to quarantine the infected cluster — quantify this learning rate.

**4. Topology of the I-subgraph vs S-subgraph.** After equilibration with w > 0, compute the average degree of I nodes vs S nodes within their own subpopulations. The I subgraph should be much sparser than the S subgraph (S has been consolidating connections; I has been losing them). Quantify the asymmetry.

**5. From mean-field to simulation.** The Gross 2006 paper derived a moment-closure approximation that predicts the bistability region analytically. Pick a (p, r, w) point. Compute the mean-field prediction for steady-state infected fraction. Run the simulation 20 times with different seeds. Plot the simulation results against the mean-field prediction. How well does the closure work? (This is the *moment-closure validation* workflow that this kind of platform is meant to support.)

Reference: Gross, D'Lima & Blasius, *Phys. Rev. Lett.* **96**, 208701 (2006). Mean-field critique: Pastor-Satorras et al., *Rev. Mod. Phys.* 87, 925 (2015).`,

  params: {
    p:        { label: 'p (infection rate)', min: 0,    max: 0.5,  step: 0.005, default: 0.10, live: true },
    r:        { label: 'r (recovery rate)',  min: 0,    max: 0.5,  step: 0.005, default: 0.05, live: true },
    w:        { label: 'w (rewire rate)',    min: 0,    max: 1.0,  step: 0.01,  default: 0.30, live: true },
    init_inf: { label: 'initial infected fraction', min: 0.01, max: 0.5, step: 0.01, default: 0.05, live: false },
    N:        { label: 'nodes',              min: 50,   max: 1000, step: 10,    default: 300, live: false },
    k:        { label: 'avg degree',         min: 2,    max: 14,   step: 1,     default: 6,   live: false },
    topo:     { label: 'topology (init)',    options: TOPO_OPTS, default: 'ba',                live: false },
    speed:    { label: 'speed',              min: 0.1,  max: 5,    step: 0.1,   default: 1.0, live: true },
  },

  presets: [
    {
      id: 'no-rewiring',
      name: 'no rewiring (plain SIS)',
      short: 'w=0: standard SIS, single transition at p ≈ r. Baseline for comparison.',
      params: { w: 0, p: 0.10, r: 0.05, init_inf: 0.05 },
    },
    {
      id: 'weak-adaptation',
      name: 'weak adaptation',
      short: 'w=0.1: small rewiring, network barely restructures, mostly endemic.',
      params: { w: 0.10, p: 0.10, r: 0.05, init_inf: 0.05 },
    },
    {
      id: 'strong-adaptation',
      name: 'strong adaptation (bistable)',
      short: 'w=0.5: rewiring outpaces infection, network self-quarantines around the I cluster.',
      params: { w: 0.50, p: 0.15, r: 0.05, init_inf: 0.10 },
    },
    {
      id: 'rapid-burnout',
      name: 'rapid burnout',
      short: 'r > p: recovery wins fast, disease dies out without needing rewiring.',
      params: { w: 0, p: 0.05, r: 0.10, init_inf: 0.20 },
    },
  ],

  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const initInf = params.init_inf as number;
    const generator = generators[topo];
    if (!generator) throw new Error(`unknown topology: ${topo}`);
    const graph = generator(N, k, rng);

    // 0 = S, 1 = I
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < initInf ? 1 : 0;

    return { N, d: 1, X, graph, t: 0, step_count: 0 };
  },

  step(state: ModelState, params: ParamValues, rng: RNG): void {
    const p = params.p as number;
    const r = params.r as number;
    const w = params.w as number;
    const speed = params.speed as number;
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;

    // Each "tick" attempts one edge event + one node event. ~5% of the
    // (edges + nodes) volume per frame at speed=1× — visible motion without
    // overwhelming the eye, and rate parameters keep their continuous-time
    // interpretation up to a global time scale.
    const ticks = Math.max(1, Math.floor((edges.length + N) * 0.05 * speed));

    for (let t = 0; t < ticks; t++) {
      // ----- edge event: rewire / infect along a random SI edge -----
      if (edges.length > 0) {
        const eIdx = rng.int(edges.length);
        const [i, j] = edges[eIdx]!;
        const xi = X[i]!;
        const xj = X[j]!;
        if (xi !== xj) {
          // sNode = the susceptible endpoint, iNode = the infected endpoint.
          const sNode = xi === 0 ? i : j;
          const iNode = xi === 0 ? j : i;
          if (rng.next() < w) {
            // rewire: S detaches from I, attempts to attach to random other S
            adj[sNode] = adj[sNode]!.filter((x) => x !== iNode);
            adj[iNode] = adj[iNode]!.filter((x) => x !== sNode);
            deg[sNode]!--;
            deg[iNode]!--;
            const last = edges[edges.length - 1]!;
            edges[eIdx] = last;
            edges.pop();

            let kk = -1;
            for (let attempts = 0; attempts < 30; attempts++) {
              const cand = rng.int(N);
              if (cand === sNode) continue;
              if (X[cand] !== 0) continue;
              if (adj[sNode]!.includes(cand)) continue;
              kk = cand;
              break;
            }
            if (kk >= 0) {
              adj[sNode]!.push(kk);
              adj[kk]!.push(sNode);
              deg[sNode]!++;
              deg[kk]!++;
              edges.push(sNode < kk ? [sNode, kk] : [kk, sNode]);
            }
          } else if (rng.next() < p) {
            // infection: S becomes I
            X[sNode] = 1;
          }
        }
      }

      // ----- node event: a random node may recover -----
      const nIdx = rng.int(N);
      if (X[nIdx] === 1 && rng.next() < r) {
        X[nIdx] = 0;
      }

      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      return state.X[i] === 1 ? '#e63946' : '#2c5fbf';
    },
    nodeSize(state: ModelState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  observe: {
    timeSeries: {
      label: 'fraction infected',
      value(state: ModelState): number {
        let count = 0;
        for (let i = 0; i < state.N; i++) {
          if (state.X[i] === 1) count++;
        }
        return count / state.N;
      },
    },
    timeSeries2: {
      label: 'fraction of SI edges',
      value(state: ModelState): number {
        const { X, graph } = state;
        const edges = graph.edges;
        if (edges.length === 0) return 0;
        let si = 0;
        for (let e = 0; e < edges.length; e++) {
          const [i, j] = edges[e]!;
          if (X[i] !== X[j]) si++;
        }
        return si / edges.length;
      },
    },
  },
};

export default adaptiveSIS;
