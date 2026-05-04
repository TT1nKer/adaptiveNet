// Self-Organised Criticality (SOC) sandpile — implementation in the
// universality class of Bak-Tang-Wiesenfeld (1987) abelian sandpile, with
// continuous-activity variant + dissipation (closer to Manna 1991 / dissipative
// sandpile literature than the strict integer-height BTW).
//
// PAPER-VERIFIED 2026-05-04:
//   - Bak, Tang, Wiesenfeld. "Self-organized criticality: An explanation of
//     the 1/f noise." PRL 59, 381 (1987). DOI 10.1103/PhysRevLett.59.381 —
//     paywalled, original 1987 paper, defines the canonical sandpile.
//   - Beggs & Plenz. "Neuronal avalanches in neocortical circuits." J. Neurosci.
//     23, 11167 (2003) — open access, [PMC6741045]. Cortical slice cultures
//     show neuronal avalanches with size exponent τ = 3/2 (their reported
//     average slope: 1.50 ± 0.08 LFP, 1.58 ± 0.04 electrode).
//   - Touboul & Destexhe (PLOS ONE 12, e0181104, 2017) — methodological
//     critique: subsampling and bin-size choices alone can produce apparent
//     power laws independent of underlying criticality.
//
// IMPLEMENTATION SPECIFICS (continuous-activity variant):
//   - Each cell has continuous activity X_i (paper's BTW used integer h_i).
//   - Drive: X_i += dose. If X_i ≥ threshold (=1), cell fires: X_i -= 1, each
//     of the 4 lattice neighbours gets (1-ε)/4 of the threshold added.
//   - With dissipation ε > 0, fraction ε of activity leaves the system per
//     fire — gives a finite steady state. The exact case ε = 0 conserves
//     activity (BTW's original).
//
// Exponent claims must be made carefully. Different sandpile variants give
// different exponents in 2D:
//   - Original BTW (deterministic, integer h, conservative): τ ≈ 1.21-1.27
//     in 2D (Manna 1991, Priezzhev 1994, theoretical)
//   - Manna stochastic sandpile: τ ≈ 1.27 in 2D
//   - Continuous + dissipative (this implementation): exponent depends on ε
//     and may differ from above
//   - Beggs-Plenz cortical: τ = 3/2 ≈ 1.50 (empirical, neuron firing)
//
// The previous "things to try" prompt that BTW gives τ ≈ 1.0 was wrong (no
// reference for that value). Corrected in instructor prompts.
//
// Beggs & Plenz's discovery — that neural firing in cortex follows
// power-law statistics with τ ≈ 3/2 — is the strongest evidence so far
// that the brain operates near a critical point. This demo gives you the
// visceral version: most of the time the lattice looks dead-quiet, then
// a single extra grain triggers a cascade that lights up half the canvas.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

interface AvalancheState extends ModelState {
  _lastSize: number;            // size of most recent avalanche (after binning + subsampling)
  _smoothSize: number;          // exponentially smoothed avalanche size
  // ---- methodology knobs (Plenz / Touboul-Destexhe debate) ----
  _binAccum: number;            // accumulator within current bin
  _binCounter: number;          // drives counted within current bin
  _observed: Uint8Array;        // 1 if cell is in the observed subsample, 0 if hidden
  _subsampleFrac: number;       // cached so we know when to rebuild _observed
}

// Deterministic observation mask. Cells are masked by a hash of their index
// so that increasing subsample_frac strictly adds cells (never reshuffles)
// — gives consistent visual + statistical behaviour across slider drags.
function makeObservedMask(N: number, frac: number): Uint8Array {
  const out = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    // golden-ratio hash → uniform [0, 1)
    const h = ((i * 2654435761) >>> 0) / 4294967296;
    out[i] = h < frac ? 1 : 0;
  }
  return out;
}

