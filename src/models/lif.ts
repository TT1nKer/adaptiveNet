// Leaky Integrate-and-Fire (LIF) neurons on a 2D square lattice.
//
// PAPER-VERIFIED 2026-05-04:
//   - Lapicque, L. "Recherches quantitatives sur l'excitation électrique
//     des nerfs traitée comme une polarisation." J. Physiol. Pathol. Gén. 9,
//     620 (1907). The original LIF paper. Universally textbook (Gerstner-
//     Kistler-Naud-Paninski, "Neuronal Dynamics", https://neuronaldynamics.epfl.ch).
//
// The simplest spiking-neuron model in computational neuroscience.
// Each cell has membrane voltage V evolving as:
//
//   dV/dt = -V / τ + Σ_neighbours (synaptic input) + I_drive
//
// When V crosses the firing threshold, the neuron emits a spike, V resets
// to rest, and the cell enters a brief refractory period during which it
// cannot fire again. Spikes from neighbours arrive as instantaneous voltage
// kicks of size W_syn.
//
// A small region of cells in the centre is driven by a constant input
// current I_drive — these become the wave seed. With moderate W_syn each
// driver spike is enough to push its neighbours past threshold, and a
// wavefront of spikes propagates outward across the grid. Behind each
// wavefront is a trailing refractory zone where neurons can't fire again
// for a few steps, so colliding waves annihilate — the same excitable-
// medium phenomenology as Gray-Scott but from genuine neural dynamics.
//
// Acceptance test (tests/lif.test.ts): with default W_syn and I_drive,
// firing rate ≈ 0 initially (most cells silent), but after some warmup
// a non-zero population of cells fires per step (waves propagating).

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

const V_REST_LO = -0.2;
const V_REST_HI = 1.0;

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
      link(i, r * cols + ((c + 1) % cols));
      link(i, ((r + 1) % rows) * cols + c);
    }
  }
  const deg = new Int32Array(N);
  for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
  return { N, adj, edges, deg };
}

