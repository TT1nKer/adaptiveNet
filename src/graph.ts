// Graph generators. Sparse representation: adj[i] is the list of neighbor
// indices of node i. Returned objects share the Graph shape.

import type { Graph } from './types.ts';
import type { RNG } from './rng.ts';

function emptyAdj(n: number): number[][] {
  return Array.from({ length: n }, () => [] as number[]);
}

function addEdge(
  adj: number[][],
  edges: Array<[number, number]>,
  i: number,
  j: number,
): boolean {
  if (i === j) return false;
  if (adj[i]!.includes(j)) return false;
  adj[i]!.push(j);
  adj[j]!.push(i);
  edges.push(i < j ? [i, j] : [j, i]);
  return true;
}

function finalize(N: number, adj: number[][], edges: Array<[number, number]>): Graph {
  const deg = new Int32Array(N);
  for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
  return { N, adj, edges, deg };
}

export function buildER(N: number, avgK: number, rng: RNG): Graph {
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  const p = avgK / Math.max(1, N - 1);
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (rng.next() < p) addEdge(adj, edges, i, j);
    }
  }
  for (let i = 0; i < N; i++) {
    if (adj[i]!.length === 0) {
      const j = (i + 1 + rng.int(N - 1)) % N;
      addEdge(adj, edges, i, j);
    }
  }
  return finalize(N, adj, edges);
}

export function buildBA(N: number, avgK: number, rng: RNG): Graph {
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  const m = Math.max(1, Math.round(avgK / 2));
  const seed = m + 1;
  for (let i = 0; i < seed; i++) {
    for (let j = i + 1; j < seed; j++) addEdge(adj, edges, i, j);
  }
  const targets: number[] = [];
  for (const [i, j] of edges) {
    targets.push(i);
    targets.push(j);
  }
  for (let i = seed; i < N; i++) {
    const picked = new Set<number>();
    let safety = 0;
    while (picked.size < m && safety < 2000) {
      picked.add(targets[rng.int(targets.length)]!);
      safety++;
    }
    for (const j of picked) {
      addEdge(adj, edges, i, j);
      targets.push(i);
      targets.push(j);
    }
  }
  return finalize(N, adj, edges);
}

export function buildWS(N: number, avgK: number, beta: number, rng: RNG): Graph {
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  const half = Math.max(1, Math.floor(avgK / 2));
  for (let i = 0; i < N; i++) {
    for (let d = 1; d <= half; d++) addEdge(adj, edges, i, (i + d) % N);
  }
  const orig = edges.slice();
  for (const e of orig) {
    if (rng.next() < beta) {
      const [i, j] = e;
      adj[i] = adj[i]!.filter((x) => x !== j);
      adj[j] = adj[j]!.filter((x) => x !== i);
      const idx = edges.indexOf(e);
      if (idx >= 0) edges.splice(idx, 1);
      let kk = 0;
      let tries = 0;
      do {
        kk = rng.int(N);
        tries++;
      } while ((kk === i || adj[i]!.includes(kk)) && tries < 80);
      if (tries < 80) addEdge(adj, edges, i, kk);
    }
  }
  return finalize(N, adj, edges);
}

export const generators: Record<string, (N: number, k: number, rng: RNG) => Graph> = {
  er: (N, k, rng) => buildER(N, k, rng),
  ba: (N, k, rng) => buildBA(N, k, rng),
  ws: (N, k, rng) => buildWS(N, k, 0.15, rng),
};

// ============================================================================
// Extended generators (added 2026-05-04)
//
// The `generators` map above ships only the canonical trinity (ER / BA / WS)
// because they share a uniform `(N, k, rng) => Graph` signature that fits a
// dropdown UI. The generators below cover the rest of the network-science zoo
// — lattices, geometric, communities, configuration, complete, edge-list
// import — and have heterogeneous signatures that don't fit a single dropdown
// shape. Models that need them import them directly:
//
//   import { buildLattice2d, buildSBM, buildFromEdgeList } from '../graph.ts';
//
// This is "Layer 2" of the topology design: standard generators. Layer 3 is
// "any function returning a Graph is a valid generator — define your own in
// your model file." Layer 4 is data import (buildFromEdgeList, parseEdgeList).
// ============================================================================

/**
 * 2D lattice with optional periodic boundary conditions.
 *
 * - `periodic=true` (default): every cell has exactly 4 neighbours; topology
 *   is a torus. Used by Ising, Gray-Scott, Brusselator (the standard physics
 *   convention to avoid finite-size edge artifacts).
 * - `periodic=false`: corners have 2 neighbours, edges have 3, interior has
 *   4. Open boundaries; useful for spatial-spread models where edges matter.
 */