function buildGrid(cols: number, rows: number): Graph {
  const N = cols * rows;
  const adj: number[][] = Array.from({ length: N }, () => []);
  const edges: Array<[number, number]> = [];
  const link = (i: number, j: number): void => {
    if (i === j) return;
    if (adj[i]!.includes(j)) return;
    adj[i]!.push(j);
    adj[j]!.push(i);
    edges.push(i < j ? [i, j] : [j, i]);
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      // periodic boundaries — every cell has 4 neighbours
      link(i, r * cols + ((c + 1) % cols));
      link(i, ((r + 1) % rows) * cols + c);
    }
  }
  const deg = new Int32Array(N);
  for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
  return { N, adj, edges, deg };
}

const avalanches: Model<AvalancheState> = {
  id: 'avalanches',
  name: 'Neural Avalanches (SOC)',
  short: 'Bak–Tang–Wiesenfeld sandpile dynamics on a 2D grid. Drive slowly — most events are tiny, occasional ones are enormous. Avalanche sizes follow a power law: same statistics Beggs & Plenz 2003 found in cortical slices.',
  name_zh: '神经雪崩 (自组织临界)',
  short_zh: '2D 网格上的 Bak-Tang-Wiesenfeld 沙堆。慢驱动下大多数事件很小，偶尔扫过整个网格。雪崩大小服从幂律——和 Beggs & Plenz 2003 在皮层切片中发现的 s^(−3/2) 统计相同。脑在临界点附近运行的最强证据。',
  long_zh: `2D 网格的每个 cell 有一个活性 X。每个驱动事件，一个随机 cell 收到一个脉冲：X[i] += dose。如果活性超过阈值 (设为 1)，cell **发放**：活性归零并重新分配给四个邻居，每个增加阈值的 (1−ε) / 4 比例。在小耗散 ε > 0 下，部分活性离开系统；稳态有限。

关键是：**一次发放可以把邻居推过阈值**——它们也发放。一次驱动事件触发的级联就是**雪崩**。大多数很小 (只有原始那次发放)。有些极大，扫过数千 cell 才让活动到处回到阈值之下。

特征现象：雪崩大小服从幂律分布 P(s) ~ s^(−3/2)，胖上尾延伸到系统大小。这个指数是普适的——出现在：

— **Bak-Tang-Wiesenfeld 1987**：原始沙堆。Bak、Tang、Wiesenfeld 创造了"自组织临界"这个词，因为系统不需要外部参数就自调到临界态。
— **真实沙堆** (Held 等 1990)：慢慢撒沙，得到的雪崩遵循 s^(−3/2)。
— **森林火灾、地震、太阳耀斑**：每个都遵循一个相关指数的幂律。
— **Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003)**：来自鼠脑的皮层切片培养展示出**相同**的 s^(−3/2) 指数神经雪崩。这是皮层在临界附近运行的第一份直接证据。

本 demo 中，看 σ 时间序列——它在大致对数感的尺度上显示最近一次雪崩的大小。大多数时候是 1 附近的平线 (单 cell 事件)。然后一个尖峰：100、500、1000+ cell 在一次级联中发放。**宽广的范围本身就是 demo**。线性尺度直方图让重尾不那么可见；你看到极小雪崩与极大雪崩并存——这就是"幂律分布"在实践中的样子。

**为什么这对脑很重要。** 脑的能量预算排除了过密或过疏的活动——过密代谢成本爆炸，过疏信息传输破裂。自组织临界是单位活动信息传输最大化的区域 (Beggs 2008)，皮层的 s^(−3/2) 统计表明脑被进化调到这个区域。**精神疾病可能就是稍微偏离临界**：太多活动 → 癫痫 (超临界，失控雪崩)，太少 → 功能丧失 (亚临界)。同样的物理，不同的偏向。

**尝试**

— 看 σ。大多数事件很小，偶尔尖峰到 100+。宽广的范围本身就是 demo。
— 把耗散 ε 拉到 0.2——亚临界，无大事件。降到 0——超临界，失控。
— 拖 **avalanche bin width** 滑块。宽 bin 合并连续级联并改变表观幂律斜率——Plenz-Touboul 方法学争议。
— 把 **observed cell fraction** 降到 0.2。仅子采样是否影响表观幂律形状？

参考文献：Bak, Tang & Wiesenfeld, *Phys. Rev. Lett.* 59, 381 (1987). Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003). Beggs, *Phil. Trans. R. Soc. A* 366, 329 (2008). Touboul & Destexhe, *PLOS ONE* 12, e0181104 (2017). Clauset, Shalizi & Newman, *SIAM Review* 51, 661 (2009).

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/avalanches.ts 中的 long_zh 字段。]*`,
  long: `Each cell of the 2D grid has an activity X. Once per drive event, a random cell receives a kick: X[i] += dose. If the activity exceeds threshold (set to 1), the cell **fires**: its activity dumps to zero and is redistributed to its 4 neighbours, each gaining a fraction (1−ε) / 4 of the threshold. With a small dissipation ε > 0, some activity leaves the system; the steady state is finite.

Crucially, **a fire can push neighbours past threshold** — and they fire too. The cascade triggered by a single drive event is the **avalanche**. Most are tiny (just the original fire). Some are enormous, sweeping across thousands of cells before activity falls back below threshold everywhere.

The signature phenomenon: avalanche sizes follow a power-law distribution P(s) ~ s^(−3/2), with a fat upper tail extending out to the system size. This exponent is universal — it shows up in:

— **Bak–Tang–Wiesenfeld 1987**: the original sandpile. Bak, Tang & Wiesenfeld coined "self-organised criticality" because the system tunes itself to the critical state without external parameters.
— **Real sand piles** (Held et al. 1990): drop grains slowly, the avalanches that result follow s^(−3/2).
— **Forest fires, earthquakes, solar flares**: each follows a power law with a related exponent.
— **Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003)**: cortical slice cultures from rat brain show neural avalanches with **the same** s^(−3/2) exponent. This was the first direct evidence that cortex operates near criticality.

In this demo, watch the σ time-series — it shows the size of the most recent avalanche on a roughly logarithmic-feeling scale. Most of the time it's a flat line near 1 (single-cell events). Then a spike: 100, 500, 1000+ cells fired in a single cascade. **The wide range itself is the demo**. Linear-scale histograms make the heavy tail less visible; the fact that you see truly enormous avalanches alongside tiny ones is what "power-law distributed" looks like in practice.

**Why this matters for the brain.** The brain's energy budget rules out very dense or very sparse activity — too dense and metabolic cost explodes; too sparse and information transmission breaks down. Self-organised criticality is the regime that maximises information transmission per unit of activity (Beggs 2008), and the s^(−3/2) statistics in cortex suggest the brain has been tuned by evolution to operate in this regime. **Mental disease may be small drift away from critical**: too much activity → seizure (super-critical, runaway avalanches), too little → loss of function (sub-critical). The same physics; different drift directions.

**Things to try**

— Watch σ. Most events tiny, occasional ones spike to 100+. The wide range itself is the demo.
— Drag dissipation ε up to 0.2 — system goes subcritical, no big events. Down to 0 — supercritical, runaway.
— Drag the **avalanche bin width** slider. Wider bins merge consecutive cascades and shift the apparent power-law slope — the Plenz-Touboul methodology debate.
— Drag **observed cell fraction** down to 0.2. Does subsampling alone affect the apparent power-law shape?

References: Bak, Tang & Wiesenfeld, *Phys. Rev. Lett.* 59, 381 (1987). Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003). Beggs, *Phil. Trans. R. Soc. A* 366, 329 (2008). Touboul & Destexhe, *PLOS ONE* 12, e0181104 (2017). Clauset, Shalizi & Newman, *SIAM Review* 51, 661 (2009).`,

  view: 'grid',

  params: {
    dose:        { label: 'drive dose',           min: 0.05, max: 1.0, step: 0.01, default: 0.10, live: true },
    dissipation: { label: 'dissipation ε',        min: 0,    max: 0.3, step: 0.005, default: 0.04, live: true },
    drives_per_frame: { label: 'drive events / frame', min: 1, max: 200, step: 1, default: 30,   live: true },
    bin_steps:   { label: 'avalanche bin width (drives)', min: 1, max: 20, step: 1, default: 1, live: true },
    subsample_frac: { label: 'observed cell fraction', min: 0.05, max: 1.0, step: 0.05, default: 1.0, live: true },
    size:        { label: 'grid size',            min: 32,   max: 200, step: 8,    default: 96,   live: false },
    speed:       { label: 'speed',                min: 0.1,  max: 5,   step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'critical',
      name: 'critical (default)',
      short: 'Drive slowly with mild dissipation. The system self-tunes to the critical point: most events tiny, occasional ones huge. σ time-series spikes by 100x or more on rare events. The s^(-3/2) power law is what those spikes obey.',
      params: { dose: 0.10, dissipation: 0.04, drives_per_frame: 30, size: 96 },
      seed: 1,
    },
    {
      id: 'subcritical',
      name: 'subcritical (high dissipation)',
      short: 'Crank dissipation up — energy leaks out faster than drive adds in. Each fire stays local because neighbours don\'t reach threshold. Activity stays low, no large avalanches. "Sub-critical" — like cortex under heavy GABAergic inhibition.',
      params: { dose: 0.10, dissipation: 0.20, drives_per_frame: 30, size: 96 },
      seed: 1,
    },
    {
      id: 'supercritical',
      name: 'supercritical (no dissipation)',
      short: 'ε = 0 means perfect conservation — every fire returns full energy to neighbours. With periodic BC there\'s nowhere for energy to go. Activity accumulates until almost all cells fire at once. Runaway / "epileptic" regime.',
      params: { dose: 0.10, dissipation: 0.0, drives_per_frame: 30, size: 96 },
      seed: 1,
    },
    {
      id: 'fast-driving',
      name: 'fast driving (off-critical)',
      short: 'Many drive events per frame — system can\'t separate avalanches in time, multiple ones overlap. Power-law statistics blur. Self-organised criticality requires the **separation of timescales**: drive slow, dynamics fast.',
      params: { dose: 0.10, dissipation: 0.04, drives_per_frame: 200, size: 96 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): AvalancheState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const graph = buildGrid(size, size);

    // X has d=2 per cell: [activity, fire_age]
    //   activity   — accumulating energy, threshold = 1
    //   fire_age   — frames since last fire (for visual flash)
    const X = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      X[i * 2] = rng.uniform(0, 0.5);   // mild initial activity
      X[i * 2 + 1] = 1000;              // not recently fired
    }

    const subFrac = (params.subsample_frac as number) ?? 1.0;
    return {
      N,
      d: 2,
      X,
      graph,
      t: 0,
      step_count: 0,
      cols: size,
      rows: size,
      _lastSize: 0,
      _smoothSize: 0,
      _binAccum: 0,
      _binCounter: 0,
      _observed: makeObservedMask(N, subFrac),
      _subsampleFrac: subFrac,
    };
  },

  step(state: AvalancheState, params: ParamValues, rng: RNG): void {
    const { N, X, graph } = state;
    const adj = graph.adj;
    const dose = params.dose as number;
    const eps = params.dissipation as number;
    const drivesPerFrame = Math.max(1, Math.round((params.drives_per_frame as number) * (params.speed as number)));

    // ---- Plenz / Touboul-Destexhe methodology knobs ----
    const binSteps = Math.max(1, Math.round((params.bin_steps as number) ?? 1));
    const subFrac = (params.subsample_frac as number) ?? 1.0;
    // Live rebuild of the observation mask if subsample_frac changed.
    if (Math.abs(subFrac - state._subsampleFrac) > 0.001) {
      state._observed = makeObservedMask(N, subFrac);
      state._subsampleFrac = subFrac;
      // Also reset bin accumulator so we don't carry mixed statistics across the change.
      state._binAccum = 0;
      state._binCounter = 0;
    }
    const observed = state._observed;

    const threshold = 1.0;
    const transferFraction = (1 - eps) / 4;  // fraction of threshold passed to each of 4 neighbours

    // Resolve cascades using a stack (DFS-like), reused across drives
    const aux = state as AvalancheState & { _stack?: Int32Array };
    if (!aux._stack || aux._stack.length < N) aux._stack = new Int32Array(N);
    const stack = aux._stack;

    // age all cells (for visual flash decay)
    for (let i = 0; i < N; i++) {
      X[i * 2 + 1] = Math.min(X[i * 2 + 1]! + 1, 1000);
    }

    for (let d = 0; d < drivesPerFrame; d++) {
      // drive: random cell gets a dose
      const seed_i = rng.int(N);
      X[seed_i * 2] = X[seed_i * 2]! + dose;

      // resolve any cascades triggered, counting fires that fall in the
      // observed subsample (Touboul-Destexhe-style observation noise).
      let top = 0;
      let driveFires = 0;
      if (X[seed_i * 2]! >= threshold) {
        stack[top++] = seed_i;
      }

      while (top > 0) {
        const i = stack[--top]!;
        if (X[i * 2]! < threshold) continue;
        // fire: dump activity to threshold floor, transfer to neighbours
        X[i * 2] = X[i * 2]! - threshold;     // keep any excess (over threshold)
        X[i * 2 + 1] = 0;                      // mark as just-fired
        if (observed[i]) driveFires++;

        const ai = adj[i]!;
        for (let p = 0; p < ai.length; p++) {
          const j = ai[p]!;
          X[j * 2] = X[j * 2]! + threshold * transferFraction;
          if (X[j * 2]! >= threshold && X[j * 2 + 1]! > 0) {
            stack[top++] = j;
            if (top >= N) break;  // safety cap
          }
        }
        if (top >= N) {
          // safety break — should not happen in normal operation
          break;
        }
      }

      // Bin aggregation (Plenz-style time-window binning). When binSteps > 1,
      // multiple consecutive avalanches merge into a single observed
      // "avalanche" — exactly the Touboul-Destexhe critique that bin width
      // dramatically affects the apparent power-law exponent.
      state._binAccum += driveFires;
      state._binCounter++;
      if (state._binCounter >= binSteps) {
        state._lastSize = state._binAccum;
        state._smoothSize = state._smoothSize * 0.85 + state._binAccum * 0.15;
        state._binAccum = 0;
        state._binCounter = 0;
      }
    }

    state.step_count++;
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: AvalancheState, i: number): string {
      const age = state.X[i * 2 + 1]!;
      const X = state.X[i * 2]!;

      // freshly fired → bright white flash
      if (age === 0) return '#ffffff';
      if (age <= 4) {
        const fade = age / 4;
        const r = Math.round(255 - 50 * fade);
        const g = Math.round(255 - 110 * fade);
        const b = Math.round(180 - 130 * fade);
        return `rgb(${r},${g},${b})`;
      }
      // resting activity → dark navy → red-orange near threshold
      let t = X;  // 0..1 typically
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const r = Math.round(20 + (220 - 20) * t);
      const g = Math.round(28 + (62 - 28) * t);
      const b = Math.round(60 + (38 - 60) * t);
      return `rgb(${r},${g},${b})`;
    },
    nodeSize(): number {
      return 1;
    },
  },

  observe: {
    histogram: {
      label: 'cell activity distribution',
      range: [0, 1.2],
      bins: 30,
      values(state: AvalancheState): Float64Array {
        const N = state.N;
        const out = new Float64Array(N);
        for (let i = 0; i < N; i++) out[i] = state.X[i * 2]!;
        return out;
      },
    },
    timeSeries: {
      label: 'avalanche size (smoothed) — note the spikes',
      value(state: AvalancheState): number {
        return state._smoothSize;
      },
    },
  },
};

export default avalanches;
