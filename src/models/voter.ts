// Holme & Newman (2006). "Nonequilibrium phase transition in the coevolution
// of networks and opinions." Phys. Rev. E 74, 056108.
// arXiv: physics/0603023.
//
// THIS FILE WAS REWRITTEN 2026-05-04 AGAINST THE ACTUAL PAPER (PDF fetched
// from https://arxiv.org/pdf/physics/0603023, extracted with pdftotext).
// Per the paper-fidelity protocol in ~/.claude/CLAUDE.md, audit status is
// upgraded from ⛔ NOT VERIFIED to ✅ paper-verified.
//
// PAPER ALGORITHM (verbatim from Section II "Model Definition"):
//
//   "Pick a vertex i at random. If the degree k_i of that vertex is zero,
//   do nothing. Otherwise, with probability φ, select at random one of the
//   edges attached to i and move the other end of that edge to a vertex
//   chosen randomly from the set of all vertices having opinion g_i.
//
//   Otherwise (i.e., with probability 1 − φ) pick a random neighbor j of i
//   and set g_i equal to g_j."
//
// PAPER PARAMETERS:
//   - N vertices, M edges → mean degree k̄ = 2M/N
//   - G possible opinions, parameterised as γ = N/G (mean people per opinion)
//   - φ ∈ [0, 1] balances rewiring vs opinion-copying
//   - Initial: edges uniformly random, opinions assigned uniformly at random
//
// Paper's main quantitative claim (Sec. III, Fig 3): for k̄ = 4 and γ = 10,
// the system has a CONTINUOUS PHASE TRANSITION at
//
//      φ_c = 0.458 ± 0.008
//
// Below φ_c: largest connected same-opinion community (S/N) is O(1)
//   (giant community, consensus regime).
// Above φ_c: S/N → 0 as N → ∞, only small communities of mean size γ
//   (fragmentation regime). Critical exponents a=0.61, b=0.7 — different
//   universality class than random graph percolation.
//
// KEY DIFFERENCES vs the previous (NOT-VERIFIED) implementation:
//
//   PREVIOUS                                  PAPER
//   ──────────────────────────────────────────────────────────────────
//   Binary opinions {0, 1}                    G opinions; large-G focus
//   Pick random EDGE, then process            Pick random VERTEX i first
//   On rewire: j (other endpoint) keeps       Selected vertex i keeps the
//     the edge, attaches to same-opinion      edge; the OTHER end moves to
//     partner                                 a vertex with opinion g_i
//   On copy: random direction (50/50)         i adopts j's opinion (always
//     X[i] = X[j] OR X[j] = X[i]              one direction: i ← j)
//
// All four are paper-faithful corrections in this rewrite.
//
// KNOWN-DEVIATION: the paper allows multi-edges and self-edges in its
// calculation; it explicitly notes "these form only a small fraction of
// all edges, we expect that our results would change little if we were
// to remove them." This implementation uses the substrate's standard
// no-multi-edge / no-self-loop Graph type, matching the paper's
// "would change little" simplification.
//
// Test in tests/voter.test.ts verifies the φ_c phase transition by checking
// that S/N is large below φ_c and small above.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

interface VoterState extends ModelState {
  // Index of opinion holders, refreshed lazily. opinionMembers[g] is the
  // array of vertex indices currently holding opinion g. Maintained in
  // step() to make "pick random vertex with opinion g_i" an O(1) operation
  // instead of O(N).
  opinionMembers: number[][];
}

