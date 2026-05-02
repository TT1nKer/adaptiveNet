# Synthesis — what the 10 demos teach about the v2 abstraction

The current 10 demos were built to survey the substrate's expressive range. This file tries to extract the common skeleton, identify the design axes the v2 authoring layer has to expose, and sketch what a candidate primitive set might look like.

This is not a v2 spec. It is the **input** to writing a v2 spec.

---

## The 10 demos at a glance

| Demo | Topology | d | Update | W | Init | Notes |
|---|---|---|---|---|---|---|
| Nakao | sparse graph (ER/BA/WS) | 2 | sync continuous | static adjacency | FP + noise | classical RD on graph |
| Voter | sparse graph | 1 | event-driven | **mutating** | FP + noise (binary) | only one with truly adaptive W |
| Gray–Scott | 2D grid (4-regular periodic) | 2 | sync continuous | static (implicit) | spatial-correlated noise + seed | RD with multiple FPs |
| Brusselator | 2D grid | 2 | sync continuous | static | FP + spatial noise | classical Turing |
| Hopfield | empty graph + dense W | 1 | async per-cell | dense, Hebbian-set | cue + noise | recall demo |
| Hopfield Capacity | empty + dense W | 1 | async per-cell | dense, Hebbian-set | random patterns | phase transition |
| Modern Hopfield | empty + dense W | 1 | sync via softmax | dense, pattern-stored | random patterns | attention equivalent |
| Ising | 2D grid | 1 | async per-cell (Glauber) | static (4-reg) | random ±1 | thermal critical |
| LIF | 2D grid | 2 (V, age) | sync with refractory | static (4-reg) | rest + small noise | spiking dynamics |
| Avalanches | 2D grid | 2 (X, age) | event + cascade | static (4-reg) | low activity | SOC sandpile |

---

## What's invariant across all 10

Every model has the same boilerplate:

```ts
1. ParamSchema   →  some live, some non-live, common types (number range, enum, integer)
2. init(params, rng) → returns { N, d, X, graph, t, step_count, ...aux }
3. step(state, params, rng) → mutates X (and possibly graph, aux fields)
4. render { nodeColor(state, i), nodeSize(state, i) }
5. observe { histogram, timeSeries, [timeSeries2] }
```

Every model uses **state-as-storage**: model-specific scratch buffers (du/dv arrays, W matrix, patterns list, _stack) live on the state object. The runtime treats them as opaque.

Every grid model rebuilds `buildGrid(cols, rows, periodic)` — copy-pasted in 5+ files.

Every demo with continuous noise init reimplements `coarseNoise(size, scale, rng)` — copy-pasted in 3 files.

**This boilerplate is the first thing the v2 abstraction should remove.** ~30% of every model file is copy-paste.

---

## Design axes the demos surface

The 10 demos differ along these axes. The v2 abstraction has to let users declare each one:

### Axis 1 — Topology

- **Sparse graph from generator**: ER, BA, WS. Constant after init. (Nakao, voter init)
- **Sparse graph mutating in step**: Voter rewires edges. Currently the only one.
- **Regular lattice**: 2D 4-regular periodic. Used by 5 demos.
- **Empty + dense W**: Hopfield variants. W is N×N stored separately, "graph" exists only for substrate's sake.

The abstraction needs a **W storage** declaration that covers all four — and the runtime should pick efficient ops based on it (matmul for dense, scatter-gather for sparse, stencil for grid).

### Axis 2 — State shape

- **d=1 scalar**: voter, Hopfield variants, Ising
- **d=2 vector**: Nakao (u, v), Gray–Scott (u, v), Brusselator (u, v)
- **d=2 with auxiliary**: LIF (V, age), Avalanches (activity, age)

`age`-style fields tracking "frames since last event" come up in any spike/event-driven model. They aren't part of the dynamics — they're for **rendering** (to show a flash for one frame after firing). Could be substrate-managed: "mark a cell as `fired` this step, runtime auto-decays the marker."

### Axis 3 — Update semantics

- **Synchronous + sub-stepped Forward Euler**: Nakao, Gray-Scott, Brusselator, LIF
- **Async per-cell**: Hopfield, Capacity, Ising
- **Synchronous via global op (matmul + softmax + sign)**: Modern Hopfield
- **Event-driven over edges**: Voter (pick edge, decide rule)
- **Drive + cascade**: Avalanches

These are 5 distinct **scheduling regimes**. The v2 abstraction has to make this a top-level declaration. Hard-coding it inside each model's `step()` (as we do now) is exactly what blocks reuse.

### Axis 4 — Init richness

- **Random ±1**: Ising, Hopfield random patterns
- **FP + scalar noise**: Nakao, voter, all Hopfield cues
- **FP + spatial-correlated noise**: Gray-Scott, Brusselator
- **Patterned seed (region of cells set high)**: Gray-Scott central seed, LIF drive area, Hopfield cue
- **Empty / pristine**: Avalanches starts low everywhere
- **Memory injection**: Hopfield W = Hebbian outer products of given patterns

The v2 abstraction needs an **init DSL** that composes these primitives. "Random + noise" is a one-liner; "FP + spatial noise + central seed" is three composed ops; "Hebbian-from-patterns" is a fourth.

### Axis 5 — Diagnostics

- **Per-cell histogram**: every demo has one
- **Single time series**: every demo has one
- **Dual time series**: just Hopfield Capacity (added today)
- **Cumulative event distribution**: needed for Avalanches power-law plot — currently not supported by framework, so we render smoothed-size instead
- **Spectral observable**: nothing has this — but if we do "Laplacian eigenvalue band" for network Turing it'd be useful
- **2D scatter (state-space plot)**: not supported

