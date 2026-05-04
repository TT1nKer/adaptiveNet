// Pacheco, Traulsen & Nowak (2006). "Coevolution of strategy and structure in
// complex networks with dynamical linking." Phys. Rev. Lett. 97, 258103.
// PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC2430061/
//
// THIS FILE WAS REWRITTEN 2026-05-04 AGAINST THE ACTUAL PAPER. The previous
// versions (v1, v2, v3) were "Pacheco-flavoured" PD-on-network models written
// from training prior without consulting the paper, and produced quantitatively
// and qualitatively wrong dynamics. The user pushed back and required paper
// fetch + faithful reimplementation. Specifically what was wrong:
//   - Variable names: "alpha_XY" was a per-edge-type *breaking* probability;
//     in the paper, α is per-node formation rate and γ is per-edge-type
//     breaking rate. They are TWO SEPARATE rates, not one.
//   - Linking dynamics: the previous versions had only "break events", with
//     formation happening implicitly via random rewiring. The paper has
//     explicit formation events (rate α_i·α_j on disconnected pairs) AND
//     breaking events (rate γ_ij on existing edges) as two independent CTMC
//     event streams.
//   - Strategy update: the previous versions picked a node and a random
//     neighbour. The paper picks two random members of the population
//     (not necessarily neighbours).
//   - Defaults: previous (b=5, c=1, β=0.5, BA initial). Paper Fig 3
//     example: (b=1, c=0.5, β=0.1, α_C=α_D=0.4, γ_CC=0.1, γ_CD=0.8,
//     γ_DD=0.32, K_N initial, 50% cooperators) → cooperators fixate.
//
// The paper's mechanism (Section "Active Linking" + Eqs. for X_ij, φ_ij):
//
//   1. Each node i has a "linking propensity" α_i (= α_C if i is a cooperator,
//      α_D if defector). It's a per-node formation rate.
//   2. Each EDGE TYPE has a breaking rate γ_ij (γ_CC, γ_CD, γ_DD). Edge
//      lifetime = 1/γ_ij.
//   3. Per simulation tick (continuous-time approximation): with rate equal
//      to total formation + total breaking, sample one event. Formation: pick
//      disconnected pair (i, j), form edge with rate α_i·α_j. Breaking: pick
//      existing edge (i, j), break with rate γ_ij.
//   4. Strategy update: at rate W (relative to AL rate), pick two random
//      individuals A and B (NOT necessarily adjacent). B adopts A's strategy
//      with probability p = 1/(1 + exp(−β·(f_A − f_B))). The Fermi rule.
//      f_A is A's fitness from games with its neighbours.
//   5. PD payoffs: C-C: each (b−c). C-D: C gets −c, D gets b. D-D: 0.
//
//   The mean-field equilibrium link density per type:
//     φ_ij = α_i·α_j / (α_i·α_j + γ_ij)
//   With α_C = α_D = 0.4 and the γ values above:
//     φ_CC = 0.16/0.26 ≈ 0.615    (CC pairs are linked 61.5% of the time)
//     φ_CD = 0.16/0.96 ≈ 0.167    (CD pairs ~16.7% — cooperators rarely
//                                  exposed to defectors)
//     φ_DD = 0.16/0.48 ≈ 0.333    (DD pairs ~33.3%)
//   This asymmetric link density is what produces cooperation rescue: in the
//   fast-AL limit, cooperators play mostly with cooperators (high φ_CC) and
//   rarely with defectors (low φ_CD); their fitness exceeds defectors';
//   Fermi imitation drives D → C.
//
// Acceptance test (paper Fig 2b / Fig 3): with the paper's parameter values
// above and 50% initial C on K_100, cooperators should approach near-100%
// fixation. In the previous v3, parameters were too far off and the behaviour
// was qualitatively different.

