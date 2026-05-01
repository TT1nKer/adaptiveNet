// Holme & Newman (Phys. Rev. E 74, 056108, 2006): coevolution of opinions
// and network structure. Each node carries a binary opinion. At each event
// a random edge is examined: if the two endpoints disagree, with probability
// φ the edge is rewired to a random same-opinion neighbor; otherwise one
// endpoint copies the other's opinion. There is a sharp phase transition
// at φ_c ≈ 0.46: below it the network reaches consensus, above it it
// fragments into two disconnected echo chambers.

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

const voter: Model = {
  id: 'holme-newman',
  name: 'Adaptive Voter (Holme–Newman)',
  short: 'Edges rewire when neighbors disagree; opinions copy when they don\'t. Echo chambers form below a critical rewire rate.',
  long: `Each node holds a binary opinion (red or blue). Repeatedly, a random edge (i, j) is selected:

— if the two endpoints share an opinion, nothing happens.
— otherwise, with probability **φ** the edge is *rewired*: j drops i and reconnects to a random other node sharing j's opinion. With probability 1 − φ, one endpoint *copies* the other's opinion.

The **fraction of discordant edges** (edges connecting opposite opinions) is the order parameter. It always decays to zero, but in two qualitatively different ways:

— **Low φ:** copying dominates → opinions homogenize → *consensus*.
— **High φ:** rewiring dominates → the network splits in two → *fragmentation* (echo chambers).

The transition at φ_c ≈ 0.46 is sharp. Try φ = 0.3 vs φ = 0.6 and watch the network dynamics differ qualitatively.

Reference: Holme & Newman, *Phys. Rev. E* 74, 056108 (2006).`,

  params: {
    phi:  { label: 'φ (rewire prob)', min: 0,  max: 1,    step: 0.01, default: 0.4, live: true },
    N:    { label: 'nodes',           min: 50, max: 1000, step: 10,   default: 200, live: false },
    k:    { label: 'avg degree',      min: 2,  max: 14,   step: 1,    default: 4,   live: false },
    topo: { label: 'topology (init)', options: TOPO_OPTS, default: 'er',             live: false },
  },

  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const generator = generators[topo];
    if (!generator) throw new Error(`unknown topology: ${topo}`);
    const graph = generator(N, k, rng);

    // opinion ∈ {0, 1} uniformly
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < 0.5 ? 0 : 1;

    return { N, d: 1, X, graph, t: 0, step_count: 0 };
  },

  step(state: ModelState, params: ParamValues, rng: RNG): void {
    const phi = params.phi as number;
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;

    if (edges.length === 0) return;

    // ~5% of edges per frame: visible movement without overwhelming the eye.
    const eventsPerFrame = Math.max(1, Math.floor(edges.length * 0.05));

    for (let s = 0; s < eventsPerFrame; s++) {
      if (edges.length === 0) return;
      const eIdx = rng.int(edges.length);
      const [i, j] = edges[eIdx]!;

      if (X[i] === X[j]) continue;

      if (rng.next() < phi) {
        // ----- rewire: j drops i, reconnects to a random same-opinion node -----
        const opinion = X[j]!;
        // remove edge from adj
        adj[i] = adj[i]!.filter((x) => x !== j);
        adj[j] = adj[j]!.filter((x) => x !== i);
        deg[i]!--;
        deg[j]!--;
        // remove from edges array (swap-pop, O(1))
        const last = edges[edges.length - 1]!;
        edges[eIdx] = last;
        edges.pop();

        // find a random node k of the same opinion not already connected to j
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
        // ----- copy: one endpoint adopts the other's opinion (random direction) -----
        if (rng.next() < 0.5) X[i] = X[j]!;
        else X[j] = X[i]!;
      }
      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state: ModelState, i: number): string {
      return state.X[i]! > 0.5 ? '#e63946' : '#2c5fbf';
    },
    nodeSize(state: ModelState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  observe: {
    histogram: {
      label: 'opinion distribution',
      range: [0, 1],
      bins: 2,
      values(state: ModelState): Float64Array {
        // X is already length N for d=1
        return state.X;
      },
    },
    timeSeries: {
      label: 'fraction of discordant edges',
      value(state: ModelState): number {
        const { X, graph } = state;
        const edges = graph.edges;
        if (edges.length === 0) return 0;
        let count = 0;
        for (let e = 0; e < edges.length; e++) {
          const [i, j] = edges[e]!;
          if (X[i] !== X[j]) count++;
        }
        return count / edges.length;
      },
    },
  },
};

export default voter;
