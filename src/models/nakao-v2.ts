// Nakao network Turing — re-implemented with the v2 declarative API.
// Compare with src/models/nakao.ts (172 lines). This file is ~70 lines
// of model-specific content; the rest is boilerplate the v2 runtime
// absorbs.

import { define, topology, init, update, render, diagnostics } from '../v2/api.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

export default define({
  id: 'nakao-v2',
  name: 'Network Turing — v2 prototype',
  short: 'Same as Network Turing, expressed in the v2 declarative API. ~70 lines of model-specific content vs 172 in the original.',
  long: `Identical dynamics to the **Network Turing** demo (Nakao & Mikhailov 2010): Mimura–Murray reaction at each node + graph-Laplacian diffusion. The difference is the source code. This file declares only what is **specific** to Nakao — kinetics, parameter schema, presets — and lets the v2 runtime handle graph construction, sub-step looping, buffer reuse, and diagnostics.

Compare the two implementations side by side: \`src/models/nakao.ts\` (172 lines, all hand-written) vs \`src/models/nakao-v2.ts\` (~70 lines, declarative).

Reference: Nakao & Mikhailov, *Nature Physics* 6, 544–550 (2010).`,

  view: 'graph',

  params: {
    Du:   { label: 'D_u (activator)', min: 0,  max: 1,    step: 0.001, default: 0.05, live: true },
    Dv:   { label: 'D_v (inhibitor)', min: 0,  max: 10,   step: 0.01,  default: 3.00, live: true },
    N:    { label: 'nodes',           min: 50, max: 1000, step: 10,    default: 200,  live: false },
    k:    { label: 'avg degree',      min: 2,  max: 14,   step: 1,     default: 6,    live: false },
    topo: { label: 'topology',        options: TOPO_OPTS, default: 'ba',              live: false },
    speed:{ label: 'speed',           min: 0.1, max: 5, step: 0.1,    default: 1.0,   live: true },
  },

  // Topology depends on params (size + topology choice are user-controlled)
  topology: (params) =>
    topology.randomGraph(params.topo as 'er' | 'ba' | 'ws', {
      N: Math.round(params.N as number),
      k: Math.round(params.k as number),
    }),

  // Node state: 2-vector (u, v) initialised near the (5, 10) fixed point
  state: {
    d: 2,
    init: init.fpWithNoise([5, 10], 0.05),
  },

  // Synchronous Forward Euler with sub-stepping. Rule expresses the Mimura–
  // Murray reaction + graph-Laplacian diffusion using ctx helpers.
  step: update.sync({
    dt: 0.002,
    substeps: 25,
    rule: (i, ctx, params) => {
      const u = ctx.s(i, 0);
      const v = ctx.s(i, 1);
      const A = 35, B = 16, C = 9, D = 0.4;
      const reactU = ((A + B * u - u * u) / C - v) * u;
      const reactV = (u - 1 - D * v) * v;
      const diffU = (params.Du as number) * ctx.neighborDiffSum(i, 0);
      const diffV = (params.Dv as number) * ctx.neighborDiffSum(i, 1);
      return [reactU + diffU, reactV + diffV];
    },
  }),

  render: render.divergingByField(0, 5, 4.5),

  diagnostics: {
    histogram: diagnostics.histogramOf(0, [0, 12], 30, 'u distribution'),
    timeSeries: diagnostics.stdOf(0, 'σ(u) over time'),
  },
});