The diagnostic primitive set is currently **anaemic** — three obvious additions (cumulative event distribution, spectrum, scatter) would cover most of what real research papers plot.

---

## Candidate primitive set for v2

Sketch — not committed to. Designed so each existing demo could be re-written in 30–80 lines using only these primitives.

```
TOPOLOGY:
  random_graph(kind: 'er' | 'ba' | 'ws', N, k, beta?)
  grid(cols, rows, periodic, neighbour: '4' | '8')
  empty(N)                   # for dense-W demos

STATE:
  state(N, d, init_fn)       # the per-node X array
  weights_dense(N)           # N*N matrix
  weights_sparse(graph)      # adjacency-derived sparse W

OPS:
  neighbour_reduce(field, op: 'sum' | 'mean' | 'max')
  matmul_dense(W, X)         # for dense-W
  outer_sum(patterns)        # Hebbian training
  softmax(scores, beta)
  sign(field)
  threshold(field, value, on_fire: fn)

INIT:
  fill(value)                       # constant
  noise(distribution, scale)
  spatial_noise(scale)              # coarse-grained
  near_fixed_point(fp, scale)
  seed_disc(centre, radius, value)
  hebbian_from(patterns)
  patterns_random(P, ±1)

UPDATE:
  sync(rule)                        # all cells in lockstep, with sub-step
  async_per_cell(rule, rate)        # pick random cell K times/frame
  event_per_edge(rule, rate)        # for Voter-like
  drive_and_cascade(drive, threshold, transfer)  # for SOC

DIAGNOSTICS:
  histogram(field, range, bins)
  time_series(scalar)
  time_series_dual(primary, secondary)
  spectrum(W)                # eigenvalues
  event_distribution(events) # cumulative log-log
```

### Sketched demo: Nakao (currently 172 lines) under this primitive set

```ts
const nakao = define({
  topology: random_graph('ba', { N: 200, k: 6 }),
  state:    state({ d: 2, init: near_fixed_point([5, 10], 0.05) }),
  reaction: (u, v) => [
    ((35 + 16*u - u*u)/9 - v) * u,
    (u - 1 - 0.4*v) * v
  ],
  diffusion: { D: [0.05, 3.0], op: neighbour_reduce('sum-diff') },
  update:   sync({ dt: 0.002, sub: 25 }),
  render:   color_diverging(0, '5'),  // colour by component 0 around 5
  observe:  {
    histogram: of('u', range=[0, 12]),
    time_series: stdev_of('u'),
  },
});
```

That's ~20 lines vs the current 172. The 152 lines of difference are **all boilerplate** the runtime can absorb.

### Sketched demo: Voter (151 lines → ~25)

```ts
const voter = define({
  topology: random_graph('er', { N: 200, k: 4 }),
  state:    state({ d: 1, init: random_binary() }),
  update:   event_per_edge({ rate: 0.05, rule: (i, j, X, W) => {
    if (X[i] === X[j]) return;
    if (rng.next() < phi) rewire(W, j, i, find_random({ same: X[j] }));
    else                  X[rng.pick([i, j])] = X[rng.pick([j, i])];
  }}),
  ...
});
```

### Sketched demo: Avalanches (254 lines → ~30)

```ts
const avalanches = define({
  topology: grid(96, 96, periodic=true, neighbour='4'),
  state:    state({ d: 1, init: noise(0, 0.5) }),
  update:   drive_and_cascade({
    drive: { rate: 30, dose: 0.1 },
    threshold: 1.0,
    on_fire: (i) => transfer(i, neighbours(i), (1 - eps) / 4),
  }),
  ...
});
```

---

## Open design questions

These are the choices that make the abstraction either powerful or shallow. They have to be answered explicitly:

1. **Rule language**: declarative blocks (the sketches above) or expression-based (write a `(state, params) => new_state` function with named ops)? Blocks are accessible but limit expressiveness; expressions are flexible but require parsing or sandboxing JS.

2. **Update granularity composability**: can a model declare "this part syncs every step, this part is async, this part is event-driven"? Real cortex does all three at once. The abstraction should probably allow it; current code base hard-codes one regime per model.

3. **GPU compilation path**: which primitives have a clean WebGPU / CUDA mapping? `neighbour_reduce` on a grid → 5-point stencil → easy. `event_per_edge` → divergent control flow → hard. `drive_and_cascade` → totally divergent → maybe stays CPU.

4. **State extension by user code**: how does a model add custom fields (W matrix, patterns list, scratch buffers) without escape-hatching to `as any`? Current code uses TypeScript casts. v2 should make this typed.

5. **Diagnostic primitives**: what's the minimum set that covers the real-research observables (spectrum, event distribution, scatter, …) without becoming a charting library?

---

## Recommendation

The substrate (X + W + sync update) is **broadly right** — every demo fits in it. The v2 work is mostly **language + scheduling**, not substrate.

Most ROI for the next 2–3 sessions:

- **Pick a rule language style** (blocks vs expressions) and prototype it on Nakao + Voter + Avalanches. These three cover the three major scheduling regimes (sync continuous, event-driven, drive+cascade).
- **Don't try to cover all 10 demos** before iterating. Three is enough to expose bad design choices.
- **Defer GPU**: the v2 spec should be cleanly separable from the GPU backend. If the language makes the dependency graph explicit, GPU comes for free later via codegen.

The hardest call is question (1). Worth a separate conversation before writing code. Block-style is more accessible; expression-based is more flexible. Probably the right answer is **blocks for common cases, expression escape hatch for novel rules** — same shape as Excel formulas (drag-drop UI for common ops, formula editor for custom).
