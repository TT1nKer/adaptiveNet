# Next steps

Things worth doing when picking the project back up. The gallery is in good shape and most demos are individually polished, but the **strategic frame** is: this is the *survey phase* before designing the v2 authoring abstraction. Each demo is a data point about what the eventual abstraction has to express. Pick directions with that in mind.

Two parallel tracks now:

**Track A — fill survey gaps**: more demos that exercise corners of the substrate the existing 10 don't already cover. See "Underserved regions" below.

**Track B — start the synthesis**: write a "what API would let me write all 10 in 50 lines each" sketch. This is the actual abstraction work. Doesn't need to be done before more demos but is the main deliverable, so don't postpone forever.

---

## High-ROI: Hopfield capacity / α_c phase transition

The current Hopfield demo stores 4 hand-drawn patterns and lets you tune noise. That hides the most interesting feature of Hopfield networks: **the storage capacity is a phase transition**, with a precise critical load α_c = P/N ≈ 0.138 (Amit, Gutfreund & Sompolinsky 1985–87).

Below α_c: stored patterns are stable attractors, recall works.
At α_c: critical fluctuations, recall succeeds for some seeds and fails for others.
Above α_c: spin-glass phase — exponentially many spurious attractors, no useful recall.

This is the same kind of object as the Ising demo's T_c: a critical line a slider can walk across.

### Design

New Hopfield "capacity" preset / mode:

- Replace the 4 fixed (X, O, +, ◻) patterns with **K random binary patterns** (P drawn at runtime).
- Expose **P (number of patterns)** as a slider, default ~50, max ~300 for N=1024.
- Show **α = P/N** live in the state panel.
- Diagnostic: time series of `overlap with closest stored pattern`. Below α_c this saturates near 1; above α_c it stays near 0.
- Presets walking across α_c:
  - `α = 0.05` (safe — clean recall)
  - `α = 0.138` (critical — half-and-half outcomes)
  - `α = 0.20` (spin glass — recall broken)

Why random patterns rather than the existing geometric ones: AGS's 0.138 result holds for **uncorrelated random patterns**. The 4 geometric patterns we ship now are heavily correlated (X and + share many active pixels), so they hit a much lower effective capacity. To make the phase transition visible at the textbook α_c, the patterns must be statistically uncorrelated. Suggestion: ship two modes — "geometric" (current 4) for the recall demo, "random / capacity" (P random patterns) for the phase transition.

### What this connects to

- **Critical phenomena**: Same machinery as Ising T_c, Onsager 1944. Capacity collapse is a true second-order transition with critical exponents and universality.
- **Modern Hopfield / Transformer**: Ramsauer et al., *Hopfield Networks is All You Need*, arXiv:2008.02217 (2020). Shows that Transformer attention is equivalent to a continuous-Hopfield variant whose capacity scales **exponentially** with N, not as 0.138 N. Worth a follow-up demo: side-by-side classical vs modern Hopfield, watch the latter handle 100 patterns where the former collapses at 30.
- **Brain analogue (speculative but live in the literature)**: Neural avalanches, 1/f noise, power-law dynamics suggest cortex may operate near criticality. Beggs & Plenz 2003 in vitro work, Chialvo 2010 review.

---

## Lower-priority but easy

- **Per-preset README annotations**: each preset's description could link to a specific paper figure. Most demos already cite their source; only Gray-Scott has the per-preset Munafo links. Could add: Hopfield presets → AGS paper, Ising presets → Onsager etc.
- **More Munafo Gray-Scott regions**: only ξ, β, α, π, λ, κ, δ are represented now. The remaining ~10 named regions could each become a preset. Diminishing returns set in fast — probably not worth doing all 19; pick the 3-4 most visually distinct missing ones (ε spots-with-rings, λ proper hexagonal lattices, ν drifting solitons).
- **Brain criticality demo**: 1D excitable medium with sandpile-style avalanches; show the power-law avalanche size distribution that Beggs–Plenz observed in cortical slices. Different model from anything in the gallery now.

---

## Things to NOT do without thinking about value first

- Cataloguing all 19 Munafo Gray-Scott regions. Coverage is not the value; interactivity is. Munafo's catalogue already covers; we'd just be mirroring.
- Wide expansion of model count. Each new model has a fixed cost (writing, debugging, presets, descriptions) and decreasing marginal value. The gallery has 7 demos that span the substrate well — adding 5 more dilutes more than it adds.
- Refactoring the substrate "for cleanliness". The Hopfield/LIF state-as-storage pattern works; don't tidy it for its own sake.

---

## Underserved regions of the substrate

Looking across the 10 demos, the (update-granularity × W-storage × state-shape × init × diagnostics) space is mostly explored, but a few corners are under-covered:

- **Truly adaptive networks** with W-state co-evolution. Voter has it (rewiring) but it's the only one. **Hebbian-on-graph** (W self-organises while X evolves), **preferential attachment + state**, or **opinion-topology co-evolution** would each fill this corner.
- **Larger N regimes (10⁴–10⁶)** to expose where the substrate breaks. Currently capped at ~25K cells. Pushing further forces the question of dense vs sparse W choice — a decision the v2 abstraction has to expose.
- **Structured non-grid topologies**: e.g. hyperbolic graphs, fractal lattices, hierarchical small-world. The current "topology" choice is ER/BA/WS for sparse demos and 4-regular grid for grid demos; nothing in between.
- **Cumulative / event-distribution diagnostics**: the avalanche-size power-law plot is the obvious missing diagnostic; would also serve any future demos that want histograms of *events over time* rather than *cell values now*.
- **Authoring-style demos**: even before v2 authoring proper, one demo that shows the user dragging two named building-blocks together (e.g. "Mimura-Murray reaction" + "graph Laplacian diffusion") and getting Nakao for free would be a sketch of the abstraction.

## What synthesis looks like

When ready to move from survey to abstraction:

1. Read the 10 model files side by side and extract common boilerplate. There's a lot — `buildGrid`, `coarseNoise`, `Hebbian train`, the `aux state` pattern, the `cols/rows + view='grid'` glue.
2. Write a sketch: "if I had primitives X, Y, Z, here's what each demo would look like in 30 lines." If the sketch fits, the primitives are right. If demos resist the sketch, primitives are wrong.
3. The v2 spec is a **set of named primitives** + **a syntax for composing them** — not a runtime, not a UI. Get the names right first.

## Process notes

- Verify any "this is in literature X" claim by actually fetching the source. Multiple errors in the recent round (U-skate coordinates, Reynolds-Ponce-Pearson scope) came from speculating from memory.
- "Some observations may still be worth writing down." A short blog post or arXiv preprint linking the Munafo classification to specific demo URLs (with a paragraph on what the interactive format adds vs static catalogue) is a low-stakes way to put the tool in front of researchers in the wider excitable-media community.
