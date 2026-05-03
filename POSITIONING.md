# Positioning — verified facts and honest landscape (v2)

This document records what I have **actually verified** about adaptiveNet's relationship to existing tools, after deliberate research on 2026-05-03. An earlier draft contained unverified market claims ("25-year gap", invented user counts); those were removed. The first rewrite (also 2026-05-03 morning) was still incomplete because it was based on memory rather than search. This version is post-search.

---

## The closest competitor I had not heard of: Evoplex

The most important finding from this round: **Evoplex** (Cardinot et al., *SoftwareX* 2019) is a published, peer-reviewed platform with the same core positioning as adaptiveNet:

> "Evoplex is a fast, robust and extensible platform for developing agent-based models and multi-agent systems on networks. Each agent is represented as a node and interacts with its neighbors, as defined by the network structure."

Verified facts (sources cited below):
- Built in **C++/Qt as a desktop app** (Linux/Windows/macOS), not web
- Provides "interactive graph and grid views" + parameter sweeping + parallel execution
- Models = plugin-extensible C++ modules
- **Last release: v0.2.1, October 2018** — appears inactive for ~7 years
- 145 stars on GitHub, 1003 commits, modest community
- Has an academic publication ([Cardinot et al. 2019, SoftwareX](https://www.sciencedirect.com/science/article/pii/S2352711018302437))

This is essentially the platform I thought adaptiveNet was filling a gap for. **It already exists.** It's not actively maintained, it's desktop-only, and the community is small — but the niche is not empty.

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
