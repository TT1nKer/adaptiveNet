// Brusselator on a 2D grid — v2 with the library layer.
//
// Same dynamics as the production Brusselator demo. The body of this file
// is mostly: param schema + topology hookup + which reaction from the
// library + which colour map. ~50 lines vs 280 in the original.
//
// Demonstrates that the v2 library composes for a different model on a
// different topology with no new code beyond the declarations: just point
// `reactionDiffusion` at `reactions.brusselator()` instead of
// `reactions.mimuraMurray()`, swap topology to grid, done.

import { define, topology, init, update, render, diagnostics } from '../v2/api.ts';
import * as reactions from '../v2/reactions.ts';

export default define({
  id: 'brusselator-v2',
  name: 'Classical Turing — v2 prototype',
  short: 'Brusselator on a 2D lattice via the v2 library. Same physics as the production demo, ~50 lines of declaration.',
  long: `Identical dynamics to the **Classical Turing (Brusselator)** demo. Source body is just declarations: param schema, topology, named reaction from \`v2/reactions.ts\`, colour map.

Switching this model from Brusselator to Schnakenberg (or Mimura–Murray, or Gray–Scott) is a one-line change: swap which factory in \`reactions\` is referenced. Switching from grid to a random graph is another one-line change in \`topology\`. The library composes both axes orthogonally.`,

  view: 'grid',

  params: {
    a:    { label: 'a',                   min: 1,    max: 8,   step: 0.1,   default: 4.5,  live: true },
    b:    { label: 'b',                   min: 1,    max: 12,  step: 0.1,   default: 7.5,  live: true },
    Du:   { label: 'D_u (activator)',     min: 0,    max: 2,   step: 0.01,  default: 0.50, live: true },
    Dv:   { label: 'D_v (inhibitor)',     min: 0,    max: 12,  step: 0.05,  default: 4.00, live: true },
    size: { label: 'grid size',           min: 32,   max: 256, step: 8,     default: 160,  live: false },
    speed:{ label: 'speed',               min: 0.1,  max: 5,   step: 0.1,   default: 1.0,  live: true },
  },

  topology: (params) =>
    topology.grid(Math.round(params.size as number), Math.round(params.size as number), { periodic: true }),

  state: {
    d: 2,
    // initialise around FP=(a, b/a) with substantial noise so the Turing
    // instability has something to grow.
    init: (i, d, X, rng, _ctx) => {
      // params not in scope — use a sensible neutral init that works for the
      // default a/b. The production Brusselator demo recomputes FP from
      // a, b each init; we fix it to match the default (4.5, 1.667).
      X[i * d] = 4.5 + rng.uniform(-0.5, 0.5);
      X[i * d + 1] = 1.667 + rng.uniform(-0.5, 0.5);
    },
  },

  step: update.reactionDiffusion({
    reaction: reactions.brusselator({ a: 'a', b: 'b' }),
    diffusion: { D: ['Du', 'Dv'] },
    dt: 0.02,
    substeps: 25,
  }),

  render: render.gridDiverging(0, 4.5, 2.7),

  diagnostics: {
    histogram: diagnostics.histogramOf(0, [0, 12], 30, 'u distribution'),
    timeSeries: diagnostics.stdOf(0, 'σ(u) — pattern amplitude'),
  },
});