export function buildLattice2d(rows: number, cols: number, periodic = true): Graph {
  const N = rows * cols;
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (periodic || c + 1 < cols) {
        addEdge(adj, edges, i, r * cols + (c + 1) % cols);
      }
      if (periodic || r + 1 < rows) {
        addEdge(adj, edges, i, ((r + 1) % rows) * cols + c);
      }
    }
  }
  return finalize(N, adj, edges);
}

/**
 * 3D lattice (d1 × d2 × d3) with optional periodic boundary conditions.
 *
 * Interior cells have 6 neighbours (von Neumann). Used for 3D extensions of
 * 2D models — diffusion in 3D, Ising in 3D, etc.
 */
export function buildLattice3d(d1: number, d2: number, d3: number, periodic = true): Graph {
  const N = d1 * d2 * d3;
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  const idx = (a: number, b: number, c: number): number => a * d2 * d3 + b * d3 + c;
  for (let a = 0; a < d1; a++) {
    for (let b = 0; b < d2; b++) {
      for (let c = 0; c < d3; c++) {
        const i = idx(a, b, c);
        if (periodic || a + 1 < d1) addEdge(adj, edges, i, idx((a + 1) % d1, b, c));
        if (periodic || b + 1 < d2) addEdge(adj, edges, i, idx(a, (b + 1) % d2, c));
        if (periodic || c + 1 < d3) addEdge(adj, edges, i, idx(a, b, (c + 1) % d3));
      }
    }
  }
  return finalize(N, adj, edges);
}

/**
 * Stochastic Block Model (SBM).
 *
 * Nodes are partitioned into blocks of given sizes. An edge between i and j
 * is included with probability `pIn` if i and j are in the same block, and
 * `pOut` if they're in different blocks. The canonical model for community
 * structure: pIn ≫ pOut produces tight communities with sparse inter-links.
 *
 * Total N = sum(blockSizes).
 */
export function buildSBM(blockSizes: number[], pIn: number, pOut: number, rng: RNG): Graph {
  const N = blockSizes.reduce((s, n) => s + n, 0);
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];

  // block id of each node
  const blockOf = new Int32Array(N);
  let cursor = 0;
  for (let b = 0; b < blockSizes.length; b++) {
    for (let k = 0; k < blockSizes[b]!; k++) blockOf[cursor++] = b;
  }

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const p = blockOf[i] === blockOf[j] ? pIn : pOut;
      if (rng.next() < p) addEdge(adj, edges, i, j);
    }
  }
  return finalize(N, adj, edges);
}

/**
 * Random Geometric Graph (Penrose 2003).
 *
 * Place N nodes uniformly random in the unit square. Connect any pair whose
 * Euclidean distance is at most `radius`. Spatial proximity → edge.
 *
 * Average degree ≈ N · π · radius² (in the limit, away from boundaries).
 * For N=200, radius=0.12 → ⟨k⟩ ≈ 9.
 *
 * Naïve O(N²) implementation; fine up to N ~ 10⁴.
 */
export function buildGeometric(N: number, radius: number, rng: RNG): Graph {
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  const x = new Float64Array(N);
  const y = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    x[i] = rng.next();
    y[i] = rng.next();
  }
  const r2 = radius * radius;
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = x[i]! - x[j]!;
      const dy = y[i]! - y[j]!;
      if (dx * dx + dy * dy < r2) addEdge(adj, edges, i, j);
    }
  }
  return finalize(N, adj, edges);
}

/**
 * Random k-regular graph via the configuration model with retry-on-collision.
 *
 * Every node has degree exactly k. Sampled approximately uniformly from the
 * space of k-regular graphs. Useful as a topology baseline that controls
 * for degree heterogeneity (compare against ER for "what does heterogeneity
 * do?" studies).
 *
 * N · k must be even. Falls back to relaxed degree if exact k can't be hit
 * within the retry budget (rare for sparse k ≤ 0.5N).
 */
