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

Source: [Cardinot, Marcos, et al. "Evoplex: A platform for agent-based modeling on networks." *SoftwareX* 9 (2019): 199-204.](https://doi.org/10.1016/j.softx.2019.02.009) — read in full.

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
