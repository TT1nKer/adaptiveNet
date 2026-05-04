# Substrate quick reference

The condensed version of the Model interface and supporting types. Read this once before writing a model file.

## Model interface (from `src/types.ts`)

```ts
export interface Model<S extends ModelState = ModelState> {
  id: string;                    // URL slug, never rename after shared
  name: string;                  // English display name
  short: string;                 // ~120-180 char gallery card description
  long?: string;                 // multi-paragraph player-page description
  name_zh?: string;              // Chinese name (falls back to name)
  short_zh?: string;             // Chinese short
  long_zh?: string;              // Chinese long

  params: ParamSchema;           // {param_id: spec}
  presets?: Preset[];            // named param scenarios

  view?: 'graph' | 'grid';       // default 'graph'
  init(params: ParamValues, rng: RNG): S;
  step(state: S, params: ParamValues, rng: RNG): void;

  render: RenderConfig<S>;
  observe?: ObserveConfig<S>;
}
```

## State

```ts
interface ModelState {
  N: number;                  // node count
  d: number;                  // per-node state dimension
  X: Float64Array;            // length N*d, row-major
  graph: Graph;               // {N, adj, edges, deg}
  t: number;                  // simulation time (your choice of units)
  step_count: number;         // integer step counter
  cols?: number;              // required when view: 'grid'
  rows?: number;              // required when view: 'grid'
}
```

For models with extra state (W matrix, stored patterns, etc.), extend ModelState:

```ts
interface MyState extends ModelState {
  W: Float64Array;
  patterns: Float64Array[];
}
const myModel: Model<MyState> = { ... };
```

## Graph

```ts
interface Graph {
  N: number;
  adj: number[][];                       // adj[i] = neighbours of i
  edges: Array<[number, number]>;        // canonical i < j
  deg: Int32Array;                       // deg[i] = adj[i].length
}
```

## Parameter specs

Two kinds:

```ts
// Numeric (renders as slider)
{ label: 'temperature T', min: 0.05, max: 5.0, step: 0.01, default: 2.27, live: true }

// Categorical (renders as dropdown)
{ label: 'topology', options: ['er', 'ba', 'ws'] as const, default: 'er', live: false }
```

`live: true` → applies on next step (no graph rebuild). `live: false` → triggers `init()` again.

## Render

```ts
interface RenderConfig<S> {
  nodeColor(state: S, i: number, params: ParamValues): string;  // CSS colour
  nodeSize(state: S, i: number, params: ParamValues): number;   // pixel radius
  edgeAlpha?: number;                                           // 0 to 1, default 0.18
}
```

For grid view (`view: 'grid'`), nodeSize is unused (cells are filled squares).

## Observables

```ts
interface ObserveConfig<S> {
  histogram?: { label: string; range: [number, number]; bins?: number; values(state: S): Float64Array };
  timeSeries?: { label: string; value(state: S): number };
  timeSeries2?: { label: string; value(state: S): number };  // overlaid in yellow
}
```

The timeSeries chart auto-scales to the max of both series. Avoid combining one series in `[0,1]` with another in `[0,1000]` — they'll squash visually.

## Graph generators (from `src/graph.ts`)

```ts
import { generators } from '../graph.ts';

const graph = generators.er(N, k, rng);  // Erdős–Rényi, avg degree k
const graph = generators.ba(N, k, rng);  // Barabási–Albert
const graph = generators.ws(N, k, rng);  // Watts–Strogatz, β=0.15

// For lattices, define a local buildGrid helper (see ising.ts / lif.ts /
// gray-scott.ts). The substrate doesn't ship a lattice generator —
// each lattice demo builds its own with the boundary condition it needs.
```

## RNG (from `src/rng.ts`)

```ts
const rng = new RNG(seed);

rng.next();                  // uniform [0, 1)
rng.uniform(a, b);           // uniform [a, b)
rng.normal(mu, sigma);       // standard normal via Box-Muller
rng.int(n);                  // integer [0, n)
rng.pick(arr);               // random element of arr
```

**Never use `Math.random()` in init / step.** URL permalinks must be reproducible from the seed alone.

## The step() pattern

The recommended tick volume:

```ts
step(state, params, rng) {
  const { N, X, graph } = state;
  const speed = params.speed as number;

  // For graph models — about 5% of edges per frame at speed = 1
  const ticks = Math.max(1, Math.floor(graph.edges.length * 0.05 * speed));

  // For lattice models — N substeps with a small dt
  // const SUB = Math.max(1, Math.round(speed));
  // const dt = 0.02;

  for (let t = 0; t < ticks; t++) {
    // mutate X, edges, deg as needed
    state.step_count++;
  }
  state.t = state.step_count;  // or += dt for lattice models
}
```

This keeps the visible frame rate consistent across N.

## Avoiding GC pauses

Hot-loop models allocate enough that V8's GC stutters become visible. Cache work buffers across step() calls:

```ts
step(state, params) {
  const aux = state as ModelState & { _du?: Float64Array; _dv?: Float64Array };
  if (!aux._du || aux._du.length !== state.N) aux._du = new Float64Array(state.N);
  // ... use aux._du as the per-node delta buffer
}
```

This is critical for grid models with N ≥ 10⁴.

## Common pitfalls

- **Mutating `state` during a synchronous update**: read into a temporary buffer first, write back at end. Otherwise the order of cell updates contaminates the dynamics. (Glauber asynchronous is the exception — order is part of the spec.)
- **Edge swap-pop bookkeeping**: when removing edges from `graph.edges` array, use swap-pop (move last to current, then pop). Linear `splice` is O(N).
- **Forgetting `state.t = state.step_count`**: the t-val display in the panel shows `state.t`. If you don't update it, time looks frozen.
- **Adaptive edge add without dedup**: when rewiring, check `adj[i].includes(j)` before pushing. Otherwise you get multi-edges that break degree counts.
- **Categorical param with non-string default**: `default` must match one of the `options` strings exactly.

## What's already in the gallery — don't duplicate

| Domain | Models |
|---|---|
| Brain-inspired | Hopfield, Hopfield Capacity, Modern Hopfield, Ising, LIF, Avalanches |
| Pattern formation | Nakao Network Turing, Brusselator, Gray-Scott |
| Adaptive networks | Holme-Newman voter, Adaptive SIS |
| Templates | Adaptive Spread (sandbox starter) |

If the user's proposal is essentially "Ising but on a different graph" — flag it and ask whether they want to add a topology option to the existing Ising rather than a new file.
