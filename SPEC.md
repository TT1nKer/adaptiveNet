# SPEC — adaptiveNet

**Status:** draft v0.1, problem-definition phase. This document captures the *what* and *why* of the tool. Architecture, syntax, and tech choices are deliberately not yet decided. Extensions are expected; the four-block structure is the hinge that should remain stable.

---

## 0. Bicameral architecture (added 2026-05-04)

adaptiveNet is implemented as **one substrate spec, three runtimes**:

| Runtime | Path | Purpose | N range |
|---|---|---|---|
| Web (TS / JS, browser) | `src/`, `sandbox.html`, `player.html` | Demo, teach, share, embed, interactive exploration | ≤ 10⁵ |
| Native — Rust + WGPU | `native/rust-wgpu/` | Cross-platform GPU (NVIDIA/AMD/Intel/Apple); same WGSL runs anywhere; can re-target wasm + WebGPU for browser | 10⁵ – 10⁷ |
| Native — C++ + CUDA | `native/cpp-cuda/` | Maximum NVIDIA performance, shortest path to bare-metal CUDA features | 10⁶ – 10⁹ |

A model is "the same model" across the three runtimes if it produces statistically equivalent macroscopic trajectories for the same `(model_id, params, seed)`. For models using the spec's standard hash-based PRNG (Mulberry32 init + MurmurHash3 finaliser per-step), bit-for-bit identical state evolution is achievable across runtimes that compile to the same floating-point semantics. For models using stateful per-thread RNGs, only statistical equivalence is guaranteed.

Cross-validation between runtimes is the primary correctness test for the substrate spec. Divergence ⇒ spec ambiguity ⇒ spec amendment.

Why three rather than one (a) or two (b):

- (a) Web-only would cap N at ~10⁵, ruling out the b-stream research the author actually wants to do (large-N adaptive network exploration on GPU). Already insufficient.
- (b) Web + one native would force an ecosystem bet (NVIDIA-only via CUDA, or portable-but-slower via WGPU). Author chose to build both rather than make this bet now (10y commit + AI-coding bandwidth makes the maintenance cost manageable; cross-validation provides spec correctness in exchange).

The three runtimes share:
- Substrate types (graph, node state, edge state, RNG)
- Model interface (params schema, init, step, render config, observables)
- Hash-based PRNG for stateless GPU dynamics where bit-exact reproducibility matters

The three runtimes diverge on:
- Authoring language (JS / TS for web; Rust for WGPU; C++ for CUDA)
- Authoring workflow (in-browser sandbox / git PR for web; cargo + crates for Rust; cmake + CUDA toolkit for C++)
- UI affordances (web has interactive sliders + canvas + share-by-URL; native runtimes are CLI-first, parameter sweeps + CSV export are the natural UX)

---

## 1. What this tool is

A general-purpose, browser-runnable tool for defining and exploring **node–edge dynamical systems** — systems where N entities have state, and the pairwise weights between them also have state, and both coevolve in time under user-defined rules.

One-line positioning: **NetLogo's spirit (fixed substrate, user-editable rules) on a substrate that is GPU-native and edge-state-aware.**

### 1.1 Target user — both casual and research, with progressive disclosure

The tool serves **two audiences with one product**, distinguished only by which preamble switches they flip:

| | Casual / interest user (default) | Researcher (opt-in via preamble) |
|---|---|---|
| precision | auto (fp32 / fp16) | user-selected (fp64 available) |
| determinism | `approx` (fast, GPU-parallel reduction order) | `strict` (bit-exact replay, ~3× slower) |
| history | ring buffer, last N steps | full record, configurable |
| rule editing | template / expression language with friendly defaults | same language, full power |
| validation | light | strict (NaN guards, conservation checks, dimensional sanity) |
| reproducibility guarantee | trajectory shape | bit-exact |

Defaults are tuned for *casual / interest exploration* — NetLogo-style "open it, click run, see emergence." Researchers reach the rigor by writing one or two extra preamble lines. Models written in casual mode and models written in research mode are **interoperable**: the substrate, the rule language, and the file format are identical. A researcher can pick up a casual user's model and tighten it without rewriting.

This positioning is the design hinge for several downstream decisions: rule UX must accommodate both audiences (rules out a JAX-code-only path; argues for layered access), the GUI must privilege the casual default while exposing the rigor switches without hiding them, and the model file format must serialize the preamble state so a researcher can audit "what mode was this run in."

### 1.2 MVP scope — the consumption side first

