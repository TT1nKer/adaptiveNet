---
name: adaptivenet-author
description: Activate when the user wants to design a new adaptiveNet model — a node-edge dynamical system on a graph or lattice (e.g. Ising, Hopfield, voter, reaction-diffusion, adaptive epidemic, threshold cascade, custom dynamics). This skill walks the user through the substrate-spec design questions in the right order, then writes the TypeScript Model file (and optionally Rust+WGPU and C++/CUDA versions) to repo. Use whenever the user says things like "I want to add a model of X", "let me build a [some dynamics] simulation", "model where nodes are X and they evolve by Y", or any verbal description of a graph-based dynamical rule.
---

# Authoring an adaptiveNet model

You are helping a researcher / educator / curious person design a new model for adaptiveNet (an open-source playground for node-edge dynamical systems where node states and connection topology can coevolve). The substrate is documented in [`SPEC.md`](../../../SPEC.md), the canonical Model template is at [`src/models/_template.ts`](../../../src/models/_template.ts), and the contribution workflow is in [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).

The substrate-general framing of the project (per [`POSITIONING.md`](../../../POSITIONING.md)) is "the abstract structure underneath neuromorphic / statistical mechanics / adaptive-network theories". Models that fit this substrate well: **anything where you have N entities with state, pairwise relationships between them with optional state, and rules that evolve both over time.**

## What this skill does

1. **Asks the design questions in the right order** — substrate first (states, topology, update mode), then dynamics (rules), then UX (params, presets, observables, visualization), then cross-runtime decisions.
2. **Writes the actual files** — at minimum the TypeScript Model in `src/models/<name>.ts`. Optionally Rust + CUDA versions if the model is GPU-friendly and the user wants research-scale performance.
3. **Wires it in** — updates `src/player.ts` registry, optionally adds a gallery card to `index.html` + `index.zh.html`, marks coverage in `native/README.md` if applicable.

## Question flow — ask one phase at a time, wait for answers

**Don't dump all questions at once.** Move through phases sequentially. After each phase, summarize what you've heard and confirm before proceeding. The user might be writing answers in Chinese — accept either language; you'll generate Chinese `name_zh` / `short_zh` / `long_zh` fields too.

### Phase 1 — Identify

Ask:
- *Canonical name*. What's this model called in the literature? (e.g. "Watts threshold cascade", "Kuramoto oscillators", "Schelling segregation"). If it's a custom model with no standard name, suggest one based on the dynamics.
- *Reference paper / citation*. DOI or first-author + year. (Optional but strongly preferred — every model in adaptiveNet links to its canonical reference.)
- *One-line gallery description* (~120-180 chars, both EN + ZH). The "what it shows" pitch for someone scrolling the gallery.

### Phase 2 — Substrate

Ask:
- *Node state shape*:
  - binary `{0, 1}` (e.g. SIS, voter, threshold cascade)
  - binary `{-1, +1}` (e.g. Ising, Hopfield)
  - discrete category (e.g. SIR with 3 states, opinion with k options)
  - continuous scalar (e.g. Kuramoto phase, LIF voltage)
  - vector (e.g. activator–inhibitor, multiple chemical species)
- *Topology*:
  - fixed lattice (2D / 3D periodic grid) → `view: 'grid'` mode
  - fixed graph (ER / BA / WS / custom) → `view: 'graph'` mode (default)
  - **adaptive** (edges rewire / weights change based on dynamics) → `view: 'graph'`, harder
- *Update mode*:
  - synchronous (all nodes update at once per step) — common for cellular-automata / Ising
  - asynchronous random-order (one node per tick) — common for voter / Glauber
  - asynchronous edge-event (random edge per tick) — common for adaptive networks
  - continuous-time (rates) — discretize via Gillespie or fixed dt

### Phase 3 — Dynamics

Ask:
- *Node update rule* — describe what happens to a node's state at each step. State this as math or pseudocode if convenient. If it depends on neighbours, what neighbour aggregation? (sum, mean, max, weighted)
- *Edge update rule* (only if adaptive) — describe what triggers an edge to be added / removed / reweighted, and the probabilities involved.
- *Boundary conditions* (only if lattice) — periodic / fixed-zero / open / mixed.
- *Initial condition* — random ±1? localized seed? specific pattern? Note: must be deterministic from the seed (use `rng.next()`, never `Math.random()`).

### Phase 4 — Observables

Ask:
- *Order parameter*. The single scalar that tells you which phase / regime the system is in. (e.g. magnetization, fraction infected, mean firing rate, pattern amplitude). Will appear as the time-series chart.
- *Secondary observable* (optional). If there's a second meaningful trace worth overlaying. (e.g. for adaptive SIS: SI-edge fraction alongside infected fraction)
- *Histogram* (optional). If a value distribution is meaningful (e.g. spin distribution, voltage distribution).

### Phase 5 — Parameters

Ask:
- *Live parameters* (changing mid-run is meaningful). e.g. temperature in Ising, infection rate in SIS. Provide: name, label, min, max, step, sensible default.
- *Init parameters* (changing requires reset). e.g. N (node count), topology choice, initial fraction. Same shape.
- *Speed multiplier* — almost every model needs `speed` (live, default 1.0, range 0.1-5) to control visual pacing.

### Phase 6 — Presets

Ask:
- *Named regimes worth highlighting*. Most models have 2-4 (e.g. "ordered phase", "critical", "disordered"). Each is: id, human name, one-line description of what to watch, and the param values that put the system in that regime.

### Phase 7 — Visualization

