// Leaky Integrate-and-Fire (LIF) neurons on a 2D square lattice.
//
// The simplest spiking-neuron model used in computational neuroscience since
// Lapicque's 1907 paper, predating Hodgkin-Huxley by 45 years. Each cell has
// a membrane voltage V that integrates synaptic input and leaks toward rest:
//
//   dV/dt = -V / τ + Σ_neighbours (synaptic input) + I_drive
//
// When V crosses the firing threshold, the neuron emits a spike, V resets to
// rest, and the cell enters a brief refractory period during which it cannot
// fire again. Spikes from neighbours arrive as instantaneous voltage kicks
// of size W_syn.
//
// A small region of cells in the centre is driven by a constant input current
// I_drive — these become the wave seed. With moderate W_syn each driver
// spike is enough to push its neighbours past threshold, and a wavefront of
// spikes propagates outward across the grid. Behind each wavefront is a
// trailing refractory zone where neurons can't fire again for a few steps,
// so colliding waves annihilate — the same excitable-medium phenomenology
// you saw in Gray-Scott, but emerging from genuine neural dynamics rather
// than chemistry.

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
    const X_new = new Float64Array(N * 2);

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