export function buildKRegular(N: number, k: number, rng: RNG): Graph {
  if ((N * k) % 2 !== 0) {
    throw new Error(`k-regular graph needs N*k even (got N=${N}, k=${k})`);
  }
  // Try the pairing algorithm; restart up to 50 times if we hit a stuck state.
  for (let attempt = 0; attempt < 50; attempt++) {
    const adj = emptyAdj(N);
    const edges: Array<[number, number]> = [];
    const stubs: number[] = [];
    for (let i = 0; i < N; i++) for (let s = 0; s < k; s++) stubs.push(i);
    // Fisher-Yates shuffle, then pair sequentially.
    for (let i = stubs.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [stubs[i], stubs[j]] = [stubs[j]!, stubs[i]!];
    }
    let stuck = false;
    for (let p = 0; p < stubs.length; p += 2) {
      if (!addEdge(adj, edges, stubs[p]!, stubs[p + 1]!)) {
        stuck = true;
        break;
      }
    }
    if (!stuck) return finalize(N, adj, edges);
  }
  throw new Error(`could not build a ${k}-regular graph on ${N} nodes after 50 retries`);
}

/**
 * Complete graph K_N — every pair connected. ⟨k⟩ = N − 1.
 *
 * Use for "well-mixed" baseline (mean-field-like behaviour) or for small-N
 * fully-connected toy systems (e.g. Hopfield with Hebbian dense W is the
 * complete graph with weighted edges).
 */
export function buildComplete(N: number): Graph {
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) addEdge(adj, edges, i, j);
  }
  return finalize(N, adj, edges);
}

/**
 * Configuration model from a given degree sequence.
 *
 * `degrees[i]` is the desired degree of node i. Sum must be even. Builds a
 * graph with that exact degree sequence via stub-pairing (Bollobás 1980).
 * Throws if the sequence isn't graphical or pairing collisions exhaust the
 * retry budget.
 *
 * Use to study "any model on a graph with the same degrees as real-world
 * dataset X, but otherwise random" — the standard null model in network
 * science.
 */
export function buildConfiguration(degrees: number[], rng: RNG): Graph {
  const N = degrees.length;
  const sum = degrees.reduce((s, d) => s + d, 0);
  if (sum % 2 !== 0) {
    throw new Error(`degree sequence sum must be even (got ${sum})`);
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const adj = emptyAdj(N);
    const edges: Array<[number, number]> = [];
    const stubs: number[] = [];
    for (let i = 0; i < N; i++) for (let d = 0; d < degrees[i]!; d++) stubs.push(i);
    for (let i = stubs.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [stubs[i], stubs[j]] = [stubs[j]!, stubs[i]!];
    }
    let stuck = false;
    for (let p = 0; p < stubs.length; p += 2) {
      if (!addEdge(adj, edges, stubs[p]!, stubs[p + 1]!)) {
        stuck = true;
        break;
      }
    }
    if (!stuck) return finalize(N, adj, edges);
  }
  throw new Error(`configuration model failed after 50 retries; sequence may not be graphical`);
}

/**
 * Build a Graph from an explicit edge list.
 *
 * `edges` is an array of [i, j] pairs (0-indexed). Self-loops and duplicates
 * are silently filtered. Useful for loading real-world data:
 *
 *   const g = buildFromEdgeList(34, [[0,1], [0,2], ...]);  // Karate club
 *
 * For loading from CSV / file content, see parseEdgeList().
 */
export function buildFromEdgeList(N: number, edgeList: Array<[number, number]>): Graph {
  const adj = emptyAdj(N);
  const edges: Array<[number, number]> = [];
  for (const [i, j] of edgeList) {
    if (i < 0 || i >= N || j < 0 || j >= N) {
      throw new Error(`edge [${i}, ${j}] out of range for N=${N}`);
    }
    addEdge(adj, edges, i, j);
  }
  return finalize(N, adj, edges);
}

/**
 * Parse an edge list from a string. Each line is `i,j` or `i j` or `i\tj`
 * (any whitespace or comma separator). Comment lines starting with `#` and
 * blank lines are ignored. Returns the edges array; pair with
 * buildFromEdgeList(N, parseEdgeList(str)).
 *
 * Auto-determines N as max(i, j) + 1 across all edges.
 */
export function parseEdgeList(str: string): { N: number; edges: Array<[number, number]> } {
  const edges: Array<[number, number]> = [];
  let maxIdx = -1;
  for (const line of str.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/[\s,]+/).map(Number);
    if (parts.length < 2 || !isFinite(parts[0]!) || !isFinite(parts[1]!)) continue;
    const i = parts[0]! | 0;
    const j = parts[1]! | 0;
    edges.push([i, j]);
    if (i > maxIdx) maxIdx = i;
    if (j > maxIdx) maxIdx = j;
  }
  return { N: maxIdx + 1, edges };
}
