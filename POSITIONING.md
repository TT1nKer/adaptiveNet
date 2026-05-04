# Positioning — verified facts and honest landscape (v2)

This document records what I have **actually verified** about adaptiveNet's relationship to existing tools, after deliberate research on 2026-05-03. An earlier draft contained unverified market claims ("25-year gap", invented user counts); those were removed. The first rewrite (also 2026-05-03 morning) was still incomplete because it was based on memory rather than search. This version is post-search.

---

## The closest competitor I had not heard of: Evoplex

The most important finding from this round: **Evoplex** (Cardinot et al., *SoftwareX* 2019) is a published, peer-reviewed platform with the same core positioning as adaptiveNet:

> "Evoplex is a fast, robust and extensible platform for developing agent-based models and multi-agent systems on networks. Each agent is represented as a node and interacts with its neighbors, as defined by the network structure."

This is essentially the platform I thought adaptiveNet was filling a gap for. **It already exists.** But after cloning the repo and reading the code, the picture is more nuanced — Evoplex's pitch is right but its execution has specific weak spots that explain why it hasn't propagated, and that adaptiveNet structurally avoids.

### Verified by inspecting the cloned repo (2026-05-03)

- **Active dev window**: November 2018 – **July 2019**. 50 commits total. Then nothing — last commit `c6e78af`, 2019-07-29.
- **Pattern**: 7 commits in 2018, 43 in 2019, 0 since. Looks like **PhD-then-abandon**: lead author Marcos Cardinot was at NUI Galway (with O'Riordan & Griffith as supervisors, Perc as external collaborator); the SoftwareX paper came out March 2019; activity tapered through July; project then froze. Classic "research tool dies when the one PhD student moves on".
- **Models that ship by default**: only **4** — `cellularAutomata1D`, `gameOfLife`, `populationGrowth`, `prisonersDilemma`. All classic complexity examples; **no reaction-diffusion, no Hopfield, no Ising, no spiking, no adaptive-W demos.**
- **Graph topologies that ship**: only **6** — `cycle`, `edgesFromCSV`, `path`, `squareGrid`, `star`, `zeroEdges`. **No ER, no BA, no WS.** For a tool branded "agent-based modeling on networks", the absence of the standard network-science generators is striking.
- **To write a new model**: subclass `AbstractModel` in C++, implement `init()` + `algorithmStep()`, declare metadata in JSON, write a CMakeLists.txt, link against EvoplexCore + Qt5, build a shared library, install it into Evoplex's plugin directory, restart the app. **Authoring barrier is high.**
- **Distribution**: per-OS native installer (Windows/macOS/Linux), Qt5 desktop binary. **No URL share, no zero-install path.**
- 145 stars on GitHub.

Sources: [evoplex/evoplex repo](https://github.com/evoplex/evoplex), cloned and inspected directly. [Cardinot et al. 2019 SoftwareX paper](https://www.sciencedirect.com/science/article/pii/S2352711018302437).

### Evoplex vs adaptiveNet — honest side-by-side

| Axis | Evoplex | adaptiveNet |
|---|---|---|
| Project status | Dead since July 2019 | Active |
| Authoring a new model | C++ plugin + CMake + Qt5 SDK + restart app | TypeScript file in `src/models/` + Vite hot-reload |
| Distribution | Per-OS native installer | URL, zero install |
| Sharing a configured run | Send a project file | URL with model + params + seed |
| Built-in random graphs | None (no ER/BA/WS) | ER + BA + WS |
| Built-in models | 4 classics | 10 (network Turing, voter, Hopfield × 3, Ising, RD × 2, LIF, avalanches) |
| Adaptive-W demonstrated | Not in default set | Yes (voter demo rewires) |
| Maintenance treadmill | C++ + Qt5 + per-OS builds | Web stack, browser handles compatibility |

### Why this matters more than the niche-gap question

The "niche" arguments matter less than I made them sound. **The more useful frame**: Evoplex tried this pitch, with academic backing (Perc is a heavy-hitter in complex systems on networks), and the project still ground to a halt within 9 months of publication. The reasons appear structural — high authoring barrier, OS-specific installs, no zero-install demo path, single maintainer — and adaptiveNet currently avoids most of these:

- **Authoring barrier**: TS file vs C++ plugin SDK is **dramatically lower friction**. A researcher who wants to try a new model can do it in an afternoon vs a weekend.
- **Single-maintainer risk**: still present here. Web stack has lower maintenance burden than Qt5 desktop, but still requires someone to push to it.
- **Distribution**: URL-share vs installer is significant. NetLogo and Evoplex both require download-and-install; that's a real friction wall vs "click a link".

### What this implies for adaptiveNet's strategy

The risk to actually worry about is **not "is the niche real"** — Evoplex's existence proves people thought so. The risk is **"will any maintainer-worth's worth of users adopt before the maintainer (you) moves on?"** That's the same trap Evoplex fell into.

What matters for surviving that trap:
- **Low authoring friction** so other people can add models without contacting the maintainer
- **Low maintenance burden** so the project doesn't rot when activity is low
- **Visible enough** that a few researchers find it before the maintainer loses interest

The first two adaptiveNet has structurally. The third is not addressed by anything in the codebase — that's "go talk to a researcher" work, not engineering work.

### Things adaptiveNet should consider stealing from Evoplex

Even though Evoplex died, parts of its design are good:
- **Parameter sweeping as a first-class feature** (run the same model across N parameter combinations). adaptiveNet has none of this; researchers eventually want it.
- **Custom output / data export** — Evoplex lets a model declare custom diagnostics that get written to file. adaptiveNet has live time-series but no batch export.
- **Cite-this command** in the UI — Evoplex shipped a citation prompt; trivial to add and it normalizes academic citation.

These are concrete features to consider adding, that aren't speculative — they're proven research-tool-survival features.

---

## What the SoftwareX paper itself reveals (Cardinot et al. 2019)

Read the actual paper on 2026-05-03. Pulls out details the GitHub repo + summaries didn't show.

### Their own diagnosis of why ABM tools fail

In Section 1 the authors explicitly call out the failure mode that they themselves then fall into:

> "many ABM projects start with the promising and challenging intention of developing powerful software to meet any requirement in the field... this promising approach usually results in making the code base very complex and hard to both optimize and maintain. In reality, given the small size of the development teams, there is no best strategy for all scenarios."

Their conclusion: "**defining a clear and focused scope can help solve those issues**." They then chose scope = "agent-based models on networks". The discipline appears to have helped — the codebase is small, focused, well-tested. But the project still died, suggesting **focused scope is necessary but not sufficient** for survival.

### The CSV-project-as-experiment-table is more central than I'd realised

A "project" in Evoplex is a **CSV file** where rows are experiments and columns are parameter values:

> "A project is a plain table (csv file) where the experiments are listed along the rows, and the inputs to each experiment are placed along the columns. An experiment is defined by a set of parameter settings (inputs) necessary to perform one trial (simulation) and (optionally) the required data outputs."

This is a much more powerful organisational primitive than I initially thought:
- Parameter sweeps are **the central workflow**, not an add-on feature
- The CSV is **plain-text, version-controllable, portable**
- "allows newcomers to interact with the models without requiring any programming skills"

adaptiveNet currently has nothing comparable — a "session" is a single URL with one parameter set. The CSV-as-project pattern is **directly portable** and would meaningfully upgrade adaptiveNet for research use. Could be added without large architectural change.

### They explicitly predicted a web frontend — and did not ship it

Section 2.1, on architecture (kernel decoupled from GUI):

> "Evoplex can be distributed with different user-interfaces but share the same engine. For instance, one may want to implement an EvoplexCLI application to perform simulations via command-line, or an **EvoplexWeb application to provide visualization tools on a web browser**."

The authors literally predicted adaptiveNet's positioning, in 2019. They did not build it. Six years later nobody has filled that branch.

This is the strongest argument that adaptiveNet's "web + zero install" angle is structurally distinguishing — not "I imagined a gap"; the **Evoplex authors themselves named it as the obvious-and-not-shipped variant of their own work**.

### Their stated audience is narrower than "network science"

Section 4 ("Impact"):

> "Evoplex is intended to address research whose methodology comprises a simulation-based approach to evolve outcomes of populations of autonomous and interacting agents. It has been used to support research in a number of areas, including **spatial game theory and evolutionary game theory** [1, 23, 24]."

The three citations of impact are **all by the lead author** (Cardinot, with the same supervisors). No external citations of Evoplex usage are mentioned in the paper.

Implications:
- Their target was **evolutionary game theory + spatial game theory**, not adaptive networks broadly
- At publication, outside adoption appears to have been near-zero
- "Network science" was the *substrate* but the *audience* was a specific game-theory community

This narrows what adaptiveNet should learn:
- Evoplex's failure is partly evidence that **even with academic backing, even with a Perc-tier collaborator, even with a 9-month focused build, the audience for "ABM on networks" did not materialise enough to sustain the tool**
- Possible reasons: game theorists already have MATLAB/Mathematica scripts they prefer; they don't want a new tool; the C++ plugin barrier kept them out; word never reached them
- adaptiveNet should ask: **is there a different audience** (spiking-net hobbyists? complex-systems teachers? science communicators? non-academic curious people?) where the web + low-friction story might land where Evoplex's couldn't

### Their stated future work was never done

Section 5: "future work will involve adding support for multilayer networks, as well as implementing more plugins, and developing more visualization widgets for the GUI."

None of this happened — last commit July 2019. Multi-layer is still missing in 2026.

---

## Net update to recommendations

Refined from the cloned-repo section above:

1. **CSV-project-as-experiment-table** is now top of the steal-list. It's a small architectural addition (probably 200-500 lines) that would convert adaptiveNet from "interactive playground" to "research tool" in user perception. The Evoplex paper makes the case for this clearly.

2. **The audience question is harder than I thought.** Evoplex aimed at game theorists with academic muscle behind it and still didn't catch. adaptiveNet should not assume "network dynamics researchers" is a uniform audience that will adopt a good tool. Concrete next move: **identify ONE specific person** who would use adaptiveNet weekly and design for them, rather than for an imagined community.

3. **Web + zero install is now defensibly the right axis to lean on**, not because I imagined it but because the Evoplex authors named it as the obvious uncovered direction. This is the closest thing to external validation of adaptiveNet's pitch that I've found.

---

## Positioning constraint stated by the author (2026-05-03)

The author has explicitly chosen **not to position adaptiveNet as a neuromorphic-specific tool**, even though neuromorphic computing was the personal inspiration. Reasoning:

- Simulating neurons is itself a moving target — at what level of biological precision (membrane / functional / abstract)?
- Neurons may not be the unique substrate for intelligence; betting on them prematurely closes off other candidates
- The abstract structure (nodes + co-evolving connections) is what neuromorphic, statistical mechanics, theories of biological cognition, and several philosophy-of-mind frames all share

This is intentional epistemological humility. adaptiveNet's framing should be:
- The substrate is general
- Neuromorphic models (LIF, Hopfield) are *one set of instances* among others (Ising, RD, voter, etc.)
- The project does not commit to any particular candidate being the answer

This is more philosophically rich than "neuromorphic playground" and more honest to the project's actual scope, but it is **harder to market** — there is no specific cultural moment ("the Nobel", "the chip wave") to attach to. The audience is correspondingly more diffuse: people interested in the substrate question itself, not in any one substrate.

The README and gallery were updated 2026-05-03 to reflect this stance: emphasising the abstract shape, mentioning neuromorphic as one of several instances, leaving the substrate question open.

### Structural argument for graph-native substrate (vs lattice-native)

The author added a sharp empirical / structural argument for why adaptiveNet must be **graph-native**, not lattice-native, even though many classical demos (Ising, Gray–Scott, Brusselator, LIF, Avalanches) currently live on regular grids:

- A cortical pyramidal neuron averages ~7,000–10,000 synapses (Drachman 2005; Braitenberg & Schüz). Some neuron classes are higher.
- 2D regular lattices give 4 (von Neumann) or 8 (Moore) neighbours; 3D gives 6 or 26. **Three orders of magnitude** away from biological connectivity.
- Patching a lattice with long-range edges (Watts–Strogatz style) lowers path length but does NOT reshape the degree distribution. To reach brain-scale connectivity, generation must be graph-first, not grid + patches.

Implication for the v2 substrate design (when undertaken): **arbitrary-degree graphs are the primary case; regular lattices are a derived special case (a regular grid graph)**. Hard constraint, not a preference. Bake-in assumptions like "node has 4 neighbours" or "neighbour at (x±1, y)" are anti-pattern at the substrate level — they may live inside specific lattice demos but must not propagate outward.

Worth noting: even neuromorphic hardware itself does not solve this connectivity problem — Loihi 2's mesh routing, SpiNNaker's packet bandwidth, and Akida's on-chip SRAM all force lower fan-out than biology. So "general graph dynamics" is an underserved niche even on the hardware side, which further supports not betting the project on neuromorphic specifically.

Source: [Cardinot, Marcos, et al. "Evoplex: A platform for agent-based modeling on networks." *SoftwareX* 9 (2019): 199-204.](https://doi.org/10.1016/j.softx.2019.02.009) — read in full.

---

## Scientific-history positioning: pre-Boltzmann phenomenology

The deepest framing of what kind of project adaptiveNet is — added 2026-05-03 after a long grilling session that started from "is this just another NetLogo" and ended here.

### The structural analogue: 1870s thermodynamics

Before Boltzmann, mechanics and thermodynamics were two languages with no bridge:
- **Mechanics**: Newtonian, microscopic, reversible, deterministic — the trajectories of N particles.
- **Thermodynamics**: temperature, entropy, pressure — macroscopic, irreversible, empirical (Carnot, Clausius).

Both worked in their own domain. Nobody could explain why microscopic reversibility produces macroscopic irreversibility. Loschmidt and Zermelo objected; Mach denied atoms.

Boltzmann's contribution (1872–1877) was not a proof. It was finding a mathematical object — **S = k log W** — that lives simultaneously at both scales. The H-theorem (1872) needed Stosszahlansatz, an unproven physical intuition. The Boltzmann equation gave intermediate-scale dynamics. **S = k log W (1877) was the actual bridge**: a formula whose left side is macroscopic thermodynamics and whose right side is microscopic state-counting.

Lanford (*Comm. Math. Phys.* 1975) gave the first rigorous derivation of the Boltzmann equation — but only in the Boltzmann–Grad limit and only for ~0.4 mean-free-path times. **A full rigorous theory still does not exist**, 150 years on. That has not stopped statistical mechanics from being one of physics's most successful theories. *Bet on the right object first; rigour can wait a century* is the real historical pattern.

### The mapping to current emergence theory

| 1870s thermodynamics | Emergence / adaptive networks (today) |
|---|---|
| Mechanics (microscopic, reversible) | Agent rules, node updates, edge dynamics |
| Thermodynamics (macroscopic, empirical) | Emergent observables — power-law avalanches, consensus, criticality, patterns |
| Two languages, no bridge | Two languages, no bridge |
| Missing: a meso-scale mathematical object | Missing: a meso-scale mathematical object |
| Stosszahlansatz | Mean-field, moment closure, Markov assumptions |
| W = state count | ??? |
| Boltzmann 1872–1877 | Has not happened |

The structural isomorphism is exact, not rhetorical. Emergence theory is in the Boyle–Charles–Avogadro phase: lots of empirical observations, lots of models, no unifying meso-scale object.

### Why phase transition theory is the anchor — but not the answer

Phase transition theory (Onsager 1944, Wilson 1971) is the **only fully successful micro-macro bridge in statistical mechanics**. Its substrate is the partition function `Z = Σ exp(-βH)`, of which `S = k log W` is the microcanonical special case. Wilson RG (1971) was the second paradigm jump — showing how universality emerges from coarse-graining flow.

This is the closest thing to a worked template for what emergence theory needs. But it does not directly transplant, for four reasons:

1. **Equilibrium assumption.** The partition function's legitimacy comes from ergodicity + detailed balance. LIF spiking, Hopfield-during-learning, voter dynamics, coevolving networks — none satisfy this. Non-equilibrium statistical mechanics (Jarzynski 1997, Crooks 1999) has progress but no "non-equilibrium Z" yet.
2. **Thermodynamic limit.** Equilibrium phase transitions are mathematically rigorous only at N→∞. Finite-size scaling (Fisher 1971, Privman 1990) bridges this when the limit exists. Many emergence systems have *meaningful finite scales* (cortical regions ~10⁶, social communities ~10², ecosystems ~10¹) where the limit may not be the right reference at all.
3. **Symmetry-driven universality.** Ising, XY, Heisenberg classes are organised by clear symmetries (Z₂, O(2), O(3)) plus dimension. Adaptive systems often lack such clean symmetries — Hopfield has multiple stored patterns, spiking systems break time-translation, coevolving graphs have changing structure. Without symmetry, no clean universality class boundaries.
4. **Already tried, partial success.** This line has been pursued 30+ years: Bak–Tang–Wiesenfeld SOC (1987), neural criticality (Beggs–Plenz 2003, Mora–Bialek 2011, contested by Touboul–Destexhe 2017), Doi–Peliti field theory for stochastic processes (1976+), network ensembles (Park–Newman 2004, Bianconi). Real results in some cases, no unified emergent partition function.

### Two RG entry routes, not one

A subtle correction worth recording: it is *not* the case that emergence theory must first find an analogue of `Z` (Boltzmann-style static object) before it can do RG (Wilson-style dynamic process). Two routes exist:

- **Route 1: Find the static object.** An emergence partition function whose logarithm gives macroscopic quantity. This is the "wait for our Boltzmann" path.
- **Route 2: Build RG flow on a different substrate.** Doi–Peliti formalism does RG on path integrals from master equations *without* equilibrium Z. Information-theoretic RG (Apenko 2012, Koch-Janusz–Ringel 2018) uses mutual information as the flow object. Tensor network coarse-graining works without classical Z.

Equilibrium statistical physics happened to find Route 1 first because ergodicity made it tractable. For non-equilibrium adaptive systems, Route 2 may be the more direct path. Both routes might converge, or might not. Either way, the search is open.

### The Wien-displacement-law analogue

Mora–Bialek's "biological systems live near criticality" (2011) is well-placed by analogy as **Wien's displacement law (1893)**: empirical regularity plus partial theoretical reasoning, but not yet the equivalent of Planck (1900) deriving the full spectrum. Useful as a localising signal, not a finished theory.

### The historical warning

Population dynamics has had 200 years and no Boltzmann moment. Logistic (Verhulst 1838), Lotka–Volterra (1920s), demographic transition theory — all phenomenological ODEs, none deriving macro from micro. The closest serious attempts are **Kingman coalescent (1982)** going from Wright–Fisher to genealogy, and **Metz–Geritz adaptive dynamics (1996)** going from individual-based to evolutionary attractors. Neither closed the bridge.

This is a real warning: not all empirical-rich domains find their Boltzmann. There are three live possibilities:

1. Emergence's Boltzmann is coming (optimistic).
2. Emergence has no single Boltzmann — Wolfram's "irreducible computation" position.
3. Emergence has multiple Boltzmanns, one per universality class. Statistical physics itself has many (Ising / XY / Heisenberg / percolation each have their own); no reason emergence collapses to a single one.

The author's working bet is (3). adaptiveNet's positioning does not require any of (1)–(3) to be right.

### adaptiveNet's actual position in this story

**Pre-Boltzmann phenomenology platform.**

Boltzmann 1872 was preceded by ~100 years of gas experiments (Boyle 1662, Charles 1787, Gay-Lussac 1808, Avogadro 1811, Joule 1840s). Without standardised, comparable phenomenology, Boltzmann could not have written the H-theorem. He needed to know which gas behaviours were similar, which limits were clean.

Adaptive network / emergence research lacks this standardisation. Each group runs ad-hoc simulations, parameter conventions differ, topologies differ, observables differ. Cross-comparison is hard.

This is what adaptiveNet is for, in scientific-history terms:

> **Not to produce the Boltzmann. To produce the Boyle / Charles / Avogadro–level phenomenology — standardised, browsable, reproducible, citable.**

The framing wins under all three possibilities above:
- If (1) — the Boltzmann is coming — adaptiveNet is the soil it grows from.
- If (2) — no Boltzmann exists — adaptiveNet is still the standardised platform for the irreducible-computation phenomenology school.
- If (3) — multiple Boltzmanns — adaptiveNet is one of the substrates on which different universality classes get distinguished.

Two-sided bet.

### What phase transition theory actually gives the product

Not "phase diagrams" (5-year research). The real gift is **vocabulary**: order parameter, susceptibility, correlation length, universality class. These concepts are mature, well-understood, and immediately useful as organising principles.

One concrete, near-term implication for adaptiveNet's design (recorded here, not a v1 commitment):

**Models should be able to declare *multiple candidate order parameters* as first-class observables**, not a single one. For familiar models the order parameter is obvious (Ising magnetization, Hopfield overlap-with-target). For genuinely novel emergent systems, *finding the order parameter is itself the research question* — so the platform must support exploration of multiple candidates rather than locking in one declaration. Hopfield should expose ≥3 candidates (overlap-with-target, max-overlap-with-any-stored, mean-activity); Ising should expose magnetization, susceptibility, Binder cumulant; adaptive SIS should expose infected fraction, SI-edge fraction, mean degree of the I-subgraph.

This honours both "order parameter is the right vocabulary" and "the platform should not pre-decide what the order parameter is for new systems."

### What does NOT belong in the product, despite being attractive

- **Cross-model comparison views** (same topology, run Hopfield/Ising/voter/LIF, look for shared universality). Operationally this is a multi-year research programme — observables differ across models, "avalanche" is defined differently, etc. Boyle's first principle was *vary one variable at a time*. Same-model-across-topologies is the right v1 version of this idea; cross-model is later.
- **"NetLogo for adaptive networks"** as elevator pitch. Recorded in earlier feedback as a narrowing-for-marketability anti-pattern.
- **Any claim that adaptiveNet itself will produce the Boltzmann.** It produces the soil, not the seed.

---

## What adaptiveNet is for, concretely (operational priorities)

The pre-Boltzmann framing above describes the *shape* of the project. This section names the specific groups of people it serves and the order in which their needs should be attended to. Worked out 2026-05-03 by walking five concrete research / education frontlines and asking "what is the unmet need each one currently has."

The project is **open-source and free**. There is no monetization plan now or in the future. Priorities below are framed in academic-commons / FOSS terms — contribution to the field over decades, not user-growth metrics.

### The six communities, in priority order

| # | Community | Unmet need | Current status |
|---|---|---|---|
| 0 | **The author themselves** (b-stream personal-research use) | Does adaptiveNet earn a place as the author's own daily playground for graph-and-dynamics sketches? If no, this is the *Cardinot pattern* — the platform survives only as long as the original maintainer's interest, and lacks the natural grounding that comes from the maintainer being a daily user. | Open question |
| 1 | **Course instructors** (complex systems / network science / statistical physics) | Assignable interactive demos with no install barrier; ready-made experiment prompts; explicit alignment with existing textbooks (Sayama 2015, Newman *Networks*, Wilensky-Rand 2015). | **Highest priority for sustained contribution.** Demos exist; instructor-facing materials do not yet exist. |
| 2 | **Brain-criticality researchers** (Plenz / Touboul / Chialvo lines, ~33 papers in 2024) | Building methodological intuition about avalanche definition, time-window binning, subsampling, and exponent estimation under finite-size. The Touboul-Destexhe 2017 critique is methodological, not ontological. | Avalanches demo exists but does not yet expose the methodological knobs the controversy actually turns on. |
| 3 | **Adaptive-network theorists** (Berner-Kuehn moment-closure line) | Validating analytic predictions (mean-field / moment-closure / continuum-limit) against ensemble simulation. Currently each claim is a 1–2 week DIY pipeline. | Adaptive-SIS and Adaptive-Voter exist but lack ensemble runs, seed-list control, and CSV export — without these adaptiveNet cannot serve this community. |
| 4 | **ML researchers + science writers** (Hopfield-attention equivalence interest, post-2024-Nobel) | Visual and interactive material for blogs, threads, popular writing. People in this group mostly engage through writers, not directly with the platform. | Modern Hopfield demo exists; needs screenshot-friendliness, embed-friendliness, stable short URLs. |
| 5 | **Network RG researchers** (~50–100 PI globally) | Visualization of coarse-graining schemes. No existing tool serves this. | No demo yet. *"No existing tool"* may also mean *"no binding need"* — wait for a specific collaborator before building. |

### Why teaching is priority #1 despite small per-cohort numbers

A first-pass ranking on the same day put teaching at priority #4 because each individual cohort is small and the materials take years to mature. **That ranking imported a project-evaluation lens that does not apply to this project** (see `feedback_no_commercial_vocabulary_for_commons_project.md`). Reasoning for the corrected ranking:

- Teaching is the only need with a built-in *reproduction cycle*: instructor → ~30 students/semester → a fraction of those students become researchers → a fraction of those become instructors. The platform passes itself on through generations of users without further effort by the maintainer.
- NetLogo's 25-year longevity came overwhelmingly from this cycle (Wilensky-Rand 2015 textbook → courses → student projects → graduate adoption), not from researcher-to-researcher transmission.
- Research-community needs (#2, #3, #5) require active outreach for each new user; teaching needs work once at the textbook / instructor-materials level and then propagates.
- The 10-year commitment timescale removes the "5-year maturation period" objection that the first-pass ranking treated as a cost.

The current obstacle is *not* "more demos." adaptiveNet has 11 demos covering stat-mech / brain / pattern formation / adaptive-network axes — enough for a substantial course. The obstacle is that **instructor-facing materials are currently zero**.

### Three layers of teaching investment

The right architecture (per the NetLogo + Wilensky-Rand 2015 textbook precedent): **the tool stays light; heavy teaching material lives externally and references demo URLs**. NetLogo itself does not bundle "teacher scripts" or "student assignments" — its Models Library has lightweight "Things to notice / Things to try" hints, and problem sets come from the separate Wilensky-Rand textbook. adaptiveNet follows the same split, with one addition: a `teaching/` directory inside the repo that seeds external course material.

1. **Per-demo "Things to try" sections** (~5 minutes per demo). Each demo's `long` description ends with 2-4 short, open-ended prompts of the NetLogo style. Inviting, not assigning. Suitable for any visitor (researcher, hobbyist, student, science writer).
2. **Heavy problem sets in `teaching/problem-sets/MODEL.md`** (~half an hour per demo). Bilingual 5-prompt Δ-style experiments with literature comparisons, suitable for direct lift into a course assignment or instructor blog. Lives outside the demo description so the panel stays light. The author (or external instructors) can edit / extend / relocate this material to their own teaching site without touching the tool. See `teaching/README.md` for the architecture rationale.
3. **Cross-demo curated reading paths** (~1 week, in landing page). 3-4 paths threading multiple demos into a coherent week of class material. Examples: *"Phase transitions"* (Ising → Hopfield-Capacity → Avalanches), *"Network ≠ grid"* (Brusselator → Nakao → Adaptive-SIS), *"Memory & computation"* (Hopfield → Capacity → Modern Hopfield).
4. **Companion mapping to existing textbooks** (ongoing, optional). Notes in `teaching/problem-sets/*.md` mapping each problem set to chapters of Sayama 2015 / Newman *Networks* / Wilensky-Rand 2015. Reduces adoption friction by letting instructors keep their existing textbook and use adaptiveNet as the lab platform.

Earlier drafts of this section recommended embedding heavy 5-prompt Δ-experiments inside the demo descriptions. That was an over-engineering caught by the author 2026-05-04: the tool description is already long, embedding problem sets makes the panel a wall of text *and* pre-commits the platform to one specific assignment when an instructor may want a different one. The split above (light in tool, heavy in `teaching/`) is the corrected architecture.

### How the six communities relate to each other

The six communities are not in competition; they engage with the project in different ways and on different timescales.

- **Wide entry points** — #4 (ML interest, science writers): the largest number of people will first encounter adaptiveNet through a blog post or thread. They mostly do not return repeatedly, but they bring presence in the field.
- **Sustained-use community** — #1 (teaching): the longevity cycle. Each instructor adoption produces years of student exposure that compounds via the reproduction mechanism above.
- **Deep-collaboration communities** — #2 (brain criticality), #3 (adaptive-network theory), #5 (RG): smaller in number, longer in depth. These are the people who will cite adaptiveNet in published work and contribute back as collaborators.

Attending to any one in isolation under-serves the others. The right ordering is: **teaching investment now** (because it propagates through generations); **brain-criticality methodological knobs soon** (because the controversy is live and the demo is already half-built); **ensemble export** when adaptive-network theorists actually appear with concrete asks; **screenshot/embed friendliness** as low-cost polish for science writers; **RG only when a specific collaborator is in the conversation**.

### What this section commits to and what it does not

**Commits to:**
- Teaching investment as the primary mechanism for the project's long-term presence in the field
- Per-demo instructor notes (Layer 1) as the immediate next batch of work
- Brain-criticality demo upgrade — expose binning Δt, subsampling, and the Clauset-Shalizi-Newman 2009 KS-test comparison — as the next methodological build after Layer 1

**Does NOT commit to:**
- Building #5 (Network RG) without a real collaborator
- Sacrificing depth in #2 / #3 to chase wider visibility through #4
- Treating #0 (the author's own use of the platform) as solved — that question stays open and gets revisited periodically

---

## Other tools that overlap with parts of the niche

Verified by search 2026-05-03 (sources at end). For each: what it is, where it differs from adaptiveNet.

| Tool | Niche | Web? | Active? | Versus adaptiveNet |
|---|---|---|---|---|
| **Evoplex** | ABM on networks (general) | No, desktop | Stale (2018) | Closest match. Desktop + plugin-based + small community |
| **NetLogo + NW** | Spatial ABM with bolted-on networks | No, JVM desktop | Active | Spatial-first, NW has no built-in layout |
| **Mesa** | Python ABM, NetLogo-style | Optional Solara front-end | Active | Spatial-first; networks via NetworkX integration |
| **Repast Suite** | Java ABM, large-scale | No | Active | Spatial-first; HPC focus |
| **MASON** | Java ABM, fast | No | Active | Spatial-first |
| **AgentBase** | NetLogo clone in browser | Yes | Inactive (~2014) | Spatial-first, NetLogo-style |
| **SBDyNetVis** | Web tool for systems biology dynamic networks | Yes | Active | Domain-specific (sysbio); not general |
| **statnet (R)** + **EpiModel** | Statistical network models, ERGM | Some via RShiny | Active | Statistics-focused, not real-time interactive sim |
| **GraphStream** | Java library for dynamic graphs | No | Active | Library, not interactive tool |
| **Brian2 / NEST / NEURON** | Spiking neural networks | No | Active | Domain-specific (neuroscience) |
| **NetworkX / igraph** | Graph analysis libraries | No | Active | Static analysis, not dynamics |
| **PyTorch Geometric / DGL** | GNN machine learning | No | Active | ML training, not exploratory dynamics |
| **Cytoscape / Gephi** | Network visualization | Cytoscape has web | Active | Visualization-only, no dynamics |

---

## What this implies — narrowed honestly

### Where the gap is

The intersection of `(network-native + interactive + web + actively-developed + general-purpose)` is **near-empty**:

- **Evoplex** had the right positioning but is desktop and stale
- **AgentBase** is web but spatial/NetLogo-style
- **SBDyNetVis** is web but sysbio-specific
- Everyone else is either non-web, non-interactive, or domain-specialised

So adaptiveNet's actual distinguishing combination is **5 things at once**, each of which has overlap with one or two existing tools. Whether being the only tool to combine all 5 matters depends on whether researchers actually want all 5 — which I have not verified.

### Where my earlier framing was wrong

- "**25-year gap, no one tried**" — wrong. Evoplex was published 2019, peer-reviewed, with a real-codebase. People did try.
- "**No tool exists**" — wrong. Multiple exist with partial coverage.
- "**Researchers all roll their own**" — partly true (the Holme-Newman-style work seems to use custom code), but I can't say this confidently across the whole niche.

### Where the picture is honestly favourable

- Evoplex's apparent inactivity (last release 2018, 145 stars) **is a real signal**: either the audience is too small to sustain the tool, or the tool's specific design didn't grab the audience. **Both possibilities matter for adaptiveNet.**
  - If audience too small → adaptiveNet should expect similar fate, regardless of execution
  - If Evoplex's execution failed (desktop, C++ plugin model, no easy share) → adaptiveNet's web + URL-share + minimal-install pitch could matter
- AgentBase shows web ABM is feasible but didn't move the needle on adaptive-networks specifically (it didn't aim at that niche).

### What adaptiveNet plausibly does that no current tool does

- **General-purpose** (not domain-locked to bio or epi or neuro)
- **Web-shareable URLs** for any model + parameter set + seed
- **Built-in graph layout** that runs visibly to convergence (NetLogo NW has none)
- **Multiple distinct update regimes** (sync continuous, async per-cell, event-per-edge, drive-cascade) in one substrate
- **Zero install** (vs Evoplex's "download and install" / NetLogo's JVM)

These are real differences. Whether they make a difference is a separate question.

---

## What I should now NOT claim

- "Network science niche has no tool" — false; Evoplex exists
- "Researchers have nothing to use" — false; statnet/EpiModel/Mesa/etc. cover much ground
- "Filling a 25-year gap" — false; tool authors recognised this niche by at least 2018-2019
- "Thousands of users waiting" — unverified; could be true, could be 10. I have no measurement.

## What I can defensibly claim

- Evoplex is the closest comparable; it's desktop-only and inactive; this is a real opening
- adaptiveNet's specific feature combination (web + network-native + general + multiple update regimes + URL share) is **not duplicated** by any tool I found in this round of search
- Whether that combination matters to enough people to justify continued work is **the question that should drive next moves** — and answering it requires talking to actual researchers, not more code

---

## Recommended next move (research, not engineering)

Two specific actions, each ~1 hour:

1. **Read the Evoplex paper** ([Cardinot et al. 2019 SoftwareX](https://www.sciencedirect.com/science/article/pii/S2352711018302437)). Understand what they pitched, what they shipped, what didn't catch on. Their failure mode is likely informative for adaptiveNet's strategy. Specifically: did they try to attract users? What community did they aim at? Why might it not have worked?

2. **Find the Holme-Newman 2006 paper's code repository** (or any modern adaptive-network paper, e.g. [Gross & Blasius 2008 review](https://royalsocietypublishing.org/doi/10.1098/rsif.2007.1229)). What tool did the authors use? If it's custom Python/MATLAB scripts, that confirms the "researchers roll their own" intuition. If they used Mesa or NetLogo, that contradicts it.

These two pieces of information will materially shift the project's positioning either way. Both can be done from a reading chair, no coding.

---

## Sources

All verified by fetch on 2026-05-03:

- [Evoplex official site](https://evoplex.org/)
- [Evoplex on GitHub](https://github.com/evoplex/evoplex)
- [Evoplex paper, SoftwareX 2019](https://www.sciencedirect.com/science/article/pii/S2352711018302437)
- [Comparison of agent-based modeling software (Wikipedia)](https://en.wikipedia.org/wiki/Comparison_of_agent-based_modeling_software)
- [CoMSES Computational Modeling Frameworks](https://www.comses.net/resources/modeling-frameworks/)
- [statnet / EpiModel](https://statnet.org/nme/)
- [Awesome Network Analysis (briatte)](https://github.com/briatte/awesome-network-analysis)
- [AgentBase](https://agentbase.org/)
- [SBDyNetVis paper (ScienceDirect 2025)](https://www.sciencedirect.com/science/article/abs/pii/S0303264725002540)
- [NetLogo NW Extension docs](https://docs.netlogo.org/nw.html)
- [NetLogo version history](https://docs.netlogo.org/versions.html)
