// Hopfield (PNAS 79, 2554, 1982): a content-addressable memory built from
// a recurrent network with Hebbian-learned symmetric weights.
//
// Each of the K stored patterns ξ_p ∈ {-1, +1}^N becomes a fixed point of
// the synchronous dynamics X[t+1, i] = sign(Σ_j W[i, j] · X[t, j]) when the
// weight matrix is set to the Hebbian rule
//
//     W[i, j] = (1 / N) Σ_p ξ_p[i] · ξ_p[j]   (with W[i, i] = 0)
//
// Starting from a noisy / partial cue, the dynamics flow downhill in the
// associated energy landscape and converge to the nearest stored pattern.
// This is the simplest concrete realisation of the "fast weight programmer"
// substrate idea — patterns live in W, retrieval is a sparse matvec on X.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

const PATTERN_NAMES = ['X', 'O', '+', '◻'] as const;
type PatternName = (typeof PATTERN_NAMES)[number];

interface HopfieldState extends ModelState {
  W: Float64Array;        // length N*N, row-major, dense
  patterns: Float64Array[];
  targetPattern: number;  // index into patterns[] — what we expect to recall
}

// ---------- pattern bitmaps ----------
function patternX(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const t = Math.max(1, (size / 16) | 0);
  for (let i = 0; i < size; i++) {
    for (let dt = -t; dt <= t; dt++) {
      const j1 = i + dt;
      const j2 = size - 1 - i + dt;
      if (j1 >= 0 && j1 < size) X[i * size + j1] = 1;
      if (j2 >= 0 && j2 < size) X[i * size + j2] = 1;
    }
  }
  return X;
}

function patternO(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const r = size / 3;
  const t = Math.max(1.2, size / 16);
  for (let r0 = 0; r0 < size; r0++) {
    for (let c0 = 0; c0 < size; c0++) {
      const dx = c0 - cx;
      const dy = r0 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (Math.abs(d - r) < t) X[r0 * size + c0] = 1;
    }
  }
  return X;
}

function patternPlus(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const t = Math.max(1, (size / 8) | 0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (Math.abs(c - cx) < t || Math.abs(r - cy) < t) {
        X[r * size + c] = 1;
      }
    }
  }
  return X;
}

function patternSquare(size: number): Float64Array {
  const X = new Float64Array(size * size);
  X.fill(-1);
  const m = Math.max(2, (size / 8) | 0);
  const t = Math.max(1, (size / 16) | 0);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const onTop = r >= m && r < m + t;
      const onBot = r >= size - m - t && r < size - m;
      const onLft = c >= m && c < m + t;
      const onRgt = c >= size - m - t && c < size - m;
      const inH = c >= m && c < size - m && (onTop || onBot);
      const inV = r >= m && r < size - m && (onLft || onRgt);
      if (inH || inV) X[r * size + c] = 1;
    }
  }
  return X;
}

// ---------- Hebbian training ----------
function hebbianTrain(patterns: Float64Array[], N: number): Float64Array {
  const W = new Float64Array(N * N);
  for (const p of patterns) {
    for (let i = 0; i < N; i++) {
      const pi = p[i]!;
      const off = i * N;
      for (let j = 0; j < N; j++) {
        if (i === j) continue;
        W[off + j] += pi * p[j]!;
      }
    }
  }
  const inv = 1 / N;
  for (let i = 0; i < N * N; i++) W[i] *= inv;
  return W;
}

// Empty graph (no edges). The W matrix lives separately in state.W; the
// `graph` field is only here to satisfy the substrate interface.
function emptyGraph(N: number): Graph {
  return {
    N,
    adj: Array.from({ length: N }, () => []),
    edges: [],
    deg: new Int32Array(N),
  };
}


const PATTERN_BUILDERS: Record<PatternName, (size: number) => Float64Array> = {
  'X': patternX,
  'O': patternO,
  '+': patternPlus,
  '◻': patternSquare,
};

