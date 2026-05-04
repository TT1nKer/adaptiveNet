// Holme & Newman (Phys. Rev. E 74, 056108, 2006): coevolution of opinions
// and network structure. Each node carries a binary opinion. At each event
// a random edge is examined: if the two endpoints disagree, with probability
// φ the edge is rewired to a random same-opinion neighbor; otherwise one
// endpoint copies the other's opinion. There is a sharp phase transition
// at φ_c ≈ 0.46: below it the network reaches consensus, above it it
// fragments into two disconnected echo chambers.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

const voter: Model = {
  id: 'holme-newman',
  name: 'Adaptive Voter (Holme–Newman)',
  name_zh: '自适应投票者模型 (Holme–Newman)',
  short: 'Edges rewire when neighbors disagree; opinions copy when they don\'t. Echo chambers form below a critical rewire rate.',
  short_zh: '邻居观点不同时，边以概率 φ 重连；观点相同时相互复制。重连率超过临界值后，网络分裂成回声室。',
  long_zh: `每个节点持有二元观点（红或蓝）。每一步随机选一条边 (i, j)：

— 若两端点观点相同，不发生任何变化。
— 否则，以概率 **φ** 进行*重连*：j 切断与 i 的连接，重新连到一个与 j 观点相同的随机节点。以概率 1 − φ，发生*复制*：其中一端采纳另一端的观点。

**异质边比例**（连接相反观点的边占总边数的比例）是这个模型的序参量。它最终总会衰减到零，但有两种定性不同的方式：

— **低 φ**：复制主导 → 观点同质化 → *共识*。
— **高 φ**：重连主导 → 网络分裂 → *碎片化*（回声室）。

φ_c ≈ 0.46 处的相变是尖锐的。试试 φ = 0.3 vs φ = 0.6，观察网络动力学的定性差异。

**尝试**

— 试 φ = 0.3 vs φ = 0.6，观察网络动力学的定性差异。
— 增大 N。共识和碎片化之间的相变是否变得更尖锐？
— 在 φ = 0.4 下切换拓扑（ER → BA → WS）。相变形状是否变化？

参考文献：Holme & Newman, *Phys. Rev. E* 74, 056108 (2006).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/voter.ts 中的 long_zh 字段。]*`,
  long: `Each node holds a binary opinion (red or blue). Repeatedly, a random edge (i, j) is selected:

— if the two endpoints share an opinion, nothing happens.
— otherwise, with probability **φ** the edge is *rewired*: j drops i and reconnects to a random other node sharing j's opinion. With probability 1 − φ, one endpoint *copies* the other's opinion.

The **fraction of discordant edges** (edges connecting opposite opinions) is the order parameter. It always decays to zero, but in two qualitatively different ways:

— **Low φ:** copying dominates → opinions homogenize → *consensus*.
— **High φ:** rewiring dominates → the network splits in two → *fragmentation* (echo chambers).

The transition at φ_c ≈ 0.46 is sharp. Try φ = 0.3 vs φ = 0.6 and watch the network dynamics differ qualitatively.

**Things to try**

— Try φ = 0.3 vs φ = 0.6. Watch the qualitative difference in dynamics.
— Increase N. Does the transition between consensus and fragmentation sharpen?
— Switch topology (ER → BA → WS) at φ = 0.4. Does the shape of the transition change?

Reference: Holme & Newman, *Phys. Rev. E* 74, 056108 (2006).`,

  params: {
    phi:  { label: 'φ (rewire prob)', min: 0,  max: 1,    step: 0.01, default: 0.4, live: true },
    N:    { label: 'nodes',           min: 50, max: 1000, step: 10,   default: 200, live: false },
    k:    { label: 'avg degree',      min: 2,  max: 14,   step: 1,    default: 4,   live: false },
    topo:  { label: 'topology (init)', options: TOPO_OPTS, default: 'er',             live: false },
    speed: { label: 'speed',           min: 0.1, max: 5, step: 0.1, default: 1.0,     live: true },
  },

  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const generator = generators[topo];
    if (!generator) throw new Error(`unknown topology: ${topo}`);
    const graph = generator(N, k, rng);

    // opinion ∈ {0, 1} uniformly
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < 0.5 ? 0 : 1;

    return { N, d: 1, X, graph, t: 0, step_count: 0 };
  },

  step(state: ModelState, params: ParamValues, rng: RNG): void {
    const phi = params.phi as number;
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;

    if (edges.length === 0) return;

    // ~5% of edges per frame at speed=1×: visible movement without overwhelming the eye.
    const speed = params.speed as number;
    const eventsPerFrame = Math.max(1, Math.floor(edges.length * 0.05 * speed));

    for (let s = 0; s < eventsPerFrame; s++) {
      if (edges.length === 0) return;
      const eIdx = rng.int(edges.length);
      const [i, j] = edges[eIdx]!;

      if (X[i] === X[j]) continue;

      if (rng.next() < phi) {
        // ----- rewire: j drops i, reconnects to a random same-opinion node -----
        const opinion = X[j]!;
        // remove edge from adj
        adj[i] = adj[i]!.filter((x) => x !== j);
        adj[j] = adj[j]!.filter((x) => x !== i);
        deg[i]!--;
        deg[j]!--;
        // remove from edges array (swap-pop, O(1))
        const last = edges[edges.length - 1]!;
        edges[eIdx] = last;
        edges.pop();

        // find a random node k of the same opinion not already connected to j
        let kk = -1;
        for (let attempts = 0; attempts < 30; attempts++) {
          const cand = rng.int(N);
          if (cand === j) continue;
          if (X[cand] !== opinion) continue;
          if (adj[j]!.includes(cand)) continue;
          kk = cand;
          break;
        }
        if (kk >= 0) {
          adj[j]!.push(kk);
          adj[kk]!.push(j);
          deg[j]!++;
          deg[kk]!++;
          edges.push(j < kk ? [j, kk] : [kk, j]);
        }
      } else {
        // ----- copy: one endpoint adopts the other's opinion (random direction) -----
        if (rng.next() < 0.5) X[i] = X[j]!;
        else X[j] = X[i]!;
      }
      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      return state.X[i]! > 0.5 ? '#e63946' : '#2c5fbf';
    },
    nodeSize(state: ModelState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  observe: {
    histogram: {
      label: 'opinion distribution',
      range: [0, 1],
      bins: 2,
      values(state: ModelState): Float64Array {
        // X is already length N for d=1
        return state.X;
      },
    },
    timeSeries: {
      label: 'fraction of discordant edges',
      value(state: ModelState): number {
        const { X, graph } = state;
        const edges = graph.edges;
        if (edges.length === 0) return 0;
        let count = 0;
        for (let e = 0; e < edges.length; e++) {
          const [i, j] = edges[e]!;
          if (X[i] !== X[j]) count++;
        }
        return count / edges.length;
      },
    },
  },
};

export default voter;
