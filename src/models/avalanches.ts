// Self-Organised Criticality (SOC) — Bak-Tang-Wiesenfeld sandpile model
// adapted to a continuous-activity 2D lattice with mild dissipation. Drives
// the system slowly and lets each grain trigger an avalanche of cascading
// fires when it pushes a cell above threshold.
//
// The signature phenomenon: avalanche sizes are distributed as a power law
//   P(s) ~ s^{-3/2}
// over many decades. Same exponent for sandpiles, forest fires, earthquakes,
// magnetic Barkhausen noise, and — Beggs & Plenz 2003 — neural avalanches in
// cortical slice cultures. The fact that all these systems share the same
// exponent is the empirical fingerprint of universal critical behaviour.
//
// Beggs & Plenz's discovery — that neural firing in cortex follows the same
// statistics as a sandpile — is the strongest evidence so far that the
// brain operates near a critical point. This demo gives you the visceral
// version: most of the time the lattice looks dead-quiet, then a single
// extra grain triggers a cascade that lights up half the canvas.

import type { Model, ModelState, ParamValues, Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

interface AvalancheState extends ModelState {
  _lastSize: number;            // size of most recent avalanche
  _smoothSize: number;          // exponentially smoothed avalanche size
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
  long: `Each cell of the 2D grid has an activity X. Once per drive event, a random cell receives a kick: X[i] += dose. If the activity exceeds threshold (set to 1), the cell **fires**: its activity dumps to zero and is redistributed to its 4 neighbours, each gaining a fraction (1−ε) / 4 of the threshold. With a small dissipation ε > 0, some activity leaves the system; the steady state is finite.

Crucially, **a fire can push neighbours past threshold** — and they fire too. The cascade triggered by a single drive event is the **avalanche**. Most are tiny (just the original fire). Some are enormous, sweeping across thousands of cells before activity falls back below threshold everywhere.

The signature phenomenon: avalanche sizes follow a power-law distribution P(s) ~ s^(−3/2), with a fat upper tail extending out to the system size. This exponent is universal — it shows up in:

— **Bak–Tang–Wiesenfeld 1987**: the original sandpile. Bak, Tang & Wiesenfeld coined "self-organised criticality" because the system tunes itself to the critical state without external parameters.
— **Real sand piles** (Held et al. 1990): drop grains slowly, the avalanches that result follow s^(−3/2).
— **Forest fires, earthquakes, solar flares**: each follows a power law with a related exponent.
— **Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003)**: cortical slice cultures from rat brain show neural avalanches with **the same** s^(−3/2) exponent. This was the first direct evidence that cortex operates near criticality.

In this demo, watch the σ time-series — it shows the size of the most recent avalanche on a roughly logarithmic-feeling scale. Most of the time it's a flat line near 1 (single-cell events). Then a spike: 100, 500, 1000+ cells fired in a single cascade. **The wide range itself is the demo**. Linear-scale histograms make the heavy tail less visible; the fact that you see truly enormous avalanches alongside tiny ones is what "power-law distributed" looks like in practice.

**Why this matters for the brain.** The brain's energy budget rules out very dense or very sparse activity — too dense and metabolic cost explodes; too sparse and information transmission breaks down. Self-organised criticality is the regime that maximises information transmission per unit of activity (Beggs 2008), and the s^(−3/2) statistics in cortex suggest the brain has been tuned by evolution to operate in this regime. **Mental disease may be small drift away from critical**: too much activity → seizure (super-critical, runaway avalanches), too little → loss of function (sub-critical). The same physics; different drift directions.

**For instructors — five Δ-experiments suitable for problem sets**

**1. Verify the power-law exponent.** Run for ~10⁵ avalanches (build up statistics). Plot the avalanche-size distribution on log-log axes. Fit the slope. The BTW prediction in 2D is τ ≈ 1.0 (not −3/2 — that −3/2 is the Beggs-Plenz neural value, which BTW only approaches under specific dimensions). Compare your slope to both. What does the discrepancy reveal about which model the demo actually implements?

**2. Dissipation ε.** Vary the dissipation rate ε from 0 to 0.1. With ε = 0, the system never reaches steady state (avalanches grow unboundedly in expectation). With ε too large, criticality is destroyed. Find the qualitative regimes. The *self-organised* in SOC means the system tunes itself to the critical line for small ε > 0.

**3. Methodological knob: bin size.** The Beggs-Plenz 2003 work computed avalanches by binning spike times into 4 ms windows. Bin size dramatically affects the apparent power-law slope (Touboul-Destexhe 2017 critique). Vary the time-bin width over 1-10 simulation steps. How much does the apparent τ change? This is the *core* of the Plenz-vs-Touboul methodological debate.

**4. Subsampling effect.** Compute the avalanche distribution from observing only a fraction (10%, 50%, 100%) of cells. The Touboul-Destexhe critique argued that subsampling alone can produce apparent power laws even from non-critical dynamics. Test it: does subsampling artificially introduce a power law? (This experiment requires a custom export of cell activity; advanced.)

**5. Compare Plenz exponent to Clauset-Shalizi-Newman 2009 KS test.** The standard practice for declaring "this is power-law" is the CSN 2009 procedure: fit power-law via maximum likelihood, then compute KS distance to lognormal and exponential alternatives. Apply this to your data. Does the power-law hypothesis actually win, or do lognormal / exponential fit comparably well? This is the gold-standard methodology that much of the brain-criticality literature still does not consistently apply.

References: Bak, Tang & Wiesenfeld, *Phys. Rev. Lett.* 59, 381 (1987). Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003). Beggs, *Phil. Trans. R. Soc. A* 366, 329 (2008). Touboul & Destexhe, *PLOS ONE* 12, e0181104 (2017). Clauset, Shalizi & Newman, *SIAM Review* 51, 661 (2009).`,

  view: 'grid',

  params: {
    dose:        { label: 'drive dose',           min: 0.05, max: 1.0, step: 0.01, default: 0.10, live: true },
    dissipation: { label: 'dissipation ε',        min: 0,    max: 0.3, step: 0.005, default: 0.04, live: true },
    drives_per_frame: { label: 'drive events / frame', min: 1, max: 200, step: 1, default: 30,   live: true },
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
    };
  },

  step(state: AvalancheState, params: ParamValues, rng: RNG): void {
    const { N, X, graph } = state;
    const adj = graph.adj;
    const dose = params.dose as number;
    const eps = params.dissipation as number;
    const drivesPerFrame = Math.max(1, Math.round((params.drives_per_frame as number) * (params.speed as number)));

    const threshold = 1.0;
    const transferFraction = (1 - eps) / 4;  // fraction of threshold passed to each of 4 neighbours

    // Resolve cascades using a stack (DFS-like), reused across drives
    const aux = state as AvalancheState & { _stack?: Int32Array; _stackTop?: { v: number } };
    if (!aux._stack || aux._stack.length < N) aux._stack = new Int32Array(N);
    const stack = aux._stack;
    let totalFires = 0;

    // age all cells (for visual flash decay)
    for (let i = 0; i < N; i++) {
      X[i * 2 + 1] = Math.min(X[i * 2 + 1]! + 1, 1000);
    }

    for (let d = 0; d < drivesPerFrame; d++) {
      // drive: random cell gets a dose
      const seed_i = rng.int(N);
      X[seed_i * 2] = X[seed_i * 2]! + dose;

      // resolve any cascades triggered
      let top = 0;
      if (X[seed_i * 2]! >= threshold) {
        stack[top++] = seed_i;
      }

      while (top > 0) {
        const i = stack[--top]!;
        if (X[i * 2]! < threshold) continue;
        // fire: dump activity to threshold floor, transfer to neighbours
        X[i * 2] = X[i * 2]! - threshold;     // keep any excess (over threshold)
        X[i * 2 + 1] = 0;                      // mark as just-fired
        totalFires++;

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
    }

    state._lastSize = totalFires;
    // Exponential moving average for smoother time-series visualisation
    state._smoothSize = state._smoothSize * 0.85 + totalFires * 0.15;

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
