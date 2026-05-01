// Force-directed layout, computed incrementally so the convergence is
// visible. The runtime drives a few `step()` calls per animation frame
// until `done`, then freezes and lets the dynamics take over.

import type { Graph } from './types.ts';
import type { RNG } from './rng.ts';

export class Layout {
  readonly pos: Float64Array;
  private readonly vel: Float64Array;
  private readonly graph: Graph;
  private readonly W: number;
  private readonly H: number;

  iter: number;
  readonly maxIter: number;

  constructor(graph: Graph, W: number, H: number, rng: RNG) {
    this.graph = graph;
    this.W = W;
    this.H = H;

    const N = graph.N;
    this.pos = new Float64Array(N * 2);
    this.vel = new Float64Array(N * 2);

    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.36;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rng.uniform(-0.05, 0.05);
      this.pos[i * 2] = cx + R * Math.cos(a);
      this.pos[i * 2 + 1] = cy + R * Math.sin(a);
    }

    this.iter = 0;
    // 220 iters at N=200 ≈ 8M ops; 60 iters at N=1000 ≈ 60M ops.
    this.maxIter = Math.max(40, Math.min(220, Math.floor(40000 / N)));
  }

  get done(): boolean {
    return this.iter >= this.maxIter;
  }

  /** Run one Fruchterman–Reingold-ish iteration. */
  step(): void {
    if (this.done) return;
    const { graph, W, H, pos, vel, maxIter } = this;
    const N = graph.N;
    const adj = graph.adj;

    const cx = W / 2;
    const cy = H / 2;
    const cool = 1 - this.iter / maxIter;

    const kRep = 1500;
    const kSpr = 0.05;
    const L0 = 60;
    const damp = 0.82;
    const fMax = 25;
    const vMax = 10;

    for (let i = 0; i < N; i++) {
      const xi = pos[i * 2]!;
      const yi = pos[i * 2 + 1]!;
      let fx = 0;
      let fy = 0;

      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const dx = xi - pos[j * 2]!;
        const dy = yi - pos[j * 2 + 1]!;
        let r2 = dx * dx + dy * dy;
        if (r2 < 1) r2 = 1;
        const r = Math.sqrt(r2);
        const F = kRep / r2;
        fx += (F * dx) / r;
        fy += (F * dy) / r;
      }

      const ai = adj[i]!;
      for (let p = 0; p < ai.length; p++) {
        const j = ai[p]!;
        const dx = pos[j * 2]! - xi;
        const dy = pos[j * 2 + 1]! - yi;
        const r = Math.sqrt(dx * dx + dy * dy) + 1e-3;
        const F = kSpr * (r - L0);
        fx += (F * dx) / r;
        fy += (F * dy) / r;
      }

      fx += (cx - xi) * 0.003;
      fy += (cy - yi) * 0.003;

      const fm = Math.sqrt(fx * fx + fy * fy);
      if (fm > fMax) {
        fx *= fMax / fm;
        fy *= fMax / fm;
      }

      let vx = (vel[i * 2]! + fx) * damp * cool;
      let vy = (vel[i * 2 + 1]! + fy) * damp * cool;
      const vm = Math.sqrt(vx * vx + vy * vy);
      if (vm > vMax) {
        vx *= vMax / vm;
        vy *= vMax / vm;
      }
      vel[i * 2] = vx;
      vel[i * 2 + 1] = vy;
      pos[i * 2] = xi + vx;
      pos[i * 2 + 1] = yi + vy;
    }

    const M = 24;
    for (let i = 0; i < N; i++) {
      pos[i * 2] = Math.max(M, Math.min(W - M, pos[i * 2]!));
      pos[i * 2 + 1] = Math.max(M, Math.min(H - M, pos[i * 2 + 1]!));
    }

    this.iter++;
  }
}

/** Convenience: run the whole layout in one call. */
export function computeLayout(graph: Graph, W: number, H: number, rng: RNG): Float64Array {
  const layout = new Layout(graph, W, H, rng);
  while (!layout.done) layout.step();
  return layout.pos;
}
