// Force-directed layout, computed once per graph rebuild and then frozen.
// Iteration count scales down with N to keep the up-front cost reasonable.
// For N up to ~1000 we accept "good enough" placement rather than optimal.

export function computeLayout(graph, W, H, rng) {
  const { N, adj } = graph;
  const pos = new Float64Array(N * 2);
  const vel = new Float64Array(N * 2);

  const cx = W / 2, cy = H / 2;
  const R  = Math.min(W, H) * 0.36;

  // initial ring placement; small jitter avoids exactly-collinear artifacts
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rng.uniform(-0.05, 0.05);
    pos[i * 2]     = cx + R * Math.cos(a);
    pos[i * 2 + 1] = cy + R * Math.sin(a);
  }

  // Cap iterations: O(N^2) per iter dominates the cost.
  // 220 iters at N=200 ≈ 8M ops; 60 iters at N=1000 ≈ 60M ops.
  const ITER = Math.max(40, Math.min(220, Math.floor(40000 / N)));

  const kRep = 1500, kSpr = 0.05, L0 = 60, damp = 0.82, fMax = 25, vMax = 10;
  for (let it = 0; it < ITER; it++) {
    const cool = 1 - it / ITER;
    for (let i = 0; i < N; i++) {
      const xi = pos[i * 2], yi = pos[i * 2 + 1];
      let fx = 0, fy = 0;

      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        let dx = xi - pos[j * 2];
        let dy = yi - pos[j * 2 + 1];
        let r2 = dx * dx + dy * dy;
        if (r2 < 1) r2 = 1;
        const r = Math.sqrt(r2);
        const F = kRep / r2;
        fx += F * dx / r;
        fy += F * dy / r;
      }

      const ai = adj[i];
      for (let p = 0; p < ai.length; p++) {
        const j = ai[p];
        const dx = pos[j * 2] - xi;
        const dy = pos[j * 2 + 1] - yi;
        const r  = Math.sqrt(dx * dx + dy * dy) + 1e-3;
        const F  = kSpr * (r - L0);
        fx += F * dx / r;
        fy += F * dy / r;
      }

      fx += (cx - xi) * 0.003;
      fy += (cy - yi) * 0.003;

      const fm = Math.sqrt(fx * fx + fy * fy);
      if (fm > fMax) { fx *= fMax / fm; fy *= fMax / fm; }

      let vx = (vel[i * 2]     + fx) * damp * cool;
      let vy = (vel[i * 2 + 1] + fy) * damp * cool;
      const vm = Math.sqrt(vx * vx + vy * vy);
      if (vm > vMax) { vx *= vMax / vm; vy *= vMax / vm; }

      vel[i * 2]     = vx;
      vel[i * 2 + 1] = vy;
      pos[i * 2]     += vx;
      pos[i * 2 + 1] += vy;
    }
  }

  const M = 24;
  for (let i = 0; i < N; i++) {
    pos[i * 2]     = Math.max(M, Math.min(W - M, pos[i * 2]));
    pos[i * 2 + 1] = Math.max(M, Math.min(H - M, pos[i * 2 + 1]));
  }
  return pos;
}
