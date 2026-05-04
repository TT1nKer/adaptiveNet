# Contributing to adaptiveNet

Thanks for considering a contribution. The most common contribution shape is **adding a new model**, and this guide walks through it. For other kinds of changes (UI, docs, infrastructure) — open an issue first so we can talk through scope.

> **Using Claude Code (or another agentic LLM)?** This repo ships a [skill at `.claude/skills/adaptivenet-author/SKILL.md`](.claude/skills/adaptivenet-author/SKILL.md) that walks you (and your agent) through the design questions, then writes the model files in the right places. If you have Claude Code, just clone the repo, open it, and say "I want to design a model of [your dynamics]" — the skill activates automatically. The walkthrough below is the manual equivalent.

## Adding a new model — step by step

The codebase ships a fully-commented template at [`src/models/_template.ts`](src/models/_template.ts). This file is the recommended starting point.

### 1. Copy the template

```sh
cp src/models/_template.ts src/models/myname.ts
```

Pick `myname` to be a short, lowercase, hyphen-separated identifier — e.g. `kuramoto`, `bak-sneppen`, `coevolving-cooperation`.

### 2. Edit the metadata at the top

Open the new file and change:

- `id`: a stable URL identifier for `?model=...`. Once shared, do not rename.
- `name`: human-readable English name shown in the gallery card and player header.
- `name_zh`: optional Chinese name. Omit if you don't have one — it falls back to English.
- `short`, `short_zh`: one-line description for the gallery card (~100-180 chars).
- `long`, `long_zh`: multi-paragraph description rendered on the player page (markdown-light: blank line = paragraph, `**bold**`, `*italic*`).

### 3. Define the parameters

The `params` block is a JS object whose keys are slider / dropdown identifiers and whose values are spec objects. Two kinds:

```ts
// Numeric (slider)
my_param: {
  label: 'human-readable label',
  min: 0, max: 1, step: 0.01,
  default: 0.5,
  live: true,    // applies on next step without rebuilding the graph
}

// Categorical (dropdown)
my_choice: {
  label: 'human-readable label',
  options: ['option-a', 'option-b'] as const,
  default: 'option-a',
  live: false,   // requires reset to apply
}
```

Common parameters to keep:
- `N` — number of nodes
- `k` — average degree
- `topo` — initial topology (use `TOPO_OPTS = ['er', 'ba', 'ws']`)
- `speed` — visual pacing multiplier

### 4. Implement `init` and `step`

`init(params, rng)` builds the initial state from parameters. Use the `rng` argument — never `Math.random()`, since URL permalinks rely on deterministic seeds.

`step(state, params, rng)` advances the simulation by one frame. Mutate `state` in place. The recommended pattern for tick volume:

```ts
const ticks = Math.max(1, Math.floor(edges.length * 0.05 * speed));
for (let t = 0; t < ticks; t++) { ... }
```

This keeps the visual pace roughly consistent across different N.

### 5. Render

`render.nodeColor(state, i)` returns a CSS colour string per node.
`render.nodeSize(state, i)` returns a pixel radius. The convention `4 + sqrt(deg) * 1.4` makes hub nodes visually larger.
`render.edgeAlpha` is a constant transparency for edge lines.

For grid-based demos (Ising-style), set `view: 'grid'` on the model and provide `cols` and `rows` in the state. Cells render as filled squares with no edges.

### 6. Declare an observable

`observe.timeSeries` is the canonical order-parameter trace. Return a single scalar from `state` per frame. The framework also supports `observe.timeSeries2` (a second overlaid series in yellow) and `observe.histogram` (a value distribution). See the existing demos for examples — `hopfield-capacity.ts` uses `timeSeries2`, `adaptive-sis.ts` uses both `timeSeries` and `timeSeries2` together.

### 7. Register the model

Open [`src/player.ts`](src/player.ts), find the `MODEL_REGISTRY` near the top, and add a line:

```ts
'myname': () => import('./models/myname.ts'),
```

This makes `?model=myname` resolve to your new file.

### 8. (Optional) Add a gallery card

If your model is ready for general consumption, add a card to `index.html` (English landing) and `index.zh.html` (Chinese mirror). Pick the right section (Brain-inspired computation / Pattern formation / Adaptive networks) and follow the existing card structure. If your model doesn't fit any of the three sections, propose a new section in your PR.

### 9. Run and verify

```sh
bun run dev
# open http://localhost:8000/player.html?model=myname
```

Drag sliders, hit play, see if the dynamics are visible and reasonable. Check that `bun run typecheck` and `bun run build` both pass.

## Style conventions

### Code

- TypeScript with strict mode (already configured)
- No external runtime dependencies. The codebase is intentionally library-free; HTML + CSS + plain TS only
- Use `Float64Array` for node state buffers (state.X)
- Cache work buffers across frames (look at how the lattice demos avoid GC pressure)

### Documentation

- The `long` field should explain *what* the model does (1-2 paragraphs), name the *order parameter*, and link to the canonical reference paper.
- Add a "**Things to try**" section at the end of `long` — 2-4 short, open-ended prompts of the NetLogo style: *"try parameter X at value Y, watch what happens"*. Keep these light and inviting; they should fit on screen without scrolling. See any existing demo for the format.
- Translate `long_zh` to match. If you can't translate, omit `long_zh` and the player will fall back to English with a small "translation pending" note.
- **Heavy problem-set material** — five Δ-style experiments with literature comparisons, suitable for course assignments — belongs in `teaching/problem-sets/MODEL.md`, not in the demo description. Embedding heavy material in the demo turns the panel into a wall of text and pre-commits the platform to one specific assignment when an instructor may want a different one. The `teaching/` directory is the seed of external course material and is meant to be lifted into instructor blogs / syllabi.

### Choosing what to model

The substrate is **node-edge dynamical systems where states and connections coevolve**. Models that fit cleanly:

- **Adaptive network dynamics** (best fit): edges change as a function of node states. Examples already in the gallery: voter, adaptive-sis, the Spread template.
- **Network dynamics on a fixed graph**: pattern formation, contagion, opinion dynamics. Fine, just don't oversell as "adaptive".
- **Lattice dynamics**: Ising-style. Fine, but use the `view: 'grid'` mode.

What does *not* fit well:

- Models that require continuous-time differential equations with stiff solvers (use a separate Python notebook for those — the in-browser substrate is for visual / interactive exploration, not high-precision numerics)
- Models requiring more than ~10⁵ nodes (the canvas renderer caps out around there)
- Models requiring opaque external libraries (we keep zero runtime deps)

## Citation

If your model contribution is published-research-grade, add a `CITATION.cff`-style author block to your model file's header comment so future readers can credit you. The model author is separate from the project author (TT1nKer); both should appear in academic citations.

## Reporting issues

Use [GitHub issues](https://github.com/TT1nKer/adaptiveNet/issues). For translation feedback, mention the specific file (e.g. `src/models/voter.ts long_zh`) so the issue is actionable.

## License

Contributions are licensed under MIT, matching the project. By submitting a PR you agree your code can be redistributed under MIT.