Ask (offer sensible defaults — most users won't have strong opinions here):
- *Color scheme*: discrete categorical (e.g. blue / red for binary), continuous diverging (e.g. blue → grey → red for scalar), or thermal (e.g. dark → bright for activity).
- *Node size encoding*: uniform, or `4 + sqrt(degree) * 1.4` (degree-encoded — makes hubs visually salient on graph view).
- *Edge alpha*: 0.18 is the project standard. Use 0 to hide edges (rare).

### Phase 8 — Cross-runtime (optional)

Only ask if topology is fixed (no dynamic edges) and the user has stated a need for large N or research use:
- *Add Rust + WGPU implementation?* (~30 min of additional work; cross-platform GPU)
- *Add C++/CUDA implementation?* (~30 min; NVIDIA only, max perf, and unlocks the bit-for-bit cross-validation against Rust+WGPU)

If yes, follow [`reference/cross-runtime-quickref.md`](reference/cross-runtime-quickref.md) for the WGSL + CUDA porting pattern.

## After all phases — write the files

Write the files in this order, building each on the previous:

1. **`src/models/<name>.ts`** — the canonical TypeScript implementation. Use [`src/models/_template.ts`](../../../src/models/_template.ts) as the literal starting structure. Translate the user's natural-language descriptions into:
   - `params`: schema with all the user-stated parameters (live / non-live correctly marked)
   - `init(params, rng)`: builds graph + initial state from params, deterministic from rng
   - `step(state, params, rng)`: one timestep of dynamics. Cache work buffers in `aux` to avoid GC.
   - `render`: nodeColor, nodeSize, edgeAlpha (use the user's choices from Phase 7)
   - `observe`: timeSeries (and optionally timeSeries2, histogram)
   - `presets`: array of named regimes
   - `name_zh` / `short_zh` / `long_zh`: Chinese versions if the user is comfortable with Chinese
2. **`src/player.ts`** — add a one-line entry to the `MODEL_REGISTRY` for the new model id.
3. **`index.html`** — add a card to the appropriate section (Brain-inspired computation / Pattern formation / Adaptive networks). If none fits, ask the user whether to create a new section.
4. **`index.zh.html`** — same card, Chinese.
5. **`teaching/problem-sets/<name>.md`** — *only if the user wants to write 5 Δ-style problem-set prompts* (ask explicitly; don't generate problem sets without their input — the prompts should reflect what THEY think a student should learn from this model).
6. **(Optional) Native runtimes** if Phase 8 was yes:
   - `native/rust-wgpu/src/bin/<name>.rs` + `src/shaders/<name>.wgsl`
   - `native/cpp-cuda/src/main_<name>.cu` (or restructure if multiple binaries)
   - Update `native/README.md` model coverage table

After writing, run:
```sh
bun run typecheck && bun run build
```

If typecheck passes, commit with a message naming the model + reference paper.

## Quality bar

A model is ready to merge when:

- [ ] `bun run typecheck` passes
- [ ] `bun run build` produces a chunk for the new model
- [ ] Opening `player.html?model=<id>` shows the model running in the browser
- [ ] Default parameters give visible interesting dynamics (not all-stuck-at-fixed-point, not pure noise)
- [ ] At least one preset puts the system in a qualitatively different regime than the default
- [ ] The `long` description includes a "Things to try" section with 2-4 NetLogo-style hints (light, open-ended)
- [ ] References block includes the canonical paper(s) with DOI

If the user asks for cross-runtime porting (Phase 8 = yes):

- [ ] Native implementations build (Rust: `cargo build --release`; CUDA: `cmake + make`)
- [ ] Cross-validation: `./native/cross-validate.sh <name>` exits 0 (bit-for-bit match between Rust+WGPU and C++/CUDA)
- [ ] Coverage table in `native/README.md` updated to reflect ✓ / ✓✓ status

## Key conventions to enforce silently

(Don't ask the user about these unless they violate them.)

- TypeScript strict mode is on. Use proper types for `Model<S extends ModelState>` if state extends the base shape.
- No `Math.random()` ever — only the passed `rng` argument. URL permalinks rely on this.
- No external runtime dependencies. The codebase is library-free; HTML + CSS + plain TS only.
- Use `Float64Array` for node state buffers (the `state.X` field).
- Cache work buffers across step() calls in `state` (see how `nakao.ts` and `gray-scott.ts` use `aux._du / aux._dv`) to avoid GC pressure.
- The `id` field becomes the URL `?model=...` slug. Once shared, never rename it.
- Description language style: NetLogo-style "Things to try" hints in the model file's `long`. Heavy 5-prompt problem sets go to `teaching/problem-sets/<name>.md` (separate file, optional).
- Bilingual: include `name_zh` + `short_zh` always (even minimal). Include `long_zh` if the user can write meaningful Chinese for it.

## Reference materials

- [`reference/substrate-quickref.md`](reference/substrate-quickref.md) — condensed substrate API (Model interface, RNG, generators, layout) — read this once before writing any file
- [`reference/example-models.md`](reference/example-models.md) — three annotated walkthroughs (one static-graph, one lattice, one adaptive) showing the patterns
- [`reference/cross-runtime-quickref.md`](reference/cross-runtime-quickref.md) — when + how to add Rust+WGPU and C++/CUDA implementations

## How NOT to use this skill

- Don't use it for non-adaptiveNet projects. The Model interface is specific to this substrate.
- Don't skip the question flow and dump out a generic model. The point of the skill is that the *output* reflects the user's specific design intent, not a recycled example.
- Don't assume the user wants Chinese translations if they wrote in English. Ask.
- Don't generate problem sets without explicit user input on what each problem should test. Generic problem sets are noise.

## Tone

The user is an adaptiveNet contributor, not a customer. Be direct, ask sharp questions, push back if their design has obvious problems (e.g. "this rule will make all nodes converge to one state in 3 steps, did you mean...?"). Treat them as a peer doing science, not a user to be guided.
