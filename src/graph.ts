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
