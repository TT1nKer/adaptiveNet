// Nakao network Turing — v2 with the library layer.
// Compare with src/models/nakao.ts (172 lines, all hand-written) and the
// earlier v2 prototype (~70 lines, declarative but inline kinetics). This
// version uses the named reaction from the library so the model's source
// no longer encodes any kinetics — it just composes existing parts.

import { define, topology, init, update, render, diagnostics } from '../v2/api.ts';
import * as reactions from '../v2/reactions.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

export default define({
  id: 'nakao-v2',
  name: 'Network Turing — v2 prototype',
  short: 'Same as Network Turing, expressed via named reaction kernel + reactionDiffusion pattern. Source has zero hand-written kinetics or step logic.',
  long: `Identical dynamics to the **Network Turing** demo. Source code shrinks at each abstraction level:

— Original \`nakao.ts\`: 172 lines (all hand-written: graph ops + sub-step loop + reaction inline).
— v2 declarative (earlier): ~70 lines (graph + step boilerplate gone, kinetics still inline).
— v2 + library (this file): **~40 lines of model-specific content**, kinetics replaced with \`reactions.mimuraMurray()\` from the library and step replaced with \`update.reactionDiffusion()\` pattern.

Reference: Nakao & Mikhailov, *Nature Physics* 6, 544–550 (2010). Mimura–Murray kinetics: Mimura & Murray (1978).`,

  view: 'graph',

  params: {
    Du:   { label: 'D_u (activator)', min: 0,  max: 1,    step: 0.001, default: 0.05, live: true },
    Dv:   { label: 'D_v (inhibitor)', min: 0,  max: 10,   step: 0.01,  default: 3.00, live: true },
    N:    { label: 'nodes',           min: 50, max: 1000, step: 10,    default: 200,  live: false },
    k:    { label: 'avg degree',      min: 2,  max: 14,   step: 1,     default: 6,    live: false },
    topo: { label: 'topology',        options: TOPO_OPTS, default: 'ba',              live: false },
    speed:{ label: 'speed',           min: 0.1, max: 5, step: 0.1,    default: 1.0,   live: true },
  },

  topology: (params) =>
    topology.randomGraph(params.topo as 'er' | 'ba' | 'ws', {
      N: Math.round(params.N as number),
      k: Math.round(params.k as number),
    }),

  state: {
    d: 2,
    init: init.fpWithNoise([5, 10], 0.05),
  },

  // Pure composition: pick a named reaction, declare which params control D,
  // declare the integrator. No rule function written by hand.
  step: update.reactionDiffusion({
    reaction: reactions.mimuraMurray(),  // default (a,b,c,d) = (35, 16, 9, 0.4) — FP at (5, 10)
    diffusion: { D: ['Du', 'Dv'] },
    dt: 0.002,
    substeps: 25,
  }),

  render: render.divergingByField(0, 5, 4.5),

  diagnostics: {
    histogram: diagnostics.histogramOf(0, [0, 12], 30, 'u distribution'),
    timeSeries: diagnostics.stdOf(0, 'σ(u) over time'),
  },
});
