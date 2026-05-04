// Modern Hopfield Network (Ramsauer et al., 2020).
//
// Same substrate as the classical Hopfield demo — N binary nodes, P stored
// patterns trained Hebbian-style — but with a different energy function:
//
//   E_modern(X) = -1/β · log Σ_p exp(β · ξ_p · X)
//
// Equivalently, the retrieval rule is
//
//   X_new = sign( Σ_p softmax(β · ξ_p · X) · ξ_p )
//
// — compute overlap with each stored pattern, softmax with inverse
// temperature β, then sum the patterns weighted by softmax. The new state
// is the sign of that weighted sum.
//
// Two consequences:
//
// 1. Storage capacity jumps from α_c ≈ 0.138·N (classical, see the
//    Hopfield Capacity demo) to **exponential in N**. At sufficiently high
//    β the softmax sharpens to nearly one-hot, so retrieval picks the
//    single nearest pattern — and that works for exponentially many
//    patterns as long as none lie pathologically close.
//
// 2. The retrieval rule IS Transformer attention. Identify Ξ (matrix of
//    stored patterns) with the keys/values, X with the query, β with
//    1/√d_k. One step of Modern Hopfield = one attention layer.
//
// This is the math underneath why Transformer attention has the recall
// power that classical neural nets can't reach.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

interface ModernState extends ModelState {
  patterns: Float64Array[];   // P stored patterns, length N each
  targetPattern: number;      // always 0 — we recall pattern[0]
  alpha: number;              // P / N
}

function emptyGraph(N: number): Graph {
  return {
    N,
    adj: Array.from({ length: N }, () => []),
    edges: [],
    deg: new Int32Array(N),
  };
}

function randomPattern(N: number, rng: RNG): Float64Array {
  const X = new Float64Array(N);
  for (let i = 0; i < N; i++) X[i] = rng.next() < 0.5 ? 1 : -1;
  return X;
}

