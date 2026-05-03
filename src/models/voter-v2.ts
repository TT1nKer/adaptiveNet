// Adaptive Voter (Holme–Newman 2006) — re-implemented with the v2 API.
// Compare with src/models/voter.ts (151 lines).

import { define, topology, init, update, render, diagnostics } from '../v2/api.ts';
import type { ModelState } from '../types.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

export default define({
  id: 'voter-v2',
  name: 'Adaptive Voter — v2 prototype',
  short: 'Holme–Newman voter expressed in the v2 declarative API. Demonstrates the event-per-edge scheduling regime.',
  long: `Identical dynamics to the **Adaptive Voter** demo. Each event picks a random edge: if endpoints disagree, with probability φ the edge is rewired (j drops i, reconnects to a same-opinion node); with 1−φ one endpoint copies the other. Below φ_c ≈ 0.46 → consensus; above → echo-chamber fragmentation.

The v2 file expresses this as one \`update.eventPerEdge\` block instead of a hand-rolled event loop. Compare \`src/models/voter.ts\` (151 lines) vs \`src/models/voter-v2.ts\` (~70 lines).

Reference: Holme & Newman, *Phys. Rev. E* 74, 056108 (2006).`,

  view: 'graph',

  params: {
    phi:  { label: 'φ (rewire prob)',  min: 0,  max: 1,    step: 0.01, default: 0.4, live: true },
    N:    { label: 'nodes',            min: 50, max: 1000, step: 10,   default: 200, live: false },
    k:    { label: 'avg degree',       min: 2,  max: 14,   step: 1,    default: 4,   live: false },
    topo: { label: 'topology (init)',  options: TOPO_OPTS, default: 'er',             live: false },
    speed:{ label: 'speed',            min: 0.1, max: 5,   step: 0.1,  default: 1.0,  live: true },
  },

  topology: (params) =>
    topology.randomGraph(params.topo as 'er' | 'ba' | 'ws', {
      N: Math.round(params.N as number),
      k: Math.round(params.k as number),
    }),

  state: {
    d: 1,
    init: init.randomBinary([0, 1]),
  },

  // Event-per-edge: pick a random edge; if endpoints disagree, rewire or copy.
  step: update.eventPerEdge({
    eventsPerFrame: (_p, edgeCount) => Math.max(1, Math.floor(edgeCount * 0.05)),
    rule: (i, j, eIdx, X, _d, graph, params, rng) => {
      if (X[i] === X[j]) return;

      const phi = params.phi as number;
      const { adj, edges, deg } = graph;
      const N = graph.N;

      if (rng.next() < phi) {
        // rewire: j drops i, reconnects to same-opinion node
        const opinion = X[j]!;
        adj[i] = adj[i]!.filter((x) => x !== j);
        adj[j] = adj[j]!.filter((x) => x !== i);
        deg[i]!--;
        deg[j]!--;
        const last = edges[edges.length - 1]!;
        edges[eIdx] = last;
        edges.pop();

        let kk = -1;
        for (let attempts = 0; attempts < 30; attempts++) {
          const cand = rng.int(N);
          if (cand === j) continue;
          if (X[cand] !== opinion) continue;
          if (adj[j]!.includes(cand)) continue;
          kk = cand;
          break;
        }
        if (kk >= 0) {
          adj[j]!.push(kk);
          adj[kk]!.push(j);
          deg[j]!++;
          deg[kk]!++;
          edges.push(j < kk ? [j, kk] : [kk, j]);
        }
      } else {
        // copy: one endpoint adopts the other's opinion
        if (rng.next() < 0.5) X[i] = X[j]!;
        else X[j] = X[i]!;
      }
    },
  }),

  render: render.binaryByField(0, '#e63946', '#2c5fbf'),

  diagnostics: {
    histogram: diagnostics.histogramOf(0, [0, 1], 2, 'opinion distribution'),
    timeSeries: diagnostics.scalarFromState('fraction of discordant edges', (state: ModelState) => {
      const { X, graph } = state;
      const edges = graph.edges;
      if (edges.length === 0) return 0;
      let count = 0;
      for (let e = 0; e < edges.length; e++) {
        const [i, j] = edges[e]!;
        if (X[i] !== X[j]) count++;
      }
      return count / edges.length;
    }),
  },
});