const lif: Model = {
  id: 'lif',
  name: 'Spiking Neurons (LIF Network)',
  short: 'Leaky integrate-and-fire neurons on a 2D lattice. Drive a few cells, watch waves of spikes propagate. The simplest spiking-neuron model — Lapicque 1907.',
  name_zh: '脉冲神经元 (LIF 网络)',
  short_zh: '2D 格子上的漏积分发放神经元——最简单的脉冲模型，源自 Lapicque 1907，至今仍是现代神经形态芯片的标配。中央驱动触发同步脉冲径向波。耦合大开变 "癫痫"，关小变局部振荡。',
  long_zh: `32×32 (或更大) 网格上的每个 cell 是一个**漏积分发放神经元**，膜电压 V 演化为

dV/dt = −V/τ + Σ_neighbours (突触脉冲) + I_drive

当 V 越过阈值时，神经元发出一个**脉冲** (亮白闪光)，V 重置回静息电位，cell 进入一段短暂的不应期，期间不能再发放。来自邻居的脉冲作为瞬时 +W_syn 脉冲到达。

中央有一小块 cell 被恒定电流 **I_drive** 驱动——它们成为持续振荡器。它们的脉冲向外辐射；在适中的 **W_syn** 下，邻居 cell 接收到足够的驱动也发放，同步发放的波前在网格上传播。每个波前后面是一个尾随的不应期区域——神经元不能连续发放两次——所以碰撞的波**互相湮灭**，与 Gray-Scott 可激发介质图样完全一样，但是从真实神经动力学涌现出来。

**试：**

— **W_syn = 1.0 / I_drive = 0.5** (默认)：从中心干净的径向波，每隔几百毫秒重复。
— **W_syn ↓ 到 0.5**：驱动维持小斑点但波不传播。活动停在局部。
— **W_syn ↑ 到 2.0**：失控——网络全局同步，齐发齐止。病理态，类似真实皮层的**癫痫**发作。
— **I_drive ↑ 到 1.0**：驱动 cell 发放更快，更频繁的波。
— **I_drive = 0**：无驱动。在适中 W_syn 下，网络几秒内归静 (没有活动来源)。

**与画廊其余的关联**：

Hopfield + Ising 用**离散 ±1 自旋**加 sigmoid 更新——同样的底层但没有时间动力学、没有脉冲。LIF 加上**连续电压 + 阈值穿越 + 不应期**——让它看起来像真神经元的最少要素。波传播与 Gray-Scott 是同一类可激发介质动力学，但"分子"现在是脉冲，"扩散"现在是突触传递。

**尝试**

— 默认：中心干净的径向波。
— W_syn ↓ 到 0.5：驱动维持小斑点但波不传播。
— W_syn ↑ 到 2.0：失控全局同步——病理性"癫痫"态。

参考文献：Lapicque, *J. Physiol. Pathol. Gén.* 9, 620 (1907). 这个模型已超过一个世纪，比 Hodgkin-Huxley 早 45 年，**至今仍是现代脉冲神经网络仿真的标配**——Loihi、SpiNNaker、BrainScaleS 等所有神经形态硬件平台都规模化运行 LIF 或其近变体。

*[本中文版为初稿翻译。如有不妥之处，欢迎在 [issues](https://github.com/TT1nKer/adaptiveNet/issues) 中反馈或直接修改 src/models/lif.ts 中的 long_zh 字段。]*`,
  long: `Each cell on the 32×32 (or larger) grid is a **leaky integrate-and-fire neuron** with membrane voltage V evolving as

dV/dt = −V/τ + Σ_neighbours (synaptic kicks) + I_drive

When V crosses the threshold, the neuron emits a **spike** (bright white flash), V resets to rest, and the cell enters a short refractory period during which it can't fire again. Spikes from a neighbour arrive as an instantaneous +W_syn kick.

A small disc of cells in the centre is driven by a constant current **I_drive** — these become persistent oscillators. Their spikes radiate outward; at moderate **W_syn**, neighbouring cells get enough drive to spike themselves, and a wavefront of synchronised spiking propagates across the grid. Behind every wavefront is a trailing refractory zone — neurons can't fire twice in a row — so colliding waves **annihilate**, exactly like the Gray-Scott excitable-medium pattern but emerging from real neural dynamics.

**Try:**

— **W_syn = 1.0 / I_drive = 0.5** (default): clean radial waves from the centre, repeating every few hundred ms.
— **W_syn ↓ to 0.5**: drive maintains a small spot but waves don't propagate. The activity stays localised.
— **W_syn ↑ to 2.0**: runaway — the network synchronises globally and bursts in unison. Pathological state, similar to **epileptic seizure** in real cortex.
— **I_drive ↑ to 1.0**: drive cells fire faster, more frequent waves.
— **I_drive = 0**: no drive. With moderate W_syn, network goes silent within a few seconds (no source of activity).

**Connection to the rest of the gallery**:

Hopfield + Ising used **discrete ±1 spins** with sigmoid updates — the same substrate but with no time dynamics, no spikes. LIF adds **continuous voltage + threshold crossings + refractoriness** — the minimum needed to make it look like a real neuron. The wave propagation is the same kind of excitable-medium dynamics as Gray-Scott, but the "molecules" are now spikes and the "diffusion" is now synaptic transmission.

**Things to try**

— Default: clean radial waves from the centre.
— W_syn ↓ to 0.5: drive maintains a small spot but waves don't propagate.
— W_syn ↑ to 2.0: runaway global synchrony — pathological "epileptic" state.

Reference: Lapicque, *J. Physiol. Pathol. Gén.* 9, 620 (1907). The model is over a century old, predates Hodgkin-Huxley, and is **still the standard "neuron" used in modern spiking-neural-network simulations** — Loihi, SpiNNaker, BrainScaleS, all the neuromorphic hardware platforms run LIF or close variants at scale.`,

  view: 'grid',

  params: {
    W_syn:   { label: 'W_syn (synaptic weight)', min: 0,    max: 3.0, step: 0.05, default: 1.0,  live: true },
    I_drive: { label: 'I_drive (drive current)', min: 0,    max: 1.5, step: 0.01, default: 0.50, live: true },
    size:    { label: 'grid size',               min: 32,   max: 200, step: 8,    default: 96,   live: false },
    speed:   { label: 'speed',                   min: 0.1,  max: 5,   step: 0.1,  default: 1.0,  live: true },
  },

  presets: [
    {
      id: 'waves',
      name: 'travelling waves (default)',
      short: 'Drive in centre + moderate coupling. Concentric waves of spikes radiate outward every ~200 ms; colliding wavefronts annihilate in the trailing refractory zones.',
      params: { W_syn: 1.0, I_drive: 0.5, size: 96 },
      seed: 1,
    },
    {
      id: 'localized',
      name: 'localised oscillator (subcritical)',
      short: 'Coupling too weak to propagate. Drive cells oscillate but neighbours can\'t catch the wave — activity stays confined to the seed region.',
      params: { W_syn: 0.4, I_drive: 0.5, size: 96 },
      seed: 1,
    },
    {
      id: 'runaway',
      name: 'runaway / global sync',
      short: 'Coupling strong enough that one spike triggers cascading neighbours that loop back. The whole network synchronises and fires in unison — pathological "epileptiform" state.',
      params: { W_syn: 2.2, I_drive: 0.5, size: 96 },
      seed: 1,
    },
    {
      id: 'silent',
      name: 'silent (no drive)',
      short: 'No external drive. Without a source of activity the network decays to rest within a few seconds. Try ramping I_drive up live to watch ignition.',
      params: { W_syn: 1.0, I_drive: 0.0, size: 96 },
      seed: 1,
    },
  ],

  init(params: ParamValues, rng: RNG): ModelState {
    const size = Math.round(params.size as number);
    const N = size * size;
    const graph = buildGrid(size, size);

    // d=2 per cell: [V, spike_age]
    //   V          — membrane voltage (rest = 0, threshold = 1)
    //   spike_age  — frames since last spike. 0 = just spiked. Large = ready.
    const X = new Float64Array(N * 2);
    for (let i = 0; i < N; i++) {
      X[i * 2] = rng.uniform(-0.05, 0.05); // tiny noise around rest
      X[i * 2 + 1] = 1000;                 // far from any spike
    }

    return { N, d: 2, X, graph, t: 0, step_count: 0, cols: size, rows: size };
  },

  step(state: ModelState, params: ParamValues): void {
    const { N, X, graph, cols, rows } = state;
    const adj = graph.adj;
    const W = params.W_syn as number;
    const I_drive = params.I_drive as number;
    const speed = params.speed as number;

    // Constants — fixed for this model. Could be exposed as sliders later.
    const tau = 20;          // membrane time constant (in steps)
    const threshold = 1.0;
    const V_rest = 0.0;
    const T_ref = 4;         // refractory period (steps)
    const dt = 1.0;

    // Drive region: a square in the centre.
    const cx = (cols! / 2) | 0;
    const cy = (rows! / 2) | 0;
    const driveR = Math.max(3, (Math.min(cols!, rows!) / 16) | 0);

    const SUB = Math.max(1, Math.round(speed));

    // Reuse work buffer — at N=96² the per-frame allocation was 147 KB.
    const aux = state as ModelState & { _X_new?: Float64Array };
    if (!aux._X_new || aux._X_new.length !== N * 2) aux._X_new = new Float64Array(N * 2);
    const X_new = aux._X_new;

    for (let sub = 0; sub < SUB; sub++) {

    for (let i = 0; i < N; i++) {
      const V = X[i * 2]!;
      const age = X[i * 2 + 1]!;

      if (age < T_ref) {
        // refractory — voltage held at rest, age counter advances
        X_new[i * 2] = V_rest;
        X_new[i * 2 + 1] = age + 1;
        continue;
      }

      // gather synaptic input from neighbours that just spiked (age == 0 in OLD state)
      let synInput = 0;
      const ai = adj[i]!;
      for (let p = 0; p < ai.length; p++) {
        if (X[ai[p]! * 2 + 1] === 0) synInput += W;
      }

      // drive current for cells in the centre square
      const r = (i / cols!) | 0;
      const c = i - r * cols!;
      const drive =
        (Math.abs(r - cy) <= driveR && Math.abs(c - cx) <= driveR) ? I_drive : 0;

      // forward Euler integration
      const V_next = V + dt * (-V / tau + synInput + drive);

      if (V_next >= threshold) {
        // SPIKE
        X_new[i * 2] = V_rest;
        X_new[i * 2 + 1] = 0;
      } else {
        X_new[i * 2] = V_next;
        // cap age at 1000 to avoid float drift on quiet cells
        X_new[i * 2 + 1] = Math.min(age + 1, 1000);
      }
    }

    for (let i = 0; i < N * 2; i++) X[i] = X_new[i]!;
    state.step_count++;
    state.t = state.step_count;

    } // end SUB loop
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      const V = state.X[i * 2]!;
      const age = state.X[i * 2 + 1]!;

      // freshest spike → bright white flash
      if (age === 0) return '#ffffff';
      // refractory afterglow → fading yellow
      if (age <= 3) {
        const fade = age / 3;
        const r = Math.round(255 - 60 * fade);
        const g = Math.round(255 - 100 * fade);
        const b = Math.round(180 - 130 * fade);
        return `rgb(${r},${g},${b})`;
      }
      // resting / integrating → V mapped to dark navy → red-orange
      let t = (V - V_REST_LO) / (V_REST_HI - V_REST_LO);
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
      label: 'membrane voltage distribution',
      range: [V_REST_LO, V_REST_HI],
      bins: 30,
      values(state: ModelState): Float64Array {
        const N = state.N;
        const out = new Float64Array(N);
        for (let i = 0; i < N; i++) out[i] = state.X[i * 2]!;
        return out;
      },
    },
    timeSeries: {
      label: 'population firing rate',
      value(state: ModelState): number {
        let count = 0;
        for (let i = 0; i < state.N; i++) {
          if (state.X[i * 2 + 1] === 0) count++;
        }
        return count / state.N;
      },
    },
  },
};

export default lif;