const voter: Model<VoterState> = {
  id: 'holme-newman',
  name: 'Coevolving Opinions / Voter (Holme–Newman)',
  name_zh: '共演化观点 / 投票者模型 (Holme–Newman)',
  short:
    'Pick a vertex; with prob φ rewire one of its edges to someone of the same opinion; else adopt a neighbour\'s opinion. Continuous phase transition at φ_c — fragmented opinions above, giant consensus community below.',
  short_zh:
    '随机选一个节点；以概率 φ 把它的一条边的另一端搬到一个同观点的随机节点上；否则采纳一个邻居的观点。在 φ_c 处发生连续相变——高于 φ_c 是观点碎片化，低于 φ_c 出现巨型共识社区。',

  long: `Each of N vertices holds one of G discrete **opinions**, with G = N/γ (γ = "mean people per opinion"). At each step:

— Pick a random vertex **i**. If its degree is 0, skip.
— With probability **φ**: pick a random edge of i; move the OTHER end of that edge to a randomly chosen vertex with opinion **g_i**. (i keeps the edge; the partner changes to someone of i's own opinion.)
— Otherwise (probability **1 − φ**): pick a random neighbour **j** of i; set **g_i = g_j** (i adopts j's opinion).

Both moves reduce the number of disagreeing neighbour-pairs. The system always reaches a "consensus state" — the network breaks into disconnected components, each holding a single opinion, with no edges crossing between communities of different opinions.

The interesting question is the SIZE of those communities. Paper's main result (Fig 3, for the canonical k̄=4, γ=10 case): there's a **continuous phase transition** at **φ_c = 0.458 ± 0.008**.

— Below φ_c: opinion-copying dominates rewiring → most vertices end up in one giant community sharing the same opinion (consensus regime).
— Above φ_c: rewiring dominates → only small communities, each of size ≈ γ on average (fragmentation regime).

Right at φ_c, the community size distribution P(s) ∼ s^(−α) follows a power law with exponent α = 3.5 ± 0.3. The critical exponents a = 0.61 and b = 0.7 (finite-size scaling) place this transition in a different universality class from random graph percolation.

**Things to try**

— **φ = 0.04** (well below φ_c): one giant community forms, holding the majority of vertices.
— **φ = 0.46** (≈ φ_c): mixed-scale communities; the size distribution is power-law-like at criticality.
— **φ = 0.96** (well above φ_c): the graph fragments into many small communities of roughly γ vertices each. No giant community.

Reference: Holme & Newman, *Nonequilibrium phase transition in the coevolution of networks and opinions*, **Phys. Rev. E** 74, 056108 (2006). Open access: [arXiv:physics/0603023](https://arxiv.org/abs/physics/0603023).`,

  long_zh: `N 个节点中每个持有 G 个离散**观点**之一，G = N/γ（γ = "每观点平均人数"）。每一步：

— 随机选一个节点 **i**。若 i 的度为 0，跳过。
— 以概率 **φ**：随机选 i 的一条边；把那条边的**另一端**搬到一个观点为 **g_i** 的随机节点。（i 保留这条边；伙伴换成与 i 同观点的人。）
— 否则（概率 **1 − φ**）：随机选 i 的一个邻居 **j**；令 **g_i = g_j**（i 采纳 j 的观点）。

两种操作都减少不同观点的邻居对数。系统最终总会到达"共识态"——网络分解成不连通的分量，每个分量内部只有一种观点，不同观点的社区之间没有边连接。

有趣的问题是这些社区的**大小**。论文主要结果（Fig 3，规范参数 k̄=4, γ=10）：在 **φ_c = 0.458 ± 0.008** 处存在**连续相变**。

— φ_c 以下：观点复制主导重连 → 大多数节点最终落入一个共享同一观点的巨型社区（共识区）。
— φ_c 以上：重连主导 → 只有小社区，每个平均大小 ≈ γ（碎片化区）。

恰好在 φ_c 处，社区大小分布 P(s) ∼ s^(−α) 服从幂律，指数 α = 3.5 ± 0.3。临界指数 a = 0.61 和 b = 0.7（有限尺寸标度）显示该相变与随机图渗流不在同一普适类。

**尝试**

— **φ = 0.04**（远低于 φ_c）：形成一个巨型社区，包含大多数节点。
— **φ = 0.46**（≈ φ_c）：多尺度社区；临界处大小分布近似幂律。
— **φ = 0.96**（远高于 φ_c）：图碎片化为多个约 γ 节点大小的小社区。无巨型社区。

参考文献：Holme & Newman, *Nonequilibrium phase transition in the coevolution of networks and opinions*, **Phys. Rev. E** 74, 056108 (2006). 开放获取：[arXiv:physics/0603023](https://arxiv.org/abs/physics/0603023)。

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/issues) 中反馈或直接修改 src/models/voter.ts 中的 long_zh 字段。]*`,

  params: {
    phi:    { label: 'φ (rewire probability)',    min: 0,   max: 1,   step: 0.01, default: 0.40, live: true },
    gamma:  { label: 'γ (mean per opinion)',     min: 2,   max: 50,  step: 1,    default: 10,   live: false },
    N:      { label: 'nodes',                    min: 100, max: 2000, step: 50,  default: 400,  live: false },
    k:      { label: 'mean degree (k̄)',          min: 2,   max: 14,  step: 1,    default: 4,    live: false },
    topo:   { label: 'initial topology',          options: TOPO_OPTS, default: 'er',             live: false },
    speed:  { label: 'speed (steps/frame)',      min: 0.1, max: 50,  step: 0.5,  default: 5,    live: true },
  },

  presets: [
    {
      id: 'consensus',
      name: 'consensus regime (φ = 0.04)',
      short: 'Far below φ_c. Opinion-copying dominates: a single giant community forms holding one opinion.',
      params: { phi: 0.04, gamma: 10, N: 400, k: 4, topo: 'er' },
    },
    {
      id: 'critical',
      name: 'near critical (φ = 0.46)',
      short: 'At paper\'s φ_c ≈ 0.458 for k̄=4, γ=10. Power-law community size distribution P(s) ~ s^(-3.5).',
      params: { phi: 0.46, gamma: 10, N: 400, k: 4, topo: 'er' },
    },
    {
      id: 'fragmentation',
      name: 'fragmentation regime (φ = 0.96)',
      short: 'Far above φ_c. Rewiring dominates: many small communities, each of size ≈ γ.',
      params: { phi: 0.96, gamma: 10, N: 400, k: 4, topo: 'er' },
    },
  ],

  init(params: ParamValues, rng: RNG): VoterState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const gamma = Math.round(params.gamma as number);
    const G = Math.max(1, Math.round(N / gamma));
    const topo = params.topo as string;
    const generator = generators[topo];
    if (!generator) throw new Error(`unknown topology: ${topo}`);
    const graph = generator(N, k, rng);

    // Opinions assigned uniformly at random in [0, G).
    const X = new Float64Array(N);
    const opinionMembers: number[][] = [];
    for (let g = 0; g < G; g++) opinionMembers.push([]);
    for (let i = 0; i < N; i++) {
      const g = rng.int(G);
      X[i] = g;
      opinionMembers[g]!.push(i);
    }

    return { N, d: 1, X, graph, t: 0, step_count: 0, opinionMembers };
  },

  step(state: VoterState, params: ParamValues, rng: RNG): void {
    const phi = params.phi as number;
    const speed = params.speed as number;
    const { N, X, graph, opinionMembers } = state;
    const { adj, edges, deg } = graph;

    // Per "step" execute speed × N events. One event = "pick a random vertex
    // and apply step 1 or step 2". Scaling by N gives ~1 update per
    // individual per call, similar to Moran-style time scaling. Speed
    // controls visualisation pacing, not dynamics.
    const ticks = Math.max(1, Math.floor(speed * N));

    for (let t = 0; t < ticks; t++) {
      // ----- Pick random vertex i. If isolated, skip. -----
      const i = rng.int(N);
      const ki = deg[i]!;
      if (ki === 0) {
        state.step_count++;
        continue;
      }

      if (rng.next() < phi) {
        // ===== Step 1 (paper): rewire =====
        // Pick a random edge of i; move the OTHER end to a vertex with opinion g_i.
        const ai = adj[i]!;
        const idxOnI = rng.int(ai.length);
        const j = ai[idxOnI]!;  // current other end

        // Find a target vertex with opinion g_i. If none exist (only i itself
        // holds this opinion) or all are already i or i's neighbours, skip.
        const gi = X[i]!;
        const candidates = opinionMembers[gi]!;
        if (candidates.length === 0) {
          state.step_count++;
          continue;
        }

        let jPrime = -1;
        for (let attempts = 0; attempts < 30; attempts++) {
          const cand = candidates[rng.int(candidates.length)]!;
          if (cand === i) continue;       // no self-loop
          if (cand === j) continue;       // would be the same edge
          if (adj[i]!.includes(cand)) continue;  // no multi-edge
          jPrime = cand;
          break;
        }
        if (jPrime < 0) {
          // No suitable target. Skip this rewire (paper-equivalent: edge
          // simply doesn't move this step — paper's algorithm doesn't
          // explicitly say what to do in this rare case).
          state.step_count++;
          continue;
        }

        // Remove edge (i, j) — j loses connection to i
        // Add edge (i, jPrime) — i keeps the edge, partner changes
        // i's adj: replace j with jPrime in-place
        ai[idxOnI] = jPrime;
        adj[j] = adj[j]!.filter((x) => x !== i);
        deg[j]!--;
        deg[jPrime]!++;
        // i's degree unchanged (still has the same edge, just to a new partner)
        adj[jPrime]!.push(i);

        // Update edges array. Find (min(i,j), max(i,j)) entry, replace with (min(i,jPrime), max(...)).
        const lo1 = i < j ? i : j;
        const hi1 = i < j ? j : i;
        const lo2 = i < jPrime ? i : jPrime;
        const hi2 = i < jPrime ? jPrime : i;
        for (let e = 0; e < edges.length; e++) {
          const [a, b] = edges[e]!;
          if (a === lo1 && b === hi1) {
            edges[e] = [lo2, hi2];
            break;
          }
        }
      } else {
        // ===== Step 2 (paper): copy =====
        // Pick random neighbour j of i, set g_i = g_j.
        const ai = adj[i]!;
        const j = ai[rng.int(ai.length)]!;
        const oldOp = X[i]!;
        const newOp = X[j]!;
        if (oldOp === newOp) {
          state.step_count++;
          continue;
        }
        X[i] = newOp;

        // Maintain opinionMembers
        const oldList = opinionMembers[oldOp]!;
        const idx = oldList.indexOf(i);
        if (idx >= 0) {
          oldList[idx] = oldList[oldList.length - 1]!;
          oldList.pop();
        }
        opinionMembers[newOp]!.push(i);
      }

      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: VoterState, i: number): string {
      // Hash opinion id to a hue. Colors loop after ~20 distinct opinions
      // but visual distinction within a single connected component is fine.
      const g = state.X[i]!;
      const hue = (g * 137.508) % 360;  // golden angle for good spread
      return `hsl(${hue}, 65%, 55%)`;
    },
    nodeSize(state: VoterState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  observe: {
    timeSeries: {
      label: 'largest community S/N',
      value(state: VoterState): number {
        // S = size of the largest connected same-opinion component.
        // Paper's primary order parameter (Fig 3, etc.).
        const { N, X, graph } = state;
        const { adj } = graph;
        const visited = new Uint8Array(N);
        let maxSize = 0;
        const stack: number[] = [];
        for (let start = 0; start < N; start++) {
          if (visited[start]) continue;
          // BFS/DFS in same-opinion subgraph
          const op = X[start]!;
          stack.length = 0;
          stack.push(start);
          visited[start] = 1;
          let size = 0;
          while (stack.length > 0) {
            const u = stack.pop()!;
            size++;
            const au = adj[u]!;
            for (let p = 0; p < au.length; p++) {
              const v = au[p]!;
              if (!visited[v] && X[v] === op) {
                visited[v] = 1;
                stack.push(v);
              }
            }
          }
          if (size > maxSize) maxSize = size;
        }
        return maxSize / N;
      },
    },
    timeSeries2: {
      label: 'fraction discordant edges',
      value(state: VoterState): number {
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