// ---------- the model ----------
const hopfield: Model<HopfieldState> = {
  id: 'hopfield',
  name: 'Hopfield Retrieval',
  short: 'Patterns encoded in dense edge weights via Hebbian learning. A noisy initial state converges to the nearest stored memory.',
  name_zh: 'Hopfield 检索',
  short_zh: '图样通过 Hebb 学习写入稠密边权重。带噪初始状态在几步同步更新内收敛到最近的存储记忆。',
  long_zh: `Hopfield 网络通过把对称权重矩阵设为 **Hebb** 规则，把 K 个图样 ξ_p ∈ {-1, +1}^N 存储为动力学的不动点：

W[i, j] = (1 / N) Σ_p ξ_p[i] · ξ_p[j]    (W[i, i] = 0)

网络的更新规则是

X[i, t+1] = sign( Σ_j W[i, j] · X[j, t] )

——对每个节点，新值是其它所有节点加权投票的符号。从带噪或部分线索出发，动力学沿能量地形下坡，**收敛到最近的存储图样**。

本 demo 存储**四个 32×32 图样** (X、O、+、◻)，让你选择从哪个出发并随机翻转一定比例像素。点*重置*，动力学通常在 2-5 次扫过后收敛。

σ 时间序列显示与目标图样的**重叠度**：从 ≈ 0 (随机/正交) 到 1 (完美检索)。检索成功时它会陡然爬到 1；线索落入错误吸引盆 (试 noise > 0.4) 时它会收敛到另一个存储图样，或落入伪混合态。

关于存储容量/相变 (AGS α_c ≈ 0.138 的结果)，参见 **Hopfield 容量** demo——同样的机器但用随机非相关图样，临界载荷在那里被精确定义。

这也是"快速权重程序员"底层框架的最简具体实例：图样写入 W，检索是 X 上的一次稀疏 matvec。

**教师向 — 五道 Δ 实验适合作为习题**

**1. 检索准确度 vs 噪声。** 选一个存储图样。在 0% 到 50% 之间扫描初始噪声比例。对每个比例测量收敛后与存储图样的最终重叠度。绘制准确度 vs 噪声。吸引盆边界在哪里？

**2. 容量 vs N。** 把噪声固定在零 (完美线索)。一次加一个图样，检查网络是否仍能从线索正确检索每一个。找到检索开始失败的点。比较你的经验"容量"与 N × 0.138 (AGS 预测)。N = 100 时一致度如何？N = 400 时呢？

**3. 伪态。** 存储 K = 3 个图样的网络。从 (ξ_1 + ξ_2 + ξ_3) / 3 二值化的状态出发。网络可能收敛到一个不属于任何存储图样的*伪混合态*。验证之，并论证为何这些态是 Hopfield 能量的局部极小。

**4. 异步 vs 同步更新。** 在同步 (所有神经元同时更新) 和异步 (一次一个) 更新模式间切换。两种情况下网络都收敛吗？Hopfield 的能量下降论证依赖于异步更新；同步下收敛保证会怎样？

**5. 存储退化。** 存储 K 个图样。然后通过翻转 20% 比特来*破坏*某一个图样的存储 (即按破坏后版本修改 W 矩阵)。验证破坏后图样仍能以破坏后形式被检索，且其它图样大部分保留。这是分布式记忆的*优雅退化*性质。

参考文献：Hopfield, *PNAS* 79, 2554 (1982).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/hopfield.ts 中的 long_zh 字段。]*`,
  long: `A Hopfield network stores K patterns ξ_p ∈ {-1, +1}^N as fixed points of its dynamics by setting the symmetric weight matrix to the **Hebbian** rule:

W[i, j] = (1 / N) Σ_p ξ_p[i] · ξ_p[j]    (W[i, i] = 0)

The network's update rule is

X[i, t+1] = sign( Σ_j W[i, j] · X[j, t] )

— for each node, the new value is the sign of a weighted vote of all other nodes. Starting from a noisy or partial cue, the dynamics flow downhill in the energy landscape and **converge to the nearest stored pattern**.

This demo stores **four 32×32 patterns** (X, O, +, ◻) and lets you pick which to start from with a chosen fraction of pixels flipped. Hit *reset* and the dynamics typically converge in 2–5 sweeps.

The σ time-series shows the **overlap** with the target pattern: ranges from ≈ 0 (random / orthogonal) to 1 (perfect recall). When recall succeeds it climbs sharply to 1; when the cue lands in the wrong basin (try noise > 0.4) it converges to a different stored pattern, or to a spurious mixture state.

For the storage capacity / phase-transition story (the AGS α_c ≈ 0.138 result), see the **Hopfield Capacity** demo — same machinery but with random uncorrelated patterns, where the critical load is precisely defined.

This is also the simplest concrete instance of the "fast-weight programmer" substrate framing: patterns are written into W, retrieval is a single sparse matvec on X.

**For instructors — five Δ-experiments suitable for problem sets**

**1. Recall accuracy vs noise.** Pick a stored pattern. Sweep the initial-noise fraction from 0% to 50%. For each, measure the final overlap with the stored pattern (post-convergence). Plot accuracy vs noise. Where is the basin-of-attraction boundary?

**2. Capacity vs N.** Hold the noise level at zero (perfect cue). Add patterns one at a time and check whether the network still recalls each correctly from the cue. Find the point at which recall starts failing. Compare your empirical "capacity" to N × 0.138 (the AGS prediction). How well do they agree at N = 100? At N = 400?

**3. Spurious states.** Set the network up with K = 3 stored patterns. Initialize from a state equal to (ξ_1 + ξ_2 + ξ_3) / 3 and binarized. The network may converge to a *spurious mixed state* that is not any of the originals. Verify, and argue why these states are local minima of the Hopfield energy.

**4. Asymmetric vs symmetric updates.** Switch between synchronous (all neurons update at once) and asynchronous (one at a time) update modes. Does the network converge in both cases? Hopfield's energy-decrease argument relies on asynchronous update; what happens to convergence guarantees under synchronous?

**5. Storage degradation.** Store K patterns. Then *corrupt* a single pattern by flipping 20% of its bits in storage (i.e., modify the W matrix as if you stored the corrupted version). Verify that recall of the corrupted pattern still works in the corrupted form, and that the other patterns are mostly preserved. This is the *graceful degradation* property of distributed memory.

Reference: Hopfield, *PNAS* 79, 2554 (1982).`,

  view: 'grid',

  params: {
    pattern: { label: 'recall pattern', options: PATTERN_NAMES, default: 'X', live: false },
    noise:   { label: 'noise level',   min: 0,  max: 1,   step: 0.01, default: 0.30, live: false },
    size:    { label: 'grid size',     min: 16, max: 48,  step: 8,    default: 32,   live: false },
    speed:   { label: 'speed',         min: 0.1, max: 5,  step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'clean',
      name: 'clean recall',
      short: 'noise=0.3 from X. Initial state is most-X-with-some-flips; dynamics fix the wrong pixels in a few seconds. The standard "associative memory" demo.',
      params: { pattern: 'X', noise: 0.3, size: 32 },
      seed: 1,
    },
    {
      id: 'basin-boundary',
      name: 'basin boundary (noise = 0.5)',
      short: 'noise=0.5 — initial state has ~zero overlap with the chosen pattern (essentially random). Outcome depends on which of the 8 real attractors and ~16 spurious ones the random seed happens to be closest to.',
      params: { pattern: 'X', noise: 0.5, size: 32 },
      seed: 1,
    },
    {
      id: 'spurious-mixture',
      name: 'spurious mixed state (3-pattern)',
      short: 'A specific seed and grid size that lands in a 3-pattern spurious attractor: looks like X, O, +, ◻ all faintly superimposed. Not any single stored memory — Hopfield\'s classical failure mode.',
      params: { pattern: 'O', noise: 0.5, size: 48 },
      seed: 499708377,
    },
    {
      id: 'inverse',
      name: 'inverse recall (high noise)',
      short: 'noise=0.9 — most pixels are flipped from the cue. Converges to the *inverse* of the chosen pattern (Hopfield energy is symmetric under X → -X, so every stored pattern\'s negative is equally stable).',
      params: { pattern: 'X', noise: 0.9, size: 32 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): HopfieldState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const noise = params.noise as number;
    const targetName = params.pattern as PatternName;

    const patterns = (PATTERN_NAMES as readonly PatternName[]).map((n) =>
      PATTERN_BUILDERS[n](size),
    );
    const targetIdx = (PATTERN_NAMES as readonly string[]).indexOf(targetName);
    if (targetIdx < 0) throw new Error(`unknown pattern: ${targetName}`);

    const W = hebbianTrain(patterns, N);

    const X = new Float64Array(N);
    const target = patterns[targetIdx]!;
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
      W,
      patterns,
      targetPattern: targetIdx,
    };
  },

  step(state: HopfieldState, params: ParamValues, rng: RNG): void {
    const { N, X, W } = state;
    // Asynchronous update — Hopfield's original 1982 formulation: pick a
    // random node, set X[i] = sign(Σ_j W[i,j] · X[j]), repeat. Visually
    // satisfying (cells flip one at a time as the static-y noise resolves
    // into the stored pattern) and avoids the spurious 2-cycles that
    // synchronous updates can fall into.
    //
    // Rate is tuned so a 32×32 grid (N=1024) takes a few seconds to
    // converge at speed=1× — about half the grid swept per visible second.
    const speed = params.speed as number;
    const updatesPerFrame = Math.max(1, ((N / 64) * speed) | 0);
    for (let s = 0; s < updatesPerFrame; s++) {
      const i = rng.int(N);
      let sum = 0;
      const off = i * N;
      for (let j = 0; j < N; j++) sum += W[off + j]! * X[j]!;
      X[i] = sum >= 0 ? 1 : -1;
    }
    state.step_count += updatesPerFrame;
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: HopfieldState, i: number): string {
      return state.X[i]! > 0 ? '#e8edf4' : '#1a1f2a';
    },
    nodeSize(): number {
      return 1;
    },
  },

  observe: {
    histogram: {
      label: 'state distribution',
      range: [-1, 1],
      bins: 2,
      values(state: HopfieldState): Float64Array {
        return state.X;
      },
    },
    timeSeries: {
      label: 'overlap with target pattern',
      value(state: HopfieldState): number {
        const N = state.N;
        const target = state.patterns[state.targetPattern]!;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i]! * target[i]!;
        return s / N;
      },
    },
  },
};

export default hopfield;
