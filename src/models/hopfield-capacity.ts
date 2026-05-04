// Hopfield network capacity / α_c phase transition.
//
// Stores P uncorrelated random binary patterns in a Hopfield network of N
// neurons. The Hebbian rule is the same as the geometric Hopfield demo,
// but with random patterns instead of hand-drawn shapes — this is the
// canonical setup analysed by Amit, Gutfreund & Sompolinsky (1985-87)
// using the spin-glass replica method.
//
// The result is a true second-order phase transition at the critical load
//
//   α_c ≡ P / N  ≈  0.138
//
// This demo stages the transition: pick a load α via the num_patterns
// slider, start the system at the exact stored target pattern (noise=0),
// and watch the σ time-series. Below α_c it stays at 1 forever — the
// pattern is a fixed point. Above α_c it collapses toward 0 — the
// pattern is no longer a fixed point and the dynamics flow into a
// spin-glass spurious attractor. The phase boundary at α_c ≈ 0.138 is
// sharp and lines up with AGS's analytical prediction.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

interface CapacityState extends ModelState {
  W: Float64Array;
  patterns: Float64Array[];
  targetPattern: number;   // always 0 — we recall pattern[0]
  alpha: number;           // P / N
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

const capacity: Model<CapacityState> = {
  id: 'hopfield-capacity',
  name: 'Hopfield Capacity (α_c Phase Transition)',
  short: 'Same machinery as the Hopfield demo but with random uncorrelated patterns. Slide the load P/N across 0.138 and watch capacity collapse — Amit–Gutfreund–Sompolinsky 1985.',
  name_zh: 'Hopfield 容量 (α_c 相变)',
  short_zh: '同样的机器，但用 P 个随机图样。让载荷 α = P/N 穿过 α_c ≈ 0.138 临界线（AGS 1985-87）。下方：存储图样是不动点。上方：自旋玻璃相，容量崩溃。',
  long_zh: `Hopfield 网络的存储容量是一个**真正的二级相变**，且有一个精确的临界载荷。本 demo 把它演示出来。

**设置。** 通过 Hebb 规则 W[i, j] = (1/N) Σ_p ξ_p[i] ξ_p[j] 在 N 个神经元的 Hopfield 网络中存储 P 个不相关随机二元图样 ξ_1, …, ξ_P。把网络状态置为第一个存储图样 (无噪声——*精确*从图样出发)。运行动力学。看 σ 时间序列，它跟踪与目标图样的重叠度。

**三个区域**，由 α = P / N 控制：

| α | 区域 | σ 行为 | 名字 |
|---|---|---|---|
| α ≪ 0.138 | 记忆相 | 永远停在 1 | "安全载荷" |
| α ≈ 0.138 | 临界线 | 依赖 seed | **α_c = AGS 临界载荷** |
| α ≫ 0.138 | 自旋玻璃 | 跌至 ~0 | 容量崩溃 |

α_c ≈ 0.138 处的相变是**尖锐的**。它和 Ising T_c (Ising demo 的另一条临界线) 是同一类对象：拖动滑块就能穿过的相边界。AGS 通过把 Hopfield 网络映射到 Sherrington-Kirkpatrick 自旋玻璃并用复制方法解析推出了 0.138——Hopfield 网络的容量是 Onsager 风格统计力学应用到神经网络的一个推论。

**试三个预设**遍历相变。α_c 之下 σ 时间序列停在 1 (存储图样是不动点)。在 α_c 处它颤抖——seed 决定检索是否成功。α_c 之上它跌落——即使*精确*从存储图样出发，动力学也会流向伪吸引子。把噪声拉高让一切变糟，但即使 noise=0 也能看到相变。

**关联。**

— **真实大脑的记忆可能在类似临界点附近运行。** 皮层神经雪崩 (Beggs & Plenz 2003)、EEG 的 1/f 谱、幂律动力学——都与脑在临界态运行相符。Hopfield 的 α_c 是"复杂系统在相边界附近做工作"这一更广思想的精确数学实例。

— **现代 Hopfield 网络** (Ramsauer 等 2020, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217)) 把二次能量替换成 log-sum-exp 形式。容量从 0.138·N 跳到**在 N 中指数级**。同样修改后的网络在数学上等价于 **Transformer 注意力**——注意力的强检索容量就是现代 Hopfield 变体的强存储容量。我们这里穿过的经典 α_c 相变正是注意力*没有*受限于的东西。

**教师向 — 五道 Δ 实验适合作为习题**

**1. 定位 α_c。** 固定 N = 200，在 0.05 到 0.25 之间以 0.01 步长扫描 α。对每个 α，对 10 个随机目标取平均，测量收敛后与目标图样的重叠度。绘制重叠度 vs α。定位相变点。与 AGS 预测 α_c ≈ 0.138 比较。

**2. 有限 N 效应。** 在 N = 100, 200, 400, 800 下重复 α 扫描。α_c 是否随 N 漂移？相变是否变锐利？绘制相变宽度 vs 1/N——这是 Hopfield 相变的有限尺寸标度。

**3. 两个序参量发散。** 在 α_c 之上一点，网络可能落入"错误但仍存储"的态 (目标重叠度跌落，与任意存储图样的最大重叠度仍高)。在 α 从 0.10 到 0.20 之间走，观察两条时间序列。识别它们分歧的区域。这个区域对应 AGS 相图中的什么？

**4. 自旋玻璃相。** 在 α = 0.2 (远高于 α_c)，系统到达一个与任何存储图样都不相关的态 (最大重叠度 ≈ 0)。用 10 个不同 seed 跑。它们都收敛到同一最终态，还是不同最终态？论证 *复制对称性破缺* (Parisi 1979) 与你的观察的相关性。

**5. 临界指数估计。** 从你的有限尺寸 α 扫描，把序参量拟合为 |α − α_c|^β，提取 β。与平均场 β = 1/2 比较。Hopfield 相变是平均场，还是有自己的普适类？(提示：平均场实质上就是 AGS 解析计算的内容。)

参考文献：Hopfield, *PNAS* 79, 2554 (1982); Amit, Gutfreund & Sompolinsky, *Phys. Rev. A* 32, 1007 (1985); *Annals of Physics* 173, 30 (1987).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/hopfield-capacity.ts 中的 long_zh 字段。]*`,
  long: `The Hopfield network's storage capacity is a **true second-order phase transition** with a precise critical load. This demo stages it.

**The setup.** Store P uncorrelated random binary patterns ξ_1, …, ξ_P in a Hopfield network of N neurons via the Hebbian rule W[i, j] = (1/N) Σ_p ξ_p[i] ξ_p[j]. Set the network's state to the first stored pattern (no noise — start *exactly* on the pattern). Run the dynamics. Watch the σ time-series, which tracks overlap with the target pattern.

**Three regimes**, controlled by α = P / N:

| α | regime | what σ does | name |
|---|---|---|---|
| α ≪ 0.138 | memory phase | stays at 1 forever | "safe load" |
| α ≈ 0.138 | critical line | depends on seed | **α_c = AGS critical load** |
| α ≫ 0.138 | spin-glass | collapses to ~0 | capacity gone |

The transition at α_c ≈ 0.138 is **sharp**. It's the same kind of object as the Ising T_c (the Ising demo's other critical line): a phase boundary you walk by dragging a slider. AGS derived 0.138 analytically by mapping the Hopfield network onto a Sherrington–Kirkpatrick spin glass and using the replica method — the Hopfield network's capacity is a corollary of Onsager-style statistical mechanics applied to neural networks.

**Try the three presets** to walk the transition. Below α_c the σ time-series sits at 1 (the stored pattern is a fixed point). At α_c it flutters — the seed determines whether recall holds. Above α_c it falls — even starting *exactly* on a stored pattern, the dynamics flow away to a spurious attractor. Bumping noise up makes everything worse, but the transition shows even at noise=0.

**Connections.**

— **Memory in real brains may operate near a similar critical point.** Cortical neural avalanches (Beggs & Plenz 2003), 1/f spectrum in EEG, power-law dynamics — all consistent with brain operating in a critical regime. Hopfield's α_c is a precise mathematical instance of the broader idea that complex systems do their work near phase boundaries.

— **Modern Hopfield Networks** (Ramsauer et al. 2020, [arXiv:2008.02217](https://arxiv.org/abs/2008.02217)) replace the quadratic energy with a log-sum-exp form. The capacity jumps from 0.138·N to **exponential in N**. That same modified network is mathematically equivalent to **Transformer attention** — the strong recall capacity of attention is the strong storage capacity of a modern Hopfield variant. The classical α_c phase transition we walk here is what attention is *not* limited by.

**For instructors — five Δ-experiments suitable for problem sets**

**1. Locate α_c.** At fixed N = 200, sweep α from 0.05 to 0.25 in steps of 0.01. For each α, measure the average overlap with the target pattern after convergence (over 10 random target choices). Plot overlap vs α. Locate the transition point. Compare to the AGS prediction α_c ≈ 0.138.

**2. Finite-N effects.** Repeat the α sweep at N = 100, 200, 400, 800. Does α_c shift with N? Does the transition sharpen? Plot the transition width vs 1/N — this is the finite-size scaling for the Hopfield phase transition.

**3. Two order parameters diverge.** Just above α_c, the network may fall into a wrong-but-stored state (target overlap drops, max overlap with any stored pattern stays high). Walk α from 0.10 to 0.20 and watch the two time-series. Identify the regime where they disagree. What does that regime correspond to in the AGS phase diagram?

**4. Spin-glass phase.** At α = 0.2 (well above α_c), the system reaches a state that is uncorrelated with any stored pattern (max overlap ≈ 0). Run for 10 different seeds. Do all converge to the same final state, or different final states? Argue the relevance of *replica symmetry breaking* (Parisi 1979) to your observation.

**5. Critical exponent estimation.** From your finite-size α sweep, fit the order parameter as |α − α_c|^β near the transition. Extract β. Compare to mean-field β = 1/2. Does the Hopfield transition match mean-field, or does it have its own universality class? (Hint: mean-field is essentially what AGS computed analytically.)

References: Hopfield, *PNAS* 79, 2554 (1982); Amit, Gutfreund & Sompolinsky, *Phys. Rev. A* 32, 1007 (1985); *Annals of Physics* 173, 30 (1987).`,

  view: 'grid',

  params: {
    num_patterns: { label: 'P (num patterns)',  min: 2,  max: 300, step: 1,    default: 50,   live: false },
    noise:        { label: 'cue noise',         min: 0,  max: 1,   step: 0.01, default: 0.0,  live: false },
    size:         { label: 'grid size (N=size²)', min: 16, max: 48, step: 8,   default: 32,   live: false },
    speed:        { label: 'speed',             min: 0.1, max: 5,  step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'safe',
      name: 'safe load (α ≈ 0.05)',
      short: 'P=50, N=1024, α=0.049 — well below α_c=0.138. Pattern is a stable attractor. Even with noise=0 the σ trace stays pinned at 1: the stored pattern is a fixed point, the dynamics don\'t move it.',
      params: { num_patterns: 50, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'near-critical',
      name: 'near critical (α ≈ 0.13)',
      short: 'P=130, α=0.127 — just below the AGS critical load. Recall still mostly works but the basin is shallow. Reseed a few times to see σ occasionally drop instead of staying at 1 — finite-size critical fluctuations.',
      params: { num_patterns: 130, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'critical',
      name: 'critical line (α ≈ α_c = 0.138)',
      short: 'P=141, α=0.138 — sitting on AGS\'s analytical critical load. Boundary between memory phase and spin-glass phase. Recall succeeds for some seeds, fails for others — the very definition of a phase transition.',
      params: { num_patterns: 141, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'spin-glass',
      name: 'spin-glass phase (α = 0.20)',
      short: 'P=205, α=0.20 — well past α_c. Stored patterns no longer fixed points. From noise=0 the σ trace collapses sharply: dynamics flow *away* from the target into a spurious attractor. The capacity is broken.',
      params: { num_patterns: 205, noise: 0.0, size: 32 },
      seed: 1,
    },
    {
      id: 'deep-glass',
      name: 'deep spin-glass (α = 0.30)',
      short: 'P=307, α=0.30 — deep in the spin-glass regime. The energy landscape is dominated by spurious attractors with no useful structure. σ collapses immediately.',
      params: { num_patterns: 307, noise: 0.0, size: 32 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): CapacityState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const P = Math.max(1, Math.round(params.num_patterns as number));
    const noise = params.noise as number;

    const patterns: Float64Array[] = [];
    for (let p = 0; p < P; p++) patterns.push(randomPattern(N, rng));

    const W = hebbianTrain(patterns, N);

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
      W,
      patterns,
      targetPattern: 0,
      alpha: P / N,
    };
  },

  step(state: CapacityState, params: ParamValues, rng: RNG): void {
    const { N, X, W } = state;
    const speed = params.speed as number;
    // Asynchronous Hopfield update — same as the geometric demo.
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
    nodeColor(state: CapacityState, i: number): string {
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
      values(state: CapacityState): Float64Array {
        return state.X;
      },
    },
    // Two overlap traces tell different stories:
    //   target:  did we keep / recall the *intended* pattern?
    //   max:     did we recall *any* stored pattern?
    // Below α_c both ≈ 1. Just past α_c, target may drop while max stays high
    // (system fell into a wrong-but-still-stored attractor). Deep in spin
    // glass, both collapse — no stored pattern is a fixed point any more.
    timeSeries: {
      label: 'σ overlap with target',
      value(state: CapacityState): number {
        const N = state.N;
        const target = state.patterns[state.targetPattern]!;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i]! * target[i]!;
        return s / N;
      },
    },
    timeSeries2: {
      label: '|σ| max overlap with any stored',
      value(state: CapacityState): number {
        const N = state.N;
        let best = 0;
        for (let p = 0; p < state.patterns.length; p++) {
          const pat = state.patterns[p]!;
          let s = 0;
          for (let i = 0; i < N; i++) s += state.X[i]! * pat[i]!;
          const m = Math.abs(s) / N;
          if (m > best) best = m;
        }
        return best;
      },
    },
  },
};

export default capacity;