Most users want to **open the tool, browse polished demos, drag sliders, see emergence**. That is the entire interaction. NetLogo's actual usage distribution makes this concrete: the vast majority of users never author a model — they explore the Models Library. NetLogo's real product is the library, not the language.

The MVP follows from this:

**In scope for MVP:**
- A **demo gallery**: 3–5 polished preset models, each with a cover, a one-paragraph description, and a one-click open.
- For each demo: live slider controls over a small set of meaningful parameters; a visible network with state-driven coloring; one or two basic diagnostics (histogram, time series).
- Seed control + a "reseed" button (cheap; essential for the "again with different randomness" experience).
- Play / pause / reset.
- A way to share a model (URL-encoded `(model_id, params, seed)`).

**Out of scope for MVP — important but later:**
- Authoring new models from scratch (rule editor, language docs, full primitive surface).
- Copy-and-modify a demo into "my model."
- Fork trees, research-mode history scrubbing.
- Determinism / precision / backend switches (assume `approx` / `fp32` / `auto` for v1).
- Validation, NaN guards, dimensional checks.
- Sparse-W path.

The MVP is a **demo browser that happens to run on the substrate**, not a model-authoring tool that happens to ship with examples. Authoring becomes the v2 theme once the consumption surface is good enough to attract first users.

### 1.3 Medium — web is the MVP host, not the platform

The MVP runs in the browser because that medium has the lowest friction for "click a link, see emergence" — zero install, instant share, runs on any device. **The browser is the v1 host, not a platform commitment.**

Long-term productive use of this tool is more likely to live in:
- a **native desktop app** (Tauri / wgpu-rs / Metal / CUDA), where memory ceilings are higher and a real GPU is reachable,
- a **Python library / CLI** for scripting big parameter sweeps and importing from pandas / scientific stacks,
- or a hybrid: web playground + native or Python backend.

Architectural implications today:

- The **model file format** must be medium-independent (JSON or equivalent), not coupled to browser storage / URLs / DOM state.
- The **substrate definition** (X, W, primitives, four-block model) is the portable contract. Anything browser-specific (canvas rendering, slider widgets, URL serialization) lives outside the substrate, in the rendering layer.
- The **rule language**, when introduced in v2, must not be JS or any browser-bound language. The "host JS engine" path is rejected; v2 will use a small expression DSL or a tracer-based array-program API.
- WebGPU is **not** assumed to be the long-term GPU target. WebGPU may be one v2 backend among several (CUDA, Metal, Vulkan, wgpu-rs). The substrate compiles to whichever backend the host environment provides.

In practice, for v1 this means: write the MVP in JS for the browser, but treat `(model file format, substrate semantics, rule semantics)` as the durable contract that survives the eventual port off the web.

---

## 2. What it is not

- **Not a NetLogo replacement.** NetLogo's substrate is `(turtles, patches, links, ask)` with mid-step sequential side effects. We reject those semantics because they cannot be parallelized to GPU.
- **Not a series of paper reproductions.** Specific models (Nakao 2010 reaction–diffusion, Holme–Newman voter, Hopfield, GAT, …) are *examples in the library*, not the product.
- **Not a research contribution to the adaptive-networks field.** This is tooling.
- **Not a Python/MATLAB replacement.** Heavy numerical research can still fall back to those.

---

## 3. The substrate (fixed part of the abstraction)

Two state objects:

| Symbol | Shape | Meaning |
|---|---|---|
| `X` | N × d | per-node state (`d=1` for scalar, larger for vector states) |
| `W` | N × N (× d′ optional) | per-pair weights. Dense representation: every (i,j) exists; most values may be near zero. |

The substrate fixes three things:

1. **Storage.** Dense N×N weights, dense N×d node states. Sparse-W is a future extension once N exceeds what dense allows.
2. **Execution semantics.** **Synchronous, pure-functional**: `state[t+1] = f(state[t])`. No mid-step side effects on shared state. Ever.
3. **Primitives** the rule language must expose:
   - `W @ X` — matmul / neighbor aggregation. The core kernel.
   - `X ⊗ X` — outer product, for Hebbian-style W updates.
   - element-wise math.
   - reductions (sum, mean, max) over rows / cols.
   - seeded randomness.
   - indexing / masking / `where`.

At the dataflow level this substrate is structurally identical to GNN message-passing, fast-weight programmers (Schmidhuber 1992 → Schlag/Irie/Schmidhuber 2021), and a sparse special case of self-attention. It runs natively on GPU.

