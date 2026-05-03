// v2 prototype — shared library functions extracted from the 10 model files.
//
// This is the boilerplate-removal layer: every model previously re-implemented
// buildGrid, coarseNoise, the empty-graph stub, etc. This file centralises
// them so v2 demos can compose primitives instead of copy-pasting.
//
// Stable: this file's contents are likely to survive into the eventual v2
// abstraction even if the surface API around them changes.

import type { Graph } from '../types.ts';
import type { RNG } from '../rng.ts';

// ---------- Grid helpers ----------

export function buildGrid(cols: number, rows: number, periodic = true): Graph {
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
      if (periodic) {
        link(i, r * cols + ((c + 1) % cols));
        link(i, ((r + 1) % rows) * cols + c);
      } else {
        if (c + 1 < cols) link(i, r * cols + (c + 1));
        if (r + 1 < rows) link(i, (r + 1) * cols + c);
      }
    }
  }
  const deg = new Int32Array(N);
  for (let i = 0; i < N; i++) deg[i] = adj[i]!.length;
  return { N, adj, edges, deg };
}

// ---------- Random-graph helpers ----------

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

export function emptyGraphOf(N: number): Graph {
  return {
    N,
    adj: Array.from({ length: N }, () => []),
    edges: [],
    deg: new Int32Array(N),
  };
}

// ---------- Spatial noise ----------

/**
 * Spatially-correlated noise on a `size × size` grid. Sample white noise on
 * a coarser `size / scale` grid and bilinearly upsample. Output values in
 * [0, 1]. Larger `scale` → larger blobs.
 */
export function coarseNoise(size: number, scale: number, rng: RNG): Float64Array {
  const coarseSize = Math.max(2, (size / scale) | 0);
  const coarse = new Float64Array(coarseSize * coarseSize);
  for (let i = 0; i < coarse.length; i++) coarse[i] = rng.next();
  const out = new Float64Array(size * size);
  const cMax = coarseSize - 1;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cr = (r / size) * cMax;
      const cc = (c / size) * cMax;
      const r0 = cr | 0;
      const r1 = Math.min(r0 + 1, cMax);
      const c0 = cc | 0;
      const c1 = Math.min(c0 + 1, cMax);
      const fr = cr - r0;
      const fc = cc - c0;
      const v00 = coarse[r0 * coarseSize + c0]!;
      const v01 = coarse[r0 * coarseSize + c1]!;
      const v10 = coarse[r1 * coarseSize + c0]!;
      const v11 = coarse[r1 * coarseSize + c1]!;
      const top = v00 * (1 - fc) + v01 * fc;
      const bot = v10 * (1 - fc) + v11 * fc;
      out[r * size + c] = top * (1 - fr) + bot * fr;
    }
  }
  return out;
}

// ---------- Diverging colour helper ----------

export function divergingColor(
  v: number,
  centre: number,
  halfWidth: number,
): string {
  let t = (v - centre) / Math.max(0.0001, halfWidth);
  if (t < -1) t = -1;
  else if (t > 1) t = 1;
  const a = (t + 1) / 2;
  const r = Math.round(44 + (230 - 44) * a);
  const g = Math.round(95 + (57 - 95) * a);
  const b = Math.round(191 + (70 - 191) * a);
  return `rgb(${r},${g},${b})`;
}
