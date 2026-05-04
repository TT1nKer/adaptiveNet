// Gross, D'Lima & Blasius (2006). "Epidemic Dynamics on an Adaptive Network."
// Phys. Rev. Lett. 96, 208701. arXiv: q-bio/0512037.
//
// THIS FILE WAS REWRITTEN 2026-05-04 AGAINST THE ACTUAL PAPER (PDF fetched
// from https://arxiv.org/pdf/q-bio/0512037, extracted with pdftotext).
// The previous version was implemented from training prior without paper
// consultation. Per the paper-fidelity protocol now in ~/.claude/CLAUDE.md,
// this is being audited as part of the AUDIT.md verification campaign.
//
// PAPER ALGORITHM (quoted verbatim):
//
//   "We consider a network with a constant number of nodes, N, and
//   bidirectional links, K. The nodes represent individuals, which are
//   either susceptible (S) or infected (I). In every time step and for
//   every link connecting an infected with a susceptible (SI-link), the
//   susceptible becomes infected with the fixed probability p. Infected
//   recover from the disease with probability r, becoming susceptible
//   again. In addition, we allow susceptible individuals to protect
//   themselves by rewiring their links. With probability w for every
//   SI-link, the susceptible breaks the link to the infected and forms a
//   new link to another randomly selected susceptible. Double- and self-
//   connections are not allowed to form in this way."
//
// KEY DIFFERENCES vs the previous (NOT-VERIFIED) implementation:
//
//   PREVIOUS                                  PAPER
//   ─────────────────────────────────────────────────────────────────
//   Sample ONE random edge per tick           For every SI-link in the time step
//   Rewire OR infect (mutually exclusive)     Rewire AND infect (independent)
//   Sample ONE random node per tick           For every I node in the time step
//   if (rng < w) rewire; else if (rng < p)    if (rng < w) rewire; if (rng < p) infect
//
// The "mutually exclusive" structure of the previous version effectively made
// infection rate = (1−w)·p instead of independent p, shifting the epidemic
// threshold. The "one event per tick" structure smoothed out time but
// changed the per-time-step semantics.
//
// PAPER QUANTITATIVE CLAIMS USED AS ACCEPTANCE TESTS:
//
//   1. (Eq. before Eq. 1) Without rewiring (w=0): epidemic threshold is
//      p* = r/⟨k⟩. Below this, healthy state stable; above, endemic state
//      stable.
//   2. (Eq. 1) With rewiring: p* = w / [⟨k⟩ (1 − exp(−w/r))], approaching
//      w/⟨k⟩ for w ≫ r. This is HIGHER than r/⟨k⟩ — rewiring raises the
//      threshold (protects against epidemics).
//   3. (Fig 3) With non-zero w, hysteresis loop in p exists between two
//      thresholds: below the lower, only healthy state stable; above the
//      upper, only endemic; between, both stable depending on history.
//
// Test in tests/adaptive-sis.test.ts verifies (1) and (2) numerically by
// running the simulation in two parameter regimes and checking the
// stationary infected fraction.
//
// PAPER PARAMETER VALUES (Fig 1, Fig 3):
//   N = 10^5, K = 10^6, ⟨k⟩ = 20, r = 0.002, p = 0.008, w = 0.3.
// Browser-demo values (smaller N, faster dynamics for visible interactivity):
//   N = 300, k = 6, r = 0.05, p = 0.10, w = 0.30 (defaults below).

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

  long: `Each node is **Susceptible** (blue) or **Infected** (red). In every time step (paper's discrete unit) THREE processes are applied per the dynamical rule:

— For every **SI-link** in the network: the susceptible endpoint becomes infected with independent probability **p**.
— For every **infected** node: spontaneous recovery with probability **r** back to S.
— For every **SI-link**: with independent probability **w**, the susceptible endpoint breaks the link and reconnects to a randomly chosen susceptible elsewhere in the network. Double-edges and self-loops are disallowed.

Note all three rolls are independent — a single SI-link can both rewire AND infect in the same time step.

Without rewiring (w = 0), the system reduces to standard SIS on a fixed network with the textbook epidemic threshold **p\\* = r/⟨k⟩** (below: disease dies out; above: endemic state). With rewiring, the threshold shifts up to **p\\* = w / [⟨k⟩ (1 − exp(−w/r))]** (Eq. 1 in the paper) — rewiring is protective because it disconnects susceptibles from infected before transmission.

The paper's central observation: with rewiring on, a **hysteresis loop** opens up. There are two thresholds, not one. Between them the healthy and endemic states are both stable; which one the system settles in depends on history. Sweep p slowly up vs down and you trace a hysteresis loop.

Additional structural effects of rewiring described in the paper: positive (assortative) degree correlation; broadened degree distributions; cluster formation. These emerge from the coupling between dynamics and topology and are visible in the demo as the network restructures around the infected cluster.

**Things to try**

— Preset *no rewiring* (w=0): standard SIS, single transition at p ≈ r/⟨k⟩.
— Preset *rewiring on* (w=0.3, default): threshold rises; bistable region opens.
— Preset *strong rewiring* (w=0.6): network self-quarantines aggressively; rare infections die out fast.
— Drag p slowly up from 0 across 0.05, then back down. With w > 0 you should see different transition points going up vs going down — the hysteresis loop.

Reference: Gross, D'Lima & Blasius, *Epidemic Dynamics on an Adaptive Network*, **Phys. Rev. Lett.** 96, 208701 (2006). Open access: [arXiv:q-bio/0512037](https://arxiv.org/abs/q-bio/0512037).`,

  long_zh: `每个节点是**易感** (蓝) 或**感染** (红)。每个时间步（论文的离散时间单位）按动力学规则同时应用三个过程：

— 对**每条 SI 边**：易感端以独立概率 **p** 被感染。
— 对**每个感染节点**：以概率 **r** 自发恢复为 S。
— 对**每条 SI 边**：以独立概率 **w**，易感端断开此边并重连到网络中随机选定的另一个易感节点。不允许重边和自环。

三个掷骰是独立的——同一条 SI 边在同一时间步内可以同时重连和感染。

无重连时（w = 0），系统退化为固定网络上的标准 SIS，教科书阈值 **p\\* = r/⟨k⟩**（之下疾病消亡；之上稳定流行）。有重连时阈值上移到 **p\\* = w / [⟨k⟩ (1 − exp(−w/r))]**（论文 Eq. 1）——重连具有保护作用，因为它在传染发生前把易感者从感染者那里断开。

论文的核心观察：开启重连后**滞回环**打开。**两个阈值**而不是一个。在两阈值之间，健康态和地方流行态都稳定；最终落到哪个取决于历史。慢速将 p 上扫再下扫，你描绘出一条滞回环。

论文中还描述了重连对结构的额外影响：正（同配）度相关、加宽的度分布、簇形成。这些来自动力学与拓扑的耦合，在 demo 里以"网络在感染簇周围自我重构"的形式可见。

**尝试**

— 预设 *no rewiring*（w=0）：标准 SIS，p ≈ r/⟨k⟩ 处一个相变。
— 预设 *rewiring on*（w=0.3，默认）：阈值上升；双稳态区开启。
— 预设 *strong rewiring*（w=0.6）：网络强力自我隔离；稀有感染快速死亡。
— 将 p 从 0 慢速上扫到 0.05 再下扫。w > 0 时上下扫的相变点不同——这就是滞回环。

参考文献：Gross, D'Lima & Blasius, *Epidemic Dynamics on an Adaptive Network*, **Phys. Rev. Lett.** 96, 208701 (2006). 开放获取：[arXiv:q-bio/0512037](https://arxiv.org/abs/q-bio/0512037)。

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/adaptive-sis.ts 中的 long_zh 字段。]*`,

  params: {
    p:        { label: 'p (infection prob/SI-link)', min: 0, max: 1, step: 0.005, default: 0.10, live: true },
    r:        { label: 'r (recovery prob/I-node)',   min: 0, max: 1, step: 0.005, default: 0.05, live: true },
    w:        { label: 'w (rewire prob/SI-link)',    min: 0, max: 1, step: 0.01,  default: 0.30, live: true },
    init_inf: { label: 'initial infected fraction',  min: 0.01, max: 0.5, step: 0.01, default: 0.10, live: false },
    N:        { label: 'nodes',                      min: 50,   max: 1000, step: 10, default: 300,  live: false },
    k:        { label: 'avg degree',                 min: 2,    max: 14,   step: 1,  default: 6,    live: false },
    topo:     { label: 'initial topology',           options: TOPO_OPTS,   default: 'er',           live: false },
    speed:    { label: 'speed (steps/frame)',        min: 0.1,  max: 10,   step: 0.1, default: 1.0, live: true },
  },

  presets: [
    {
      id: 'no-rewiring',
      name: 'no rewiring (w = 0, plain SIS)',
      short: 'Static graph baseline. Single transition at p ≈ r/⟨k⟩. Defaults give p=0.10, r=0.05, ⟨k⟩=6 → threshold ≈ 0.0083; system is well above endemic regime.',
      params: { w: 0, p: 0.10, r: 0.05, init_inf: 0.10 },
    },
    {
      id: 'rewiring-on',
      name: 'rewiring on (w = 0.3, default)',
      short: 'Standard adaptive regime. Hysteresis loop opens between two thresholds. Network restructures around infected cluster.',
      params: { w: 0.30, p: 0.10, r: 0.05, init_inf: 0.10 },
    },
    {
      id: 'strong-rewiring',
      name: 'strong rewiring (w = 0.6)',
      short: 'Very fast rewiring. Susceptibles aggressively isolate from infected. Rare/marginal infections die out quickly.',
      params: { w: 0.60, p: 0.10, r: 0.05, init_inf: 0.10 },
    },
    {
      id: 'rapid-burnout',
      name: 'rapid burnout (r > p·⟨k⟩)',
      short: 'Recovery rate beats effective infection rate; disease dies out from any initial fraction. Below threshold for any w.',
      params: { w: 0, p: 0.005, r: 0.10, init_inf: 0.30 },
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

    // Each iteration of this loop = ONE paper time step (Phase 1 SI-link
    // updates + Phase 2 recovery). Speed multiplier scales how many time
    // steps fit into one render frame.
    const stepsPerFrame = Math.max(1, Math.round(speed));

    for (let s = 0; s < stepsPerFrame; s++) {
      // ----- Phase 1: snapshot SI links and process them in random order -----
      // Per paper: "for every link connecting an infected with a susceptible".
      // We snapshot the SI link list at start of the time step, then process
      // each. The state changes during processing (rewires + infections), so
      // we re-check before each event.
      const siEdges: Array<[number, number]> = [];
      for (let e = 0; e < edges.length; e++) {
        const [i, j] = edges[e]!;
        if (X[i] !== X[j]) siEdges.push([i, j]);
      }
      // Random order — Fisher-Yates
      for (let m = siEdges.length - 1; m > 0; m--) {
        const k2 = rng.int(m + 1);
        [siEdges[m], siEdges[k2]] = [siEdges[k2]!, siEdges[m]!];
      }

      for (const [i, j] of siEdges) {
        // Re-check: edge may have been rewired earlier this step.
        if (!adj[i]!.includes(j)) continue;
        // Re-check: endpoint may have been infected earlier this step.
        if (X[i] === X[j]) continue;

        const sNode = X[i] === 0 ? i : j;
        const iNode = X[i] === 0 ? j : i;

        // Per paper: rewire and infect are INDEPENDENT Bernoulli rolls.
        const doRewire = rng.next() < w;
        const doInfect = rng.next() < p;

        // Rewire first: removes the link. If both rolls fired, we still
        // mark sNode for infection AFTER the rewire — captures the case
        // where the susceptible got infected through this link before the
        // rewire took effect. (Paper doesn't specify ordering; this matches
        // the spirit of independent processes happening "in the same time
        // step".)
        if (doRewire) {
          // remove edge (i, j)
          adj[i] = adj[i]!.filter((x) => x !== j);
          adj[j] = adj[j]!.filter((x) => x !== i);
          deg[i]!--;
          deg[j]!--;
          // swap-pop on edges array
          const lo = i < j ? i : j;
          const hi = i < j ? j : i;
          for (let e = 0; e < edges.length; e++) {
            const [a, b] = edges[e]!;
            if (a === lo && b === hi) {
              edges[e] = edges[edges.length - 1]!;
              edges.pop();
              break;
            }
          }

          // S forms new link to "another randomly selected susceptible".
          // 30 attempts; falls back to no rewire if no S non-neighbour found.
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
        }

        if (doInfect) {
          X[sNode] = 1;
        }
      }

      // ----- Phase 2: recovery — for every I node, recover with prob r -----
      for (let n = 0; n < N; n++) {
        if (X[n] === 1 && rng.next() < r) {
          X[n] = 0;
        }
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