---

## 4. A model = four blocks

```
[preamble]   how to run         — settings: seed, history, determinism, fork, backend
[init]       initial state      — runs once: X[0], W[0]
[step]       one time-step      — runs every tick: (X[t], W[t]) → (X[t+1], W[t+1])
[observe]    what to watch      — diagnostics: plots, histograms, derived scalars
```

All four blocks share the same primitive language. `init` and `step` differ only in *when* they run.

### 4.1 preamble — execution settings

Function-call-style declarations whose **parameter names surface the tradeoff**. Examples (illustrative; syntax TBD):

```
seed(42)
determinism(mode = "strict")          # "strict": bit-exact, ~3× slower on GPU. "approx": fast.
history(X = "full",                    # store X every step
        W = "snapshot_every(50)")      # store W every 50 steps; replay between
fork(enabled = true)                   # state is a tree, not a line
backend("auto")
precision("fp32")
```

These declarations are **orthogonal to the dynamics**. Changing them does not change what the model means, only how the runtime executes it.

### 4.2 init — initial state

Runs once. Computes `X[0]` and `W[0]`. Has access to:

- random initialization (seeded by preamble)
- topology generators (ER, BA, WS, lattice, complete, empty, ring, …)
- algorithmic patterns (Hebbian-encode patterns, spectral assignment, …)
- file/data loading (CSV, JSON, image, adjacency list)
- (later) interactive painting in the GUI

### 4.3 step — one time-step

Pure function `(X[t], W[t]) → (X[t+1], W[t+1])`. Uses substrate primitives only. Cannot perform sequential side effects across nodes within a single step.

### 4.4 observe — diagnostics

Declarative. The user names what they want to watch (e.g. `σ(X[:,0])`, histogram of `X[:,0]`, eigenvalues of `W`, fraction of nodes above a threshold) and the tool renders the corresponding panel. Drives the diagnostic UI.

*Detailed contents and primitive set: TBD; defer until target user is settled.*

---

## 5. Reproducibility & history

Two related but distinct features.

**Reproducibility.** A `(model, params, seed)` triple uniquely determines the trajectory. The model file serializes the full triple. Pasting a model (URL or file) reproduces what someone else saw.

**History.** Past states are queryable during a session. Implementation strategy is left to the runtime — a likely choice is "store `X` every step, snapshot `W` every K steps, replay between snapshots." The exact schedule is configurable in the preamble.

**Fork.** Together, reproducibility + history enable forking: from any past state, perturb and continue along a new branch. The full set of forked runs is a tree, not a line. Fork-as-first-class is a design candidate but not yet committed; see open question 5.

---

## 6. Out of scope (for now)

- Sparse-W representation (deferred until dense is exhausted).
- Asynchronous / event-driven dynamics where update order matters semantically (Gillespie, true async voter, NetLogo-style `ask`). These can run on the same substrate only when reformulated as synchronous batch updates.
- Discrete agent ABM with mid-step mutation of agentsets.
- 3D or geographic-spatial models (no spatial coordinates in the substrate).
- Training neural nets. The tool simulates dynamics; it does not do gradient descent. (Connections to ML are at the level of structural analogy, not implementation.)

---

## 7. Open questions

These are NOT decided and must be answered before architecture is committed.

Resolved:
- ~~**Target user.**~~ **Resolved (§1.1):** both casual/interest and research, progressive disclosure via preamble defaults.
- ~~**MVP scope.**~~ **Resolved (§1.2):** demo gallery first; authoring comes later.

Still open:

1. **Target N.** ≤1K (dense W comfortable on browser GPU) vs. ~10K (dense ~400 MB, marginal) vs. ≥100K (sparse mandatory). Determines whether dense-only or dense+sparse is required. Constrained by §1.1 + §1.2: MVP demos should feel instant at small N; research opt-ins may want a path to larger later.
2. **Rule editing UX.** Range from "pick from menu" → "write expressions" → "write full array-program code" → "wire visual node graph." Constrained by §1.1: must accommodate both audiences, which probably argues for *layered access* rather than a single point. Defer concrete decision until post-MVP, since authoring is out of MVP scope.
3. **`observe` layer specifics.** What primitives the user has for declaring diagnostics. Defer until (2) is settled.

---

## 8. Versioning

This document is the contract for problem definition. Update it *before* changing the abstraction; a feature that does not fit cleanly into one of the four blocks is a signal that the spec — not the feature — needs reconsideration.
