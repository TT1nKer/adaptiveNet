// Mulberry32 — small, fast, well-distributed seeded PRNG.
// Reference: github.com/bryc/code/blob/master/jshash/PRNGs.md

export class RNG {
  constructor(seed) {
    this.state = ((seed >>> 0) || 1);
  }
  // uniform [0, 1)
  next() {
    let t = this.state = (this.state + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uniform(a, b) { return a + (b - a) * this.next(); }
  // Box–Muller
  normal(mu = 0, sigma = 1) {
    const u1 = Math.max(this.next(), 1e-12);
    const u2 = this.next();
    const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z;
  }
  int(n) { return Math.floor(this.next() * n); }
  pick(arr) { return arr[this.int(arr.length)]; }
}
