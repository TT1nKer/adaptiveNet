// Pacheco, Traulsen & Nowak (PRL 97, 258103, 2006): Coevolution of strategy
// and structure in complex networks with dynamical linking.
//
// Players on a network play repeated prisoner's dilemma with their neighbours.
// Two coupled processes evolve simultaneously:
//
//   STRATEGY DYNAMICS (Fermi imitation): a randomly chosen player i compares
//     payoff with a random neighbour j; i copies j's strategy with probability
//     1 / (1 + exp(β · (π_i − π_j))).
//
//   LINKING DYNAMICS (active linking): edges break at rates that depend on
//     the strategy types of their endpoints. CC edges (cooperator–cooperator)
//     are stable; DD edges (defector–defector) are fragile; CD edges sit
//     between. When an edge breaks, the satisfied endpoint picks a new
//     random partner.
//
// The ratio of linking events to strategy events (parameter q here) controls
// whether the network adapts faster or slower than the strategies. The PRL
// 2006 paper's central observation: when linking is sufficiently fast,
// cooperators can cluster and protect each other from exploitation, even on
// a payoff matrix that would lead to all-defection on a fixed graph.
//
// Payoff matrix (donation-game form, the cleanest 2-parameter PD):
//   C vs C: each gets b − c
//   C vs D: C gets −c, D gets b
//   D vs D: each gets 0
// PD requirements: b > c > 0 (so T > R > P > S).
//
// Implementation simplifications vs the original paper:
//   - The paper uses three breaking rates α_CC, α_CD, α_DD as continuous-time
//     rates; here we sample one edge per linking event and apply a per-event
//     break probability of the same type. Statistically equivalent in the
//     long-time limit; visually identical.
//   - When a CD edge breaks, both endpoints could be "the dissatisfied one"
//     in principle. We let the C endpoint be the active rewirer (it suffered
//     the −c). This is the standard simplification and matches most
//     follow-up work in the active-linking literature.
//   - Rewiring preference: both C and D rewirers prefer C as new partner
//     (with a 30-attempt budget, falling back to random non-neighbour if
//     none found). This is asymmetric in TYPE PREFERENCE, not same-type
//     homophily — both strategies want C neighbours, because C-neighbours
//     dominate D-neighbours in the PD payoff matrix for both types:
//     C wants C (b − c vs −c), D wants C (b vs 0). Pacheco's analytical
//     framework with asymmetric formation rates α_CC > α_CD > α_DD reduces
//     to this in the discrete-event impl. Without the preference, the
//     linking dynamics cannot rescue cooperation against Fermi-driven
//     D-bias (defectors win at all q). With same-type homophily (D-prefers-D),
//     the network bipartitions and colours freeze. Always-prefer-C is
//     the right asymmetry — D constantly invades C clusters, C constantly
//     evicts via the high α_CD break rate, D's neighbourhoods degrade,
//     Fermi imitation eventually flips D → C.
//   - Payoff is degree-normalised (average payoff per game, not accumulated).
//     With unnormalised payoffs, BA hubs dominate Fermi imitation purely on
//     degree — the network collapses to the hub's initial strategy in the
//     first ~50 events, before linking dynamics can act. Normalisation
//     keeps β·Δπ at O(c) regardless of degree heterogeneity, which is the
//     regime where active-linking actually shapes the outcome.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

// Initial topologies. Pacheco's paper uses BA or ER; K_N (complete graph) is
// a useful well-mixed baseline. For complete graphs, the layout module skips
// force-directed iterations (in 2D the spring constraints are unsatisfiable
// for K_N) and leaves nodes on the initial circular arrangement.
const TOPO_OPTS = ['ba', 'er', 'complete'] as const;

