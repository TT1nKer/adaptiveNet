# Three annotated example models

Read these three before writing your first model. They cover the three structural categories the substrate supports: lattice, fixed graph, adaptive graph.

## Example 1 — Ising (lattice, simple state, synchronous-ish update)

[`src/models/ising.ts`](../../../../src/models/ising.ts) — full source.

Key patterns:
- `view: 'grid'` + provides `cols` / `rows` in state
- Local `buildGrid()` helper (graph generator at the model level, not from `generators`)
- Single-scalar node state (binary ±1) stored as Float64Array of length N
- Asynchronous Glauber update inside step (random cell selected per tick)
- Direct mutation of X[i] is OK because Glauber is *defined* as asynchronous
- `observe.timeSeries`: `|magnetization|` — single scalar, the canonical order parameter
- `presets`: 4 named regimes spanning T = 1.0 (ordered) to T = 4.0 (disordered)

When to use this template:
- Your dynamics live on a regular lattice
- Update is one-cell-at-a-time (Glauber, Metropolis)
- Single scalar per node

## Example 2 — Nakao Network Turing (fixed graph, vector state, synchronous update)

[`src/models/nakao.ts`](../../../../src/models/nakao.ts) — full source.

Key patterns:
- Default `view: 'graph'` (force-directed layout)
- Uses `generators[topo]` to build initial graph from params
- `d: 2` — two scalars per node (activator + inhibitor concentrations)
- State stored as `Float64Array(N * 2)`, accessed via `X[i*2]` and `X[i*2 + 1]`
- Synchronous update: read all neighbour values into `du[i]` / `dv[i]` first, then write back to X
- Reuses work buffers `_du` / `_dv` across step calls (cached on state) to avoid GC
- Sub-stepping: 25 numerical sub-steps per frame at speed=1, dt=0.002 — needed because the diffusion equation is stiff
- `observe.timeSeries`: σ(u) — variance of activator across nodes — natural order parameter for "is the pattern formed yet"

When to use this template:
- Your dynamics are differential equations (reaction-diffusion, oscillator coupling)
- Multiple scalars per node
- Synchronous update needed
- Topology is generated from a standard generator (ER/BA/WS)

## Example 3 — Adaptive Voter (graph with edges that change)

[`src/models/voter.ts`](../../../../src/models/voter.ts) — full source.

Key patterns:
- Default `view: 'graph'`
- Single binary scalar per node (opinion)
- Asynchronous edge-event update: pick random edge, conditionally rewire OR conditionally copy state
- **Edge mutation**: when rewiring, use swap-pop on `graph.edges` array (move last to current index, pop). Linear `splice` would be O(N) per rewire.
- Bounded-attempts loop (30 tries) to find a same-opinion target during rewiring — accepts that some rewires fail, doesn't loop forever
- Updates `deg[i]--` and `deg[i]++` as edges change — keeps the degree array consistent for visualization (node size encodes degree)
- `observe.timeSeries`: fraction of discordant edges — canonical order parameter (always tends to 0, but in two qualitatively different ways depending on φ)

When to use this template:
- Edges change as a function of node states
- Asynchronous edge-event semantics
- The order parameter is an edge-level property, not a node-level one

## Comparison table

| Property | Ising | Nakao | Adaptive Voter |
|---|---|---|---|
| `view` | grid | graph | graph |
| `d` (per-node) | 1 | 2 | 1 |
| Topology | fixed lattice | fixed graph | **adaptive** graph |
| Update | async per-cell | sync (read-write split) | async per-edge |
| Sub-steps per frame | N/4 | 25 | edges*0.05 |
| Work-buffer caching | not needed (in-place ok) | `_du`/`_dv` cached on state | not needed (point updates) |
| Order parameter | magnetization (node-level) | σ(u) (node-level) | fraction discordant (edge-level) |
| GPU-friendly | yes (Ising is the GPU benchmark) | yes (after porting) | **no** (dynamic edges) |

## When the user's model fits multiple templates

A common case: "I want a model where nodes have continuous state and the graph is adaptive." That's Example 2 + Example 3 patterns combined. Look at [`src/models/adaptive-sis.ts`](../../../../src/models/adaptive-sis.ts) for a recent example that combines patterns.

If no existing model is close, look at the [`src/models/_template.ts`](../../../../src/models/_template.ts) for the minimal scaffold — it's about 200 lines including comments.
