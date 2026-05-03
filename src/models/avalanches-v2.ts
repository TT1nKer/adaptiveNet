// Neural Avalanches / SOC sandpile — v2 prototype.
// Compare with src/models/avalanches.ts (254 lines).

import { define, topology, init, update, render, diagnostics } from '../v2/api.ts';
import type { ModelState } from '../types.ts';

export default define({
  id: 'avalanches-v2',
  name: 'Neural Avalanches — v2 prototype',
  short: 'Bak–Tang–Wiesenfeld sandpile expressed in the v2 declarative API. Demonstrates the drive-and-cascade scheduling regime.',
  long: `Identical dynamics to the **Neural Avalanches** demo. Drive: per frame, a number of random cells receive a small dose. If activity ≥ threshold, the cell fires: activity dumps to threshold floor, (1−ε)/4 of threshold goes to each neighbour, possibly cascading. Avalanche sizes follow s^(−3/2) — the SOC signature found in cortical slices (Beggs & Plenz 2003).

The v2 file expresses this as one \`update.driveAndCascade\` block. Compare \`src/models/avalanches.ts\` (254 lines) vs \`src/models/avalanches-v2.ts\` (~70 lines).

References: Bak, Tang & Wiesenfeld, *Phys. Rev. Lett.* 59, 381 (1987). Beggs & Plenz, *J. Neurosci.* 23, 11167 (2003).`,

  view: 'grid',

  params: {
    dose:        { label: 'drive dose',           min: 0.05, max: 1.0, step: 0.01, default: 0.10, live: true },
    dissipation: { label: 'dissipation ε',        min: 0,    max: 0.3, step: 0.005, default: 0.04, live: true },
    drives_per_frame: { label: 'drive events / frame', min: 1, max: 200, step: 1, default: 30, live: true },
    size:        { label: 'grid size',            min: 32,   max: 200, step: 8,    default: 96,   live: false },
    speed:       { label: 'speed',                min: 0.1,  max: 5,   step: 0.1,  default: 1.0,  live: true },
  },

  topology: (params) =>
    topology.grid(Math.round(params.size as number), Math.round(params.size as number), { periodic: true }),

  state: {
    // d=2 per cell: [activity, fire_age]
    d: 2,
    init: (i, d, X, rng) => {
      X[i * d] = rng.uniform(0, 0.5);
      X[i * d + 1] = 1000;
    },
  },

  step: update.driveAndCascade({
    drivesPerFrame: (p) => p.drives_per_frame as number,
    drive: (i, X, d, params) => {
      X[i * d] = X[i * d]! + (params.dose as number);
    },
    threshold: 1.0,
    fire: (i, X, d, graph, params, push) => {
      const eps = params.dissipation as number;
      const transfer = (1 - eps) / 4;
      const ai = graph.adj[i]!;
      for (let p = 0; p < ai.length; p++) {
        const j = ai[p]!;
        X[j * d] = X[j * d]! + transfer;
        push(j);
      }
    },
    ageField: 1,
    diagnosticField: '_smoothSize',
  }),

  render: render.gridWithFlash({
    valueField: 0,
    ageField: 1,
    range: [0, 1.0],
  }),

  diagnostics: {
    histogram: diagnostics.histogramOf(0, [0, 1.2], 30, 'cell activity distribution'),
    timeSeries: diagnostics.scalarFromState('avalanche size (smoothed)', (state) =>
      ((state as ModelState & { _smoothSize?: number })._smoothSize ?? 0),
    ),
  },
});