const pacheco: Model = {
  id: 'pacheco-2006',
  name: 'Coevolving Cooperation (Pacheco–Traulsen–Nowak)',
  name_zh: '共演化合作博弈 (Pacheco–Traulsen–Nowak)',
  short:
    'Players on a network play prisoner\'s dilemma; edges break and rewire based on whether the partnership pays off. Cooperators cluster, defectors get isolated.',
  short_zh:
    '节点在网络上玩囚徒困境；边根据合作伙伴是否带来收益来断开和重连。合作者聚团，背叛者被孤立。',

  long: `Each node is a **Cooperator** (blue) or **Defector** (red). Every neighbour pair plays one round of prisoner's dilemma per "frame". The donation-game payoff matrix gives:

— C vs C: each gets b − c  (mutual benefit, paid for)
— C vs D: C gets −c, D gets b  (cooperator is exploited)
— D vs D: each gets 0  (no cooperation, no exploitation)

Per simulation tick, **one of two events** happens with the chosen probability ratio:

— **Strategy event** (probability 1 − q): a random player i compares average payoff per game with a random neighbour j; i adopts j's strategy with probability 1 / (1 + exp(β · (π_i − π_j))). β controls selection strength: β → 0 is random drift, β → ∞ is deterministic copy-better. (Payoffs are *degree-normalised* — average per game, not accumulated — to keep dynamics consistent across the heterogeneous degree distributions of BA / ER. Without this, BA hubs trivially dominate Fermi imitation on raw payoff scale.)

— **Linking event** (probability q): a random edge is examined. Edges break with probabilities that depend on the endpoint strategies:
  - **α_CC** (low): CC edges are mutually beneficial → stable
  - **α_CD** (medium): CD edges are asymmetric — the C endpoint is being exploited → unstable from C's side
  - **α_DD** (high): DD edges produce zero payoff → fragile; both endpoints want better partners

When an edge breaks, the dissatisfied endpoint rewires preferentially toward a Cooperator non-neighbour. Both C and D want C neighbours — C for mutual benefit (b − c), D for exploitation (b) — so this is "prefer C", not symmetric same-type homophily. The "constantly invade / constantly evict" cycle this produces is exactly Pacheco's mechanism: D's neighbourhoods degrade as C kicks them out, and Fermi imitation eventually flips D → C.

The classical fixed-graph PD result is that **defectors win**: the only Nash equilibrium of one-shot PD is mutual defection, and on a static graph that's the absorbing state. Pacheco et al.'s central observation: with **fast enough linking** (q above a threshold), cooperators can dynamically restructure the network around themselves — staying connected to other Cs (CC edges are stable) and shedding Ds (CD/DD edges break). The network self-organises into a "cooperator core surrounded by isolated defectors", and cooperation becomes evolutionarily stable.

**Things to try**

— Preset *static network* (q = 0): classic fixed-graph PD. Defectors take over within a few hundred ticks regardless of initial fraction.
— Preset *active linking* (q = 0.3): cooperators cluster and survive. Watch the CC-edge fraction (yellow trace) climb.
— Preset *linking dominant* (q = 0.7): network restructures faster than strategies; cooperator clusters consolidate quickly into stable communities.
— Drag β: at β ≈ 0.05 dynamics are mostly noise; at β ≈ 2 strategies copy near-deterministically and the linking dynamics matter less.

Reference: Pacheco, Traulsen & Nowak, *Coevolution of strategy and structure in complex networks with dynamical linking*, **Phys. Rev. Lett.** 97, 258103 (2006). [doi:10.1103/PhysRevLett.97.258103](https://doi.org/10.1103/PhysRevLett.97.258103)`,

  long_zh: `每个节点是**合作者** (蓝) 或**背叛者** (红)。每对邻居每"帧"玩一轮囚徒困境。捐赠博弈支付矩阵：

— C vs C：各得 b − c（共同受益但付出代价）
— C vs D：C 得 −c，D 得 b（合作者被剥削）
— D vs D：各得 0（无合作也无剥削）

每一仿真 tick，**两个事件之一**按选定概率发生：

— **策略事件** (概率 1 − q)：随机选一个玩家 i，与随机邻居 j 比较**每场博弈平均收益**；i 以概率 1 / (1 + exp(β · (π_i − π_j))) 采纳 j 的策略。β 控制选择强度：β → 0 时是随机漂移，β → ∞ 时是确定性的"复制更好者"。(收益按*度数归一化*——每场博弈平均，不是累积——这样 BA / ER 异质度数分布下动力学保持一致；不归一化的话 BA hub 会在度数尺度上直接碾压 Fermi imitation。)

— **重连事件** (概率 q)：随机选一条边考察。边以下面取决于端点策略的概率断开：
  - **α_CC** (低)：CC 边互惠 → 稳定
  - **α_CD** (中)：CD 边不对称——C 端被剥削 → 从 C 视角不稳定
  - **α_DD** (高)：DD 边产生零收益 → 脆弱；两端都想找更好的伙伴

当边断开时，不满意的一端**优先寻找合作者**作为新邻居。C 和 D 都想连 C——C 想连 C 是为了互惠 (b − c)，D 想连 C 是为了剥削 (b)——所以这是"偏好 C"，不是对称的同类聚合。这种"D 不停入侵 / C 不停驱逐"循环正是 Pacheco 的机制：D 的邻里随着 C 的剔除而恶化，Fermi imitation 最终把 D 翻成 C。

经典固定图 PD 的结果是**背叛者获胜**：一次性 PD 的唯一纳什均衡是相互背叛，在静态图上这是吸收态。Pacheco 等的核心观察：当**重连足够快** (q 高于阈值) 时，合作者可以动态地围绕自己重构网络——与其他 C 保持连接 (CC 边稳定)，剥离 D (CD/DD 边断开)。网络自组织为"合作者核心 + 被孤立的背叛者"，合作变为演化稳定。

**尝试**

— 预设 *static network* (q = 0)：经典固定图 PD。无论初始合作比例多少，背叛者几百 tick 内接管。
— 预设 *active linking* (q = 0.3)：合作者聚团并存活。看 CC 边比例 (黄线) 攀升。
— 预设 *linking dominant* (q = 0.7)：网络重构快于策略；合作者团迅速凝聚为稳定社区。
— 拖动 β：β ≈ 0.05 时动力学大部分是噪声；β ≈ 2 时策略近似确定性复制，重连动力学影响减弱。

参考文献：Pacheco, Traulsen & Nowak, *Coevolution of strategy and structure in complex networks with dynamical linking*, **Phys. Rev. Lett.** 97, 258103 (2006). [doi:10.1103/PhysRevLett.97.258103](https://doi.org/10.1103/PhysRevLett.97.258103)

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/pacheco-2006.ts 中的 long_zh 字段。]*`,

  params: {
    b:        { label: 'b (benefit)',        min: 1,    max: 10,   step: 0.1,   default: 5.0,  live: true },
    c:        { label: 'c (cost)',           min: 0.1,  max: 5,    step: 0.1,   default: 1.0,  live: true },
    beta:     { label: 'β (selection)',      min: 0.01, max: 5,    step: 0.01,  default: 0.5,  live: true },
    q:        { label: 'q (linking rate)',   min: 0,    max: 1,    step: 0.01,  default: 0.50, live: true },
    alpha_CC: { label: 'α_CC (CC break)',    min: 0,    max: 0.5,  step: 0.005, default: 0.02, live: true },
    alpha_CD: { label: 'α_CD (CD break)',    min: 0,    max: 1,    step: 0.01,  default: 0.50, live: true },
    alpha_DD: { label: 'α_DD (DD break)',    min: 0,    max: 1,    step: 0.01,  default: 0.95, live: true },
    init_C:   { label: 'initial C fraction', min: 0.05, max: 0.95, step: 0.05,  default: 0.50, live: false },
    N:        { label: 'nodes',              min: 50,   max: 1000, step: 10,    default: 200,  live: false },
    k:        { label: 'avg degree',         min: 2,    max: 14,   step: 1,     default: 6,    live: false },
    topo:     { label: 'initial topology',   options: TOPO_OPTS,   default: 'ba',              live: false },
    speed:    { label: 'speed',              min: 0.1,  max: 5,    step: 0.1,   default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'static-network',
      name: 'static network (q = 0)',
      short: 'No rewiring. Classical fixed-graph PD: defectors take over within a few hundred ticks.',
      params: { q: 0, b: 5, c: 1, beta: 0.5, init_C: 0.50 },
    },
    {
      id: 'active-linking',
      name: 'active linking (q = 0.5, default)',
      short: 'Balanced linking and strategy events. With homophily rewiring, cooperators cluster and CC-edge fraction climbs.',
      params: { q: 0.50, b: 5, c: 1, beta: 0.5, init_C: 0.50 },
    },
    {
      id: 'linking-dominant',
      name: 'linking dominant (q = 0.85)',
      short: 'Network restructures much faster than strategies. Cooperator communities consolidate quickly into a stable C-core + isolated Ds.',
      params: { q: 0.85, b: 5, c: 1, beta: 0.5, init_C: 0.50 },
    },
    {
      id: 'weak-selection',
      name: 'weak selection (β = 0.05)',
      short: 'Strategy updates are mostly random. Linking dynamics dominate. Drift-like behaviour with cooperation-favouring linking equilibrium.',
      params: { q: 0.50, b: 5, c: 1, beta: 0.05, init_C: 0.50 },
    },
    {
      id: 'strong-selection',
      name: 'strong selection (β = 2.0)',
      short: 'Strategy updates are near-deterministic copy-better. Imitation outpaces linking; defectors usually win.',
      params: { q: 0.50, b: 5, c: 1, beta: 2.0, init_C: 0.50 },
    },
  ],

  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const initC = params.init_C as number;

    let graph;
    if (topo === 'complete') {
      // Build complete graph K_N. Layout module detects density > 0.4 and
      // skips force-directed iterations, so nodes stay on the initial
      // circular arrangement — visible and not piled at the centroid.
      const adj: number[][] = Array.from({ length: N }, () => []);
      const edges: Array<[number, number]> = [];
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          adj[i]!.push(j);
          adj[j]!.push(i);
          edges.push([i, j]);
        }
      }
      const deg = new Int32Array(N);
      for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
      graph = { N, adj, edges, deg };
    } else {
      const generator = generators[topo];
      if (!generator) throw new Error(`unknown topology: ${topo}`);
      graph = generator(N, k, rng);
    }

    // 0 = D, 1 = C
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < initC ? 1 : 0;

    return { N, d: 1, X, graph, t: 0, step_count: 0 };
  },

  step(state: ModelState, params: ParamValues, rng: RNG): void {
    const b = params.b as number;
    const c = params.c as number;
    const beta = params.beta as number;
    const q = params.q as number;
    const aCC = params.alpha_CC as number;
    const aCD = params.alpha_CD as number;
    const aDD = params.alpha_DD as number;
    const speed = params.speed as number;
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;

    // ~5% of edges per frame at speed=1×: visible motion without overwhelming.
    const ticks = Math.max(1, Math.floor(edges.length * 0.05 * speed));

    for (let t = 0; t < ticks; t++) {
      if (rng.next() < q) {
        // ============ LINKING EVENT ============
        if (edges.length === 0) continue;
        const eIdx = rng.int(edges.length);
        const [i, j] = edges[eIdx]!;
        const xi = X[i]!;
        const xj = X[j]!;

        // Determine break probability by edge type
        let breakProb: number;
        let activeRewirer: number;  // who picks the new partner if edge breaks

        if (xi === 1 && xj === 1) {
          // CC edge — stable, both happy
          breakProb = aCC;
          activeRewirer = rng.next() < 0.5 ? i : j;
        } else if (xi === 0 && xj === 0) {
          // DD edge — fragile, both want better
          breakProb = aDD;
          activeRewirer = rng.next() < 0.5 ? i : j;
        } else {
          // CD edge — C is the dissatisfied party (suffers −c)
          breakProb = aCD;
          activeRewirer = xi === 1 ? i : j;
        }

        if (rng.next() < breakProb) {
          // Remove the edge
          adj[i] = adj[i]!.filter((x) => x !== j);
          adj[j] = adj[j]!.filter((x) => x !== i);
          deg[i]!--;
          deg[j]!--;
          const last = edges[edges.length - 1]!;
          edges[eIdx] = last;
          edges.pop();

          // activeRewirer picks a non-neighbour. Both strategies prefer a
          // *cooperator* as new partner — not symmetric same-type homophily.
          // Reasoning: in the donation-game payoff matrix, C-neighbours
          // dominate D-neighbours for both types:
          //   C wants C: gets b − c   (vs −c with D)
          //   D wants C: gets b       (vs 0  with D)
          // Pacheco's analytical "active linking" framework uses asymmetric
          // formation rates α_CC > α_CD > α_DD; the discrete-event analogue
          // is "everyone prefers C as new partner". This is the asymmetry
          // that drives cooperation rescue: D constantly attempts to invade
          // C-clusters, C constantly evicts D (high α_CD break rate), so D
          // ends up with degraded neighbourhoods and lower π — at which
          // point Fermi imitation flips D to C.
          //
          // The earlier symmetric "same-type homophily" (D prefers D) was
          // wrong: it created a stable bipartition with no CD edges, freezing
          // the color distribution at whatever the initial 50/50 split was
          // (degrees still rewired within each component, but no Fermi
          // events fired because C and D were never neighbours).
          const preferredType = 1;  // always C
          let kk = -1;
          for (let attempts = 0; attempts < 30; attempts++) {
            const cand = rng.int(N);
            if (cand === activeRewirer) continue;
            if (X[cand] !== preferredType) continue;
            if (adj[activeRewirer]!.includes(cand)) continue;
            kk = cand;
            break;
          }
          // Fallback: if no same-type partner found in 30 tries, accept any
          // non-neighbour. Prevents the rewirer from getting stuck when its
          // preferred type is rare.
          if (kk < 0) {
            for (let attempts = 0; attempts < 30; attempts++) {
              const cand = rng.int(N);
              if (cand === activeRewirer) continue;
              if (adj[activeRewirer]!.includes(cand)) continue;
              kk = cand;
              break;
            }
          }
          if (kk >= 0) {
            adj[activeRewirer]!.push(kk);
            adj[kk]!.push(activeRewirer);
            deg[activeRewirer]!++;
            deg[kk]!++;
            edges.push(activeRewirer < kk ? [activeRewirer, kk] : [kk, activeRewirer]);
          }
        }
      } else {
        // ============ STRATEGY EVENT ============
        // Pick random player i with at least one neighbour
        const ii = rng.int(N);
        const ai = adj[ii]!;
        if (ai.length === 0) continue;
        const jj = ai[rng.int(ai.length)]!;

        // If they already have the same strategy, nothing to copy
        if (X[ii] === X[jj]) {
          state.step_count++;
          continue;
        }

        // Compute average payoff per game (degree-normalised).
        // Without normalisation, BA hubs accumulate payoff ~ deg, which makes
        // β·(π_i − π_j) ≫ 1 even for moderate β. Fermi imitation becomes
        // near-deterministic and finishes propagating the hub's initial
        // strategy across the whole network in the first ~50 events — long
        // before linking dynamics can act. Normalising by degree keeps β·Δπ
        // at O(c) regardless of where in the degree distribution the players
        // sit, which is the regime where the active-linking effects Pacheco
        // 2006 describes are actually visible.
        //
        //   π_C(per game) = (#C neighbours · b − deg · c) / deg = (#C/deg)·b − c
        //   π_D(per game) = #C neighbours · b / deg            = (#C/deg)·b
        //
        // Equivalent to the donation-game payoff with neighbours sampled
        // uniformly: cooperators pay c per game, defectors pay nothing,
        // both gain b per C-neighbour interaction.
        let cN_i = 0;
        for (let p = 0; p < ai.length; p++) if (X[ai[p]!] === 1) cN_i++;
        const aj = adj[jj]!;
        let cN_j = 0;
        for (let p = 0; p < aj.length; p++) if (X[aj[p]!] === 1) cN_j++;

        const di = ai.length;
        const dj = aj.length;
        const pi_i = di === 0 ? 0 : (X[ii] === 1 ? (cN_i * b) / di - c : (cN_i * b) / di);
        const pi_j = dj === 0 ? 0 : (X[jj] === 1 ? (cN_j * b) / dj - c : (cN_j * b) / dj);

        // Fermi imitation: i adopts j's strategy with probability
        //   1 / (1 + exp(β · (π_i − π_j)))
        const pAdopt = 1 / (1 + Math.exp(beta * (pi_i - pi_j)));
        if (rng.next() < pAdopt) {
          X[ii] = X[jj]!;
        }
      }

      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      // C = blue, D = red — matches the project's voter / adaptive-SIS convention
      return state.X[i] === 1 ? '#2c5fbf' : '#e63946';
    },
    nodeSize(state: ModelState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  observe: {
    timeSeries: {
      label: 'fraction cooperators',
      value(state: ModelState): number {
        let count = 0;
        for (let i = 0; i < state.N; i++) if (state.X[i] === 1) count++;
        return count / state.N;
      },
    },
    timeSeries2: {
      label: 'fraction CC edges',
      value(state: ModelState): number {
        const { X, graph } = state;
        const edges = graph.edges;
        if (edges.length === 0) return 0;
        let cc = 0;
        for (let e = 0; e < edges.length; e++) {
          const [i, j] = edges[e]!;
          if (X[i] === 1 && X[j] === 1) cc++;
        }
        return cc / edges.length;
      },
    },
  },
};

export default pacheco;
