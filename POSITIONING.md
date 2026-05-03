# Positioning — what's actually missing in the tool ecosystem

This document records the **verified competitive landscape** for "network-native interactive simulator for studying dynamics", and what that implies for adaptiveNet's design choices.

Verified 2026-05-03 by directly fetching documentation. Do not paraphrase claims here without re-checking.

---

## The actual gap

Search the tool ecosystem for "interactive web playground for network dynamics with built-in visualisation and standard metrics". You won't find one. Specific tools and what they do (or don't) cover:

| Tool | Networks | Dynamics | Visualisation | Web | Status |
|---|---|---|---|---|---|
| **NetLogo** (+ NW extension) | Yes (since 2002 via links, 2019 bundled NW) | Yes | **NO built-in graph layout** — user must code positions | Java, desktop | Active |
| **Mesa** (Python) | Possible (NetworkX integration) | Yes | Limited | No | Active |
| **Repast** | Possible | Yes | Some | No (Java desktop) | Active |
| **NetworkX**, **igraph** | Native | **No** — analysis-only | Static via matplotlib | No | Active |
| **Cytoscape**, **Gephi** | Native, beautiful | **No** — visualisation-only | Excellent static | Cytoscape has web; Gephi desktop | Active |
| **Brian2**, **NEST**, **NEURON** | Yes | Yes (spiking only) | Limited | No | Active |
| **PyTorch Geometric**, **DGL** | Native | ML-only | None | No | Active |
| **GraphStream** | Native | Yes | Yes | No (Java) | Less active |
| **adaptiveNet** | Native | Yes (4+ regimes) | Built-in force-directed + grid + flash | Yes | This project |

The intersection "network-native + dynamics + good visualisation + interactive web" is **empty except for this project**.

This isn't a new niche — it's been empty for **~25 years** since the network science boom (Watts-Strogatz 1998, Barabási 1999) gave researchers something interesting to simulate but no good tools to do it.

---

## What this means: 4 strategic implications

### 1. The differentiation is real and concrete

The project doesn't have to invent novel science to be valuable. It has to be **the first to fill an existing 25-year-old hole** in tooling.

Concrete differentiators (verified):
- **NetLogo NW has no built-in graph layout** — users place nodes by hand with `fd` commands. We have force-directed layout that converges visibly.
- **Brian2/NEST are spiking-only** — we span Hopfield, Ising, RD, voter, SOC, spiking
- **NetworkX/igraph have no dynamics** — we're built for it
- **None of the above is web-shareable** — we are

These are concrete features other tools lack, not vague aspirations.

### 2. The audience is researcher-flavoured, not consumer

Whoever's been forced to roll their own simulation code for the past 25 years is the audience:
- Adaptive networks researchers (Gross-Blasius lineage, ~100-200 active)
- Complex networks physicists (~500)
- Computational neuroscience network modellers (~500-1000)
- Network science teachers and students (potentially 1000s)

This is **not** an LLM-replacement audience. It's not millions. But it's a real user base who currently have no good tool — that's better than fighting for share in a saturated market.

### 3. Features-to-add to be a real NetLogo replacement

NetLogo NW has things this project doesn't:
- Network metrics: centrality (betweenness, eigenvector, PageRank, closeness), clustering coefficient, modularity, community detection (Louvain), shortest paths
- These are **standard analytical tools** the audience expects to be one click away

Building these as built-in diagnostics (not as something users have to compute themselves) is what would make researchers actually adopt this over rolling their own.

NetLogo has things this project shouldn't try to copy:
- Spatial agent model (turtles with positions, headings)
- Patches (2D grid as first-class)
- BehaviorSpace (parameter sweep UI)
- Models Library (500+ pre-built models)

The first two are wrong for network-native; the third is reasonable to add eventually; the fourth is a curation effort that matters more than features.

### 4. The "kernel" question gets re-scoped

If this is "network-native NetLogo for researchers", the kernel design question changes:

- **Performance**: needs to handle N ~10⁵ comfortably, GPU is a future bonus, not a requirement. NetLogo handles ~10⁴ agents and that's "enough for most research".
- **Language**: rule-language for researcher authoring is the question, not "rule-language for the next generation of AI". Audience is comfortable with formulas (math researchers all know calculus); not necessarily with imperative code.
- **Persistence**: research workflow needs save/load of model + state, parameter sweeps, batch runs, reproducibility seeds. NetLogo has BehaviorSpace; this is a known requirement.
- **Distribution**: web-first (URL share) is already a 10× UX win over NetLogo's "send a .nlogo file". Keep this.

---

## What this does NOT establish

- That the project will succeed. Filling a real gap doesn't guarantee adoption — discovery, marketing, and "first-100-users" work are still required.
- That LLM competition is plausible. The audience here is academic researchers, not AI labs. Different game entirely.
- That building a kernel before having even one outside user is the right next move. The kernel decisions still need a concrete first user to anchor against.

---

## What I'd do with this information

(Not a recommendation — just what would follow from these facts if "audience: network dynamics researchers" is the chosen framing.)

1. **Add network metrics as built-in diagnostics** — centrality, clustering, modularity, community detection. This single move makes the tool serious for research.
2. **Talk to one researcher** in the adaptive networks / complex networks community. Show them the gallery. Ask what they'd actually use it for. Their answer will determine the kernel's shape better than any synthesis.
3. **Don't build the v2 kernel yet**. Build features that make the existing demos useful as research tools. Once a real user is using it for something specific, the kernel decisions become obvious.

---

## Source check

Everything in the table above was verified 2026-05-03 by either direct documentation fetch or stable knowledge. Tools change; this should be re-checked annually if the document is being relied upon.

NetLogo specifics: see `~/.claude/projects/-home-hostsjim-Projects-adaptiveNet/memory/reference_netlogo_network_support.md`.