const modernHopfield: Model<ModernState> = {
  id: 'hopfield-modern',
  name: 'Modern Hopfield (Attention-Equivalent)',
  short: 'Replace classical Hopfield\'s quadratic energy with log-sum-exp. Capacity jumps from 0.138·N to exponential, and the retrieval rule becomes Transformer attention.',
  name_zh: '现代 Hopfield (注意力等价)',
  short_zh: '把经典 Hopfield 的二次能量替换成 log-sum-exp。容量从 0.138·N 跳到 N 中指数级，且检索规则就是 Transformer 注意力（Ramsauer 等 2020）。从 1982 PNAS 到 ChatGPT 的桥梁。',
  long_zh: `**经典 Hopfield** (检索和容量两个 demo) 通过 Hebb 外积存储图样、用 sign(W·X) 检索。容量上限是 α_c ≈ 0.138·N——多存就进入自旋玻璃相，记忆被洗掉。

**现代 Hopfield** (Ramsauer 等 2020) 保留同样的底层但用

E(X) = −1/β · log Σ_p exp(β · ξ_p · X)

给出检索规则

X_new = sign( Σ_p softmax(β · ξ_p · X) · ξ_p )

用文字表述：先计算与每个存储图样的重叠度；用反温度 β 应用 softmax；按 softmax 值给每个图样加权；求和；取符号。两件事随之而来。

**(1) 容量在 N 中指数级。** 当 β 大时，softmax 锐化到几乎 one-hot——检索挑选*单个最近*的图样。只要没有图样病态地聚在一起，这对指数多个图样都成立。经典的 α_c = 0.138 上限消失了。

**(2) 这就是 Transformer 注意力。** 对应：

  Ξ (存储图样矩阵) ↔ keys / values
  X (当前状态)     ↔ query
  β                ↔ 1/√d_k

现代 Hopfield 的一步 = 注意力的一层。注意力的强检索容量**就是**这个 Hopfield 变体的强存储容量。

**试预设**遍历经典 Hopfield 到不了的区域。P=200 已经超过经典 α_c=0.138——经典容量 demo 在那里崩溃；现代版仍清晰检索。P=1000 加 N=1024 是 α≈1.0，是经典上限的十倍，仍工作。

**降低 β** 软化 softmax——检索变成图样的*加权混合*而非最近的那个。这就是低温度注意力做的事，也是经典 Hopfield 的伪混合态在这里以可控方式出现的方式。

**教师向 — 五道 Δ 实验适合作为习题**

**1. 容量对比：经典 vs 现代。** 在 N = 100 下，在经典 Hopfield (用 *Hopfield 容量* demo) 中尽可能多地存储图样——容量在 α_c × N ≈ 14 个图样附近见顶。在现代 Hopfield 中重复：检索崩溃前能存多少？论证为何"在 N 中指数级"和"在 N 中线性"对记忆容量来说是定性不同的。

**2. 反温度 β。** 现代 Hopfield 的 softmax 有一个温度参数 β。β → 0 时能量均匀 (没有图样偏好)；β → ∞ 时动力学行为像经典 (尖锐图样边界)。扫描 β。找到混合图样检索 ("软注意力"态) 出现的区域。这个区域就是 transformer 运行的地方。

**3. 验证注意力等价。** 现代 Hopfield 检索 (一步) 计算 z_new = X · softmax(β · X^T · z)。与 transformer 注意力按项比较：query = z, keys = values = X。确认两个公式相同。这就是"注意力**就是** Hopfield 检索"的精确含义。

**4. 存储图样叠加。** 从两个存储图样的平均出发。在经典 Hopfield 中，网络通常落入伪混合态。在现代 Hopfield 中 (高 β)，会发生什么？挑一个还是停在混合？这与 Ramsauer 关于"现代 Hopfield 可以根据 β 表现为尖锐记忆或软注意力池"的观察相关。

**5. Transformer 不"只是" Hopfield。** 现代 Hopfield 是一个用存储图样作为 keys/values 的注意力头。完整 transformer 有*学习的* keys 和 values，*多个*头，注意力间还有前馈层。列出完整 transformer 能做、单个现代 Hopfield 头不能做的三种具体能力。(这是为了给热度找地基：等价是真的，但不意味着现代 Hopfield = transformer。)

参考文献：Ramsauer 等, *Hopfield Networks Is All You Need*, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217) (2020).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/hopfield-modern.ts 中的 long_zh 字段。]*`,
  long: `**Classical Hopfield** (the recall and capacity demos) stores patterns by Hebbian outer products and retrieves by sign(W·X). Capacity tops out at α_c ≈ 0.138·N — try to store more, the spin-glass phase wipes the memory.

**Modern Hopfield** (Ramsauer et al. 2020) keeps the same substrate but uses

E(X) = −1/β · log Σ_p exp(β · ξ_p · X)

which gives the retrieval rule

X_new = sign( Σ_p softmax(β · ξ_p · X) · ξ_p )

In words: compute overlap with each stored pattern; apply softmax with inverse temperature β; weight each pattern by its softmax value; sum; take signs. Two things follow.

**(1) Capacity is exponential in N.** When β is large, softmax sharpens to nearly one-hot — retrieval picks the *single nearest* pattern. That works for exponentially many patterns as long as none cluster pathologically close. The classical α_c = 0.138 limit dissolves.

**(2) This is Transformer attention.** Identify

  Ξ (stored patterns matrix) ↔ keys / values
  X (current state)           ↔ query
  β                            ↔ 1/√d_k

One step of Modern Hopfield = one attention layer. The strong recall capacity of attention IS the strong storage capacity of this Hopfield variant.

**Try the presets** to walk through the regime classical Hopfield can't reach. P=200 is past the classical α_c=0.138 — the classical capacity demo collapses there; the modern version still recalls cleanly. P=1000 with N=1024 is α≈1.0, ten times past classical's limit, and it still works.

**Lowering β** softens the softmax — retrieval becomes a weighted *mixture* of patterns rather than the closest one. This is what attention with low temperature does, and it's how classical Hopfield's spurious mixed states show up here in a controllable way.

**For instructors — five Δ-experiments suitable for problem sets**

**1. Capacity comparison: classical vs modern.** At N = 100, store as many patterns as you can in classical Hopfield (use the *Hopfield Capacity* demo) — capacity tops out near α_c × N ≈ 14 patterns. Repeat in modern Hopfield: how many patterns can you store before recall breaks? Argue why "exponential in N" is qualitatively different from "linear in N" for memory capacity.

**2. Inverse temperature β.** Modern Hopfield's softmax has a temperature parameter β. At β → 0 the energy is uniform (no preference for any pattern); at β → ∞ the dynamics behave classically (sharp pattern boundaries). Sweep β. Find the regime where mixed-pattern retrieval (a "soft attention" state) appears. This regime is what transformers operate in.

**3. Attention equivalence — verify.** Modern Hopfield retrieval (one update step) computes z_new = X · softmax(β · X^T · z). Compare term-by-term with transformer attention: query = z, keys = values = X. Confirm the two formulas are identical. This is the precise meaning of "attention IS Hopfield retrieval".

**4. Stored-pattern superposition.** Initialize from the average of two stored patterns. In classical Hopfield, the network usually falls into a spurious mixed state. In modern Hopfield (high β), what happens? Does it pick one or stay in the mixture? This relates to Ramsauer's observation that modern Hopfield can act as either a sharp memory or a soft attention pool depending on β.

**5. Why the transformer is not "just" Hopfield.** Modern Hopfield is one attention head with stored patterns as keys/values. A transformer has *learned* keys and values *and* multiple heads *and* feed-forward layers between attention. List three concrete capabilities of a full transformer that a single modern-Hopfield head cannot replicate. (This is meant to ground the hype: the equivalence is real, but it does not mean modern Hopfield = transformer.)

Reference: Ramsauer et al., *Hopfield Networks Is All You Need*, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217) (2020).`,

  view: 'grid',

  params: {
    num_patterns: { label: 'P (num patterns)',  min: 2,   max: 1000, step: 1,    default: 200,  live: false },
    beta:         { label: 'β (sharpness)',     min: 0.1, max: 50,   step: 0.1,  default: 10.0, live: true },
    noise:        { label: 'cue noise',         min: 0,   max: 1,    step: 0.01, default: 0.30, live: false },
    size:         { label: 'grid size',         min: 16,  max: 48,   step: 8,    default: 32,   live: false },
    speed:        { label: 'speed',             min: 0.1, max: 5,    step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'classical-equivalent',
      name: 'classical-equivalent (α=0.05)',
      short: 'P=50 patterns, α=0.049. Classical handles this; modern handles this trivially with high β. Baseline comparison.',
      params: { num_patterns: 50, beta: 10, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'past-classical-limit',
      name: 'past classical α_c (α=0.20)',
      short: 'P=200, α=0.196 — classical Hopfield collapses here (see hopfield-capacity spin-glass preset). Modern recalls perfectly with β=10. Side-by-side comparison: open the classical capacity demo with the same P.',
      params: { num_patterns: 200, beta: 10, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'massive-capacity',
      name: 'massive capacity (α=1.0)',
      short: 'P=1024 patterns in N=1024 cells, α≈1.0. Ten times past classical α_c. Modern Hopfield with β=20 still recalls. The capacity that makes Transformer attention practical.',
      params: { num_patterns: 1024, beta: 20, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'low-temperature',
      name: 'low temperature β=1 (mixture states)',
      short: 'Low β → soft softmax → multiple patterns blend in the retrieval. Output is a mixture (weighted average of nearby patterns). This is what attention with low temperature does. Recall becomes "average of nearby memories" rather than "the nearest one".',
      params: { num_patterns: 100, beta: 1.0, noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'high-temperature',
      name: 'high temperature β=30 (sharp recall)',
      short: 'Very high β → softmax is essentially one-hot → exact retrieval of the single nearest pattern. The infinite-capacity limit in spirit; the system always nails the closest pattern even with many stored.',
      params: { num_patterns: 500, beta: 30, noise: 0.3, size: 32 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): ModernState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const P = Math.max(1, Math.round(params.num_patterns as number));
    const noise = params.noise as number;

    const patterns: Float64Array[] = [];
    for (let p = 0; p < P; p++) patterns.push(randomPattern(N, rng));

    const target = patterns[0]!;
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      X[i] = rng.next() < noise ? -target[i]! : target[i]!;
    }

    return {
      N,
      d: 1,
      X,
      graph: emptyGraph(N),
      t: 0,
      step_count: 0,
      cols: size,
      rows: size,
      patterns,
      targetPattern: 0,
      alpha: P / N,
    };
  },

  step(state: ModernState, params: ParamValues, rng: RNG): void {
    const { N, X, patterns } = state;
    const P = patterns.length;
    const beta = params.beta as number;
    const speed = params.speed as number;

    const aux = state as ModernState & {
      _overlaps?: Float64Array;
      _Xtarget?: Float64Array;
    };
    if (!aux._overlaps || aux._overlaps.length !== P) aux._overlaps = new Float64Array(P);
    if (!aux._Xtarget || aux._Xtarget.length !== N) aux._Xtarget = new Float64Array(N);
    const overlaps = aux._overlaps;
    const X_target = aux._Xtarget;

    // Step 1: compute overlap with each pattern  a_p = (1/N) Σ_i ξ_p[i] · X[i]
    for (let p = 0; p < P; p++) {
      let s = 0;
      const pat = patterns[p]!;
      for (let i = 0; i < N; i++) s += pat[i]! * X[i]!;
      overlaps[p] = s / N;
    }

    // Step 2: softmax — w_p = exp(β·a_p) / Σ_q exp(β·a_q), with max-shift
    let maxA = -Infinity;
    for (let p = 0; p < P; p++) if (overlaps[p]! > maxA) maxA = overlaps[p]!;
    let sum = 0;
    for (let p = 0; p < P; p++) {
      const e = Math.exp(beta * (overlaps[p]! - maxA));
      overlaps[p] = e;
      sum += e;
    }
    const invSum = 1 / sum;
    for (let p = 0; p < P; p++) overlaps[p] = overlaps[p]! * invSum;

    // Step 3: X_target[i] = sign( Σ_p w_p · ξ_p[i] )
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let p = 0; p < P; p++) s += overlaps[p]! * patterns[p]![i]!;
      X_target[i] = s >= 0 ? 1 : -1;
    }

    // Step 4: gradually move X toward X_target via async cell updates,
    // so the user can see the convergence animate (instead of one frame).
    const updatesPerFrame = Math.max(1, ((N / 32) * speed) | 0);
    for (let s = 0; s < updatesPerFrame; s++) {
      const i = rng.int(N);
      X[i] = X_target[i]!;
    }

    state.step_count++;
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModernState, i: number): string {
      return state.X[i]! > 0 ? '#e8edf4' : '#1a1f2a';
    },
    nodeSize(): number {
      return 1;
    },
  },

  observe: {
    histogram: {
      label: 'spin distribution',
      range: [-1, 1],
      bins: 2,
      values(state: ModernState): Float64Array {
        return state.X;
      },
    },
    timeSeries: {
      label: 'σ = overlap with target pattern',
      value(state: ModernState): number {
        const N = state.N;
        const target = state.patterns[state.targetPattern]!;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i]! * target[i]!;
        return s / N;
      },
    },
  },
};

export default modernHopfield;
