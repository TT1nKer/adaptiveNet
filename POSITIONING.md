# Positioning — verified facts only

This document records what is **actually verified** about adaptiveNet's relationship to existing tools. An earlier draft contained unverified market claims (a "25-year gap", invented user-count numbers, sweeping "no one has filled this niche" framing). Those were removed on 2026-05-03 because they were extrapolated from a single verified fact (NetLogo's NW limitations) without supporting research.

What remains here is the small, defensible kernel. The rest is open questions to be researched, not claims to assert.

---

## What I have verified

### About NetLogo (sources cited)

- NetLogo 1.0 released April 2002, descended from StarLogo (1990s).
- NetLogo's `link` primitive (turtle-to-turtle connections) was added at some point during NetLogo's history; I haven't pinned down which version exactly.
- The **NW network-analysis extension** was first **bundled with NetLogo in 6.1.0 (May 2019)**. Prior to that it was a separate downloadable plugin.
- The NW extension supports: ER, BA, WS, Kleinberg, lattice, ring, star, wheel generators; centrality (betweenness, eigenvector, PageRank, closeness); Louvain community detection; clustering, modularity; shortest paths.
- The NW extension has **no built-in graph layout** — users place nodes manually with `fd` / `setxy`.

Sources, fetched 2026-05-03:
- [docs.netlogo.org/nw.html](https://docs.netlogo.org/nw.html)
- [docs.netlogo.org/versions.html](https://docs.netlogo.org/versions.html)
- [github.com/NetLogo/NW-Extension/releases](https://github.com/NetLogo/NW-Extension/releases)

### About this project (verified by inspecting own code)

- Built-in force-directed graph layout with visible convergence.
- Web-shareable URLs encoding model + parameters + seed.
- Multi-dimensional state per node (`d > 1`).
- Multiple update regimes hard-coded across demos (sync, async per-cell, event-per-edge, drive-and-cascade).
- 10 demos run in browser, zero install.

---

## What I claimed previously that I should NOT have

The earlier draft asserted:
- "25-year gap since network science boomed without producing a NetLogo-equivalent for graphs"
- A specific tool comparison table I built from memory, with confident "yes/no" cells I didn't verify
- "~2000–5000 researchers" as the potential audience
- "the intersection of (network-native + dynamics + good viz + interactive web) is empty except for this project"

None of these were researched. They were extrapolated from one true fact (NetLogo NW lacks built-in layout) into a much bigger story. I removed them because they're a recent recurrence of the same failure mode that broke earlier work in this project — verifying small things and using them as scaffolding for unverified narratives.

---

## What needs to be researched before re-asserting any positioning

1. **What tools actually exist for "network dynamics simulation"?** Systematic search beyond what I remember off-hand. Likely-missed candidates: GraphStream, Pajek/Pajek-XXL, statnet (R), EpiModel, SocNetV, Wolfram graph utilities, MATLAB Graph and Network Algorithms toolbox, R packages like `igraphdata`, GUESS, niche academic tools.
2. **What do active researchers in adaptive networks / complex networks actually use** when running their simulations? This is answered by reading recent papers in the area (2022–2025) and looking at what they cite for "simulation environment".
3. **Are there review or comparison papers** of network simulation tools? If yes, where does the gap they identify (if any) actually sit?
4. **Is there a real demand signal** — tool downloads, github stars on related projects, mailing list traffic, conference workshop themes — for "interactive web-based network dynamics tool"?

Without these, "this project fills a gap" is marketing language, not analysis.

---

## What this means for the project today

Modest, defensible:

- adaptiveNet is a working interactive tool. The 10 demos are useful as pedagogical artefacts in their own right.
- It addresses **specific** documented limitations of NetLogo's network support (notably the no-layout limitation).
- Whether this matters to anyone outside the author depends on facts I haven't checked yet.

Architectural decisions for v2 should not be driven by an unverified market story. They should either be driven by (a) the author's own use cases or (b) at least one real outside user with a real problem. Build for one verified user; generalise from that.