import { generators, buildComplete } from '../graph.ts';
import type { Graph, Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['complete', 'ba', 'er'] as const;

const pacheco: Model = {
  id: 'pacheco-2006',
  name: 'Coevolving Cooperation (Pacheco–Traulsen–Nowak)',
  name_zh: '共演化合作博弈 (Pacheco–Traulsen–Nowak)',
  short:
    'Active linking on prisoner\'s dilemma. Edges form at rate α_i·α_j and break at rate γ_ij. Cooperators end up linked mostly to cooperators (high φ_CC) and rarely to defectors (low φ_CD); cooperation can fixate even with a deeply unfavourable b/c.',
  short_zh:
    '囚徒困境 + active linking。边按 α_i·α_j 速率形成、按 γ_ij 速率断开。合作者最终主要与合作者相连（φ_CC 高），与背叛者很少相连（φ_CD 低）；即使 b/c 不利，合作仍能固化。',

  long: `Each node is a Cooperator (blue) or Defector (red). The PD payoff is the donation game: C-C each gets b−c; C-D the cooperator gets −c, the defector b; D-D each gets 0.

Two independent processes happen at adjustable rates:

— **Active Linking (AL)**: every disconnected pair (i, j) forms an edge at rate **α_i · α_j**, where α_C is the formation rate of cooperators and α_D of defectors. Every existing edge of type ij breaks at rate **γ_ij** (γ_CC for cooperator–cooperator, γ_CD for mixed, γ_DD for defector–defector). Edge lifetime equals 1/γ_ij.

— **Strategy update**: two players A and B are picked at random from the population (not necessarily adjacent). B adopts A's strategy with probability 1/(1 + exp(−β·(f_A − f_B))) — the Fermi rule. Fitness f_X is the average payoff X receives across its neighbours.

The relative speed of the two processes is set by **W = T_s / T_a** (strategy timescale over linking timescale). Per simulation tick, the system runs an AL event with probability W/(W+1) and a strategy event with probability 1/(W+1). When W is large, AL is fast: link densities reach the equilibrium φ_ij = α_i·α_j / (α_i·α_j + γ_ij) before strategies have time to drift.

The paper's central result (Fig 2b, Fig 3): with γ_CD ≫ γ_CC (cooperator–defector edges break much faster than cooperator–cooperator), the equilibrium link density φ_CD is small — cooperators are mostly insulated from defectors and play almost exclusively with each other. The standard PD result that defectors win on a fixed graph **inverts**: cooperators fixate.

**Default parameters reproduce the paper's Fig 2b**: b=1, c=0.5, β=0.1, α_C=α_D=0.4, γ_CC=0.1, γ_CD=0.8, γ_DD=0.32, W=4, N=100, K_N initial, 50% C. With these, cooperators should fixate within ~10–30 seconds of simulated time at the default speed.

**Things to try**

— Drop **W** to 0.1 (preset *strategy fast*): linking is too slow to insulate cooperators; defectors win, recovering the static-PD result.
— Raise **γ_CD** while keeping γ_CC low (preset *strong asymmetry*): cooperator–defector edges become extremely short-lived; cooperation fixates faster.
— Set **β** to 2 (preset *strong selection*): Fermi imitation becomes near-deterministic; outcome more sensitive to initial conditions.
— Switch to **BA** or **ER** initial topology: the paper uses K_N but the dynamics still hold qualitatively for sparse initial graphs as long as the AL process has time to reshape the link density toward φ_ij.

Reference: Pacheco, Traulsen & Nowak, *Coevolution of strategy and structure in complex networks with dynamical linking*, **Phys. Rev. Lett.** 97, 258103 (2006). [doi:10.1103/PhysRevLett.97.258103](https://doi.org/10.1103/PhysRevLett.97.258103). Open-access PMC: [PMC2430061](https://pmc.ncbi.nlm.nih.gov/articles/PMC2430061/).`,

  long_zh: `每个节点是合作者（蓝）或背叛者（红）。PD 收益用捐赠博弈：C-C 各得 b−c；C-D 中合作者得 −c，背叛者得 b；D-D 各得 0。

两个独立过程按可调速率发生：

— **Active Linking (AL)**：每对未相连的 (i, j) 以速率 **α_i · α_j** 形成边（α_C 是合作者的形成速率，α_D 是背叛者的）。每条 ij 类型的现存边以速率 **γ_ij** 断开（γ_CC 对应 C-C，γ_CD 混合，γ_DD 对应 D-D）。边的寿命等于 1/γ_ij。

— **策略更新**：从总群体中随机选两个玩家 A、B（**不必相邻**）。B 以概率 1/(1 + exp(−β·(f_A − f_B))) 采纳 A 的策略——Fermi 规则。适应度 f_X 是 X 与邻居博弈的平均收益。

两个过程的相对速度由 **W = T_s / T_a**（策略时间尺度 / linking 时间尺度）决定。每一仿真 tick，系统以概率 W/(W+1) 跑 AL 事件，以概率 1/(W+1) 跑策略事件。W 很大时 AL 很快：边密度在策略漂移之前就达到了均衡值 φ_ij = α_i·α_j / (α_i·α_j + γ_ij)。

论文的核心结论（Fig 2b、Fig 3）：当 γ_CD ≫ γ_CC（合作者-背叛者边比合作者-合作者边断得快得多）时，均衡边密度 φ_CD 很小——合作者大体上与背叛者隔离，主要相互博弈。"固定图 PD 上背叛者获胜"的标准结果**反转**：合作者固化。

**默认参数复现论文 Fig 2b**：b=1, c=0.5, β=0.1, α_C=α_D=0.4, γ_CC=0.1, γ_CD=0.8, γ_DD=0.32, W=4, N=100, K_N 起始，50% C。这些设置下，合作者应在 default speed 下约 10–30 秒模拟时间内固化。

**尝试**

— 把 **W** 降到 0.1（预设 *strategy fast*）：linking 太慢无法隔离合作者；背叛者获胜，回到静态 PD 结果。
— 在 γ_CC 低的情况下提高 **γ_CD**（预设 *strong asymmetry*）：C-D 边极短命；合作更快固化。
— 把 **β** 设到 2（预设 *strong selection*）：Fermi imitation 接近确定性；结果对初始条件更敏感。
— 切换到 **BA** 或 **ER** 初始拓扑：论文用 K_N，但只要 AL 过程有时间把边密度重塑到 φ_ij，稀疏初始图上动力学仍定性成立。

参考文献：Pacheco, Traulsen & Nowak, *Coevolution of strategy and structure in complex networks with dynamical linking*, **Phys. Rev. Lett.** 97, 258103 (2006). [doi:10.1103/PhysRevLett.97.258103](https://doi.org/10.1103/PhysRevLett.97.258103)。开放获取 PMC: [PMC2430061](https://pmc.ncbi.nlm.nih.gov/articles/PMC2430061/)。

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/issues) 中反馈或直接修改 src/models/pacheco-2006.ts 中的 long_zh 字段。]*`,

  params: {
    // PD payoffs (paper Fig 2b defaults)
    b:        { label: 'b (benefit)',         min: 0.1,  max: 5,    step: 0.05, default: 1.0,  live: true },
    c:        { label: 'c (cost)',            min: 0.05, max: 4,    step: 0.05, default: 0.5,  live: true },
    // Selection strength (paper: β = 0.1, weak selection)
    beta:     { label: 'β (selection)',       min: 0.01, max: 5,    step: 0.01, default: 0.1,  live: true },
    // AL parameters — separate formation rate α (per-node) and breaking rate γ (per-edge-type).
    // Paper's example: α_C = α_D = 0.4 (per-node linking propensity; can differ between strategies).
    alpha_C:  { label: 'α_C (C linking rate)', min: 0,    max: 1,    step: 0.01, default: 0.4,  live: true },
    alpha_D:  { label: 'α_D (D linking rate)', min: 0,    max: 1,    step: 0.01, default: 0.4,  live: true },
    // Edge breaking rates (per edge type, paper's γ_ij).
    gamma_CC: { label: 'γ_CC (CC break)',     min: 0,    max: 2,    step: 0.01, default: 0.1,  live: true },
    gamma_CD: { label: 'γ_CD (CD break)',     min: 0,    max: 5,    step: 0.01, default: 0.8,  live: true },
    gamma_DD: { label: 'γ_DD (DD break)',     min: 0,    max: 2,    step: 0.01, default: 0.32, live: true },
    // Timescale ratio W = T_s / T_a. W large = linking fast = link density approaches φ_ij quickly.
    W:        { label: 'W = T_s / T_a',       min: 0.01, max: 100,  step: 0.01, default: 4.0,  live: true },
    init_C:   { label: 'initial C fraction',  min: 0.05, max: 0.95, step: 0.01, default: 0.5,  live: false },
    N:        { label: 'nodes',               min: 50,   max: 500,  step: 10,   default: 100,  live: false },
    k:        { label: 'avg degree (BA/ER only)', min: 2,  max: 14, step: 1,    default: 6,    live: false },
    topo:     { label: 'initial topology',    options: TOPO_OPTS,   default: 'complete',       live: false },
    speed:    { label: 'speed',               min: 0.1,  max: 10,   step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'paper-fig2b',
      name: 'paper Fig 2b (default)',
      short: 'Exactly the parameters from PRL 97 258103 Fig 2b. Cooperators fixate within ~30s simulated.',
      params: { b: 1, c: 0.5, beta: 0.1, alpha_C: 0.4, alpha_D: 0.4, gamma_CC: 0.1, gamma_CD: 0.8, gamma_DD: 0.32, W: 4, init_C: 0.5, N: 100, topo: 'complete' },
    },
    {
      id: 'strategy-fast',
      name: 'strategy fast (W = 0.1)',
      short: 'Linking is much slower than strategy update. Cooperators have no time to insulate via AL — defectors win, recovering the static-PD result.',
      params: { W: 0.1 },
    },
    {
      id: 'strong-asymmetry',
      name: 'strong asymmetry (γ_CD = 2.0)',
      short: 'CD edges break extremely fast. Cooperators almost never coexist with defectors as neighbours; cooperation fixates rapidly.',
      params: { gamma_CD: 2.0, W: 4 },
    },
    {
      id: 'strong-selection',
      name: 'strong selection (β = 2.0)',
      short: 'Fermi imitation near-deterministic copy-better. Outcome highly sensitive to initial fitness gradient.',
      params: { beta: 2.0 },
    },
    {
      id: 'symmetric-gamma',
      name: 'no AL asymmetry (γ_CC = γ_CD = γ_DD)',
      short: 'All breaking rates equal — equivalent to a static random graph. Defectors win as in classical PD.',
      params: { gamma_CC: 0.4, gamma_CD: 0.4, gamma_DD: 0.4 },
    },
  ],

  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const initC = params.init_C as number;

    let graph: Graph;
    if (topo === 'complete') {
      graph = buildComplete(N);
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
    const alphaC = params.alpha_C as number;
    const alphaD = params.alpha_D as number;
    const gammaCC = params.gamma_CC as number;
    const gammaCD = params.gamma_CD as number;
    const gammaDD = params.gamma_DD as number;
    const W = params.W as number;
    const speed = params.speed as number;
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;

    // Per tick choose: AL event (prob W/(W+1)) or strategy event (prob 1/(W+1)).
    // Number of ticks per frame scales with speed; linking-event rate scales with N²
    // (could-be pairs); strategy with 1; we set ticks ≈ N² × 0.001 × speed for visible
    // dynamics on default N=100.
    const ticksPerFrame = Math.max(1, Math.floor(N * N * 0.001 * speed));
    const linkProb = W / (W + 1);

    for (let t = 0; t < ticksPerFrame; t++) {
      if (rng.next() < linkProb) {
        // ===== AL event: pick a random ordered pair (i, j) ≠ self =====
        const i = rng.int(N);
        let j = rng.int(N);
        if (j === i) j = (j + 1) % N;
        const xi = X[i]!;
        const xj = X[j]!;

        // Test connectivity. O(deg) — acceptable for moderate N. For larger N
        // a Set or a bitmap would be needed.
        const connected = adj[i]!.includes(j);

        if (connected) {
          // Try breaking with rate γ_ij. Per-tick probability is γ_ij (clamped
          // to ≤ 1; faster events would need finer time discretisation).
          const gamma = (xi === xj)
            ? (xi === 1 ? gammaCC : gammaDD)
            : gammaCD;
          if (rng.next() < gamma) {
            // remove edge (i, j)
            adj[i] = adj[i]!.filter((x) => x !== j);
            adj[j] = adj[j]!.filter((x) => x !== i);
            deg[i]!--;
            deg[j]!--;
            // swap-pop on edges array
            const ii = i < j ? i : j;
            const jj = i < j ? j : i;
            for (let e = 0; e < edges.length; e++) {
              const [a, bb] = edges[e]!;
              if (a === ii && bb === jj) {
                edges[e] = edges[edges.length - 1]!;
                edges.pop();
                break;
              }
            }
          }
        } else {
          // Try forming with rate α_i · α_j.
          const ai = xi === 1 ? alphaC : alphaD;
          const aj = xj === 1 ? alphaC : alphaD;
          if (rng.next() < ai * aj) {
            // add edge (i, j)
            adj[i]!.push(j);
            adj[j]!.push(i);
            deg[i]!++;
            deg[j]!++;
            edges.push(i < j ? [i, j] : [j, i]);
          }
        }
      } else {
        // ===== Strategy event: pick two random members of the population =====
        // Paper: A and B are *random*, not necessarily adjacent. B adopts A's
        // strategy with Fermi probability based on relative fitness.
        const A = rng.int(N);
        let B = rng.int(N);
        if (B === A) B = (B + 1) % N;
        if (X[A] === X[B]) continue;  // same strategy, no observable change

        // Fitness: average payoff per neighbour (degree-normalised).
        const f_A = fitness(A, X, adj, b, c);
        const f_B = fitness(B, X, adj, b, c);

        // p = 1 / (1 + exp(-β · (f_A − f_B)))  — paper's Fermi rule
        const p = 1 / (1 + Math.exp(-beta * (f_A - f_B)));
        if (rng.next() < p) {
          X[B] = X[A]!;
        }
      }

      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
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

// Average payoff per neighbour — degree-normalised to keep β·Δf bounded
// independent of degree heterogeneity.
//   f_C(per game) = (#C neighbours · b − deg · c) / deg = (#C/deg)·b − c
//   f_D(per game) = (#C neighbours · b) / deg            = (#C/deg)·b
function fitness(i: number, X: Float64Array, adj: number[][], b: number, c: number): number {
  const ai = adj[i]!;
  const di = ai.length;
  if (di === 0) return 0;
  let cN = 0;
  for (let p = 0; p < ai.length; p++) if (X[ai[p]!] === 1) cN++;
  if (X[i] === 1) {
    return (cN * b) / di - c;
  } else {
    return (cN * b) / di;
  }
}

export default pacheco;
