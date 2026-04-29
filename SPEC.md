# SPEC — adaptiveNet

**Status:** draft v0.1, problem-definition phase. This document captures the *what* and *why* of the tool. Architecture, syntax, and tech choices are deliberately not yet decided. Extensions are expected; the four-block structure is the hinge that should remain stable.

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

- ~~**Target user.**~~ **Resolved (§1.1):** both casual/interest and research, progressive disclosure via preamble defaults.

Still open:

1. **Target N.** ≤1K (dense W comfortable on browser GPU) vs. ~10K (dense ~400 MB, marginal) vs. ≥100K (sparse mandatory). Determines whether dense-only or dense+sparse is required for v1. Constrained by §1.1: casual default should be small enough to feel instant on a laptop browser; research mode may want a path to larger.
2. **Rule editing UX.** Range from "pick from menu" → "write expressions" → "write full array-program code" → "wire visual node graph." Constrained by §1.1: must accommodate both audiences, which probably argues for *layered access* (templates → expressions → full code) rather than a single point on the spectrum.
3. **`observe` layer specifics.** What primitives the user has for declaring diagnostics. Defer until (2) is settled.
4. **MVP scope.** What is the minimum demo that proves the concept? Does MVP need fork? History scrubbing or only replay? Multiple kinetics or only one? Should the MVP target the casual mode only and add research switches later, or both from day one?

---

## 8. Versioning

This document is the contract for problem definition. Update it *before* changing the abstraction; a feature that does not fit cleanly into one of the four blocks is a signal that the spec — not the feature — needs reconsideration.
