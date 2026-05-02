# adaptiveNet

A small interactive playground for **node–edge dynamical systems** — networks where node states and pairwise weights coevolve under simple rules. Reaction-diffusion, spin glasses, spiking neurons, adaptive networks. Browser-runnable, no install.

**Live at https://tt1nker.github.io/adaptiveNet/** — open it, click any demo, drag the sliders.

---

## What this is for

These demos don't show new physics. Most of what's here was worked out decades ago: Pearson 1993 used a Cray supercomputer to scan Gray-Scott parameter space and produce the famous phase diagram; Robert Munafo spent 19 years cataloguing the same map by hand; Hopfield 1982 won a Nobel Prize 42 years later for one page of math. None of it is original work.

What's different is the **interface**. Beautiful dynamics often live in narrow parameter regions, and finding them used to require either research-grade compute or specialist's intuition. For the rest of us the standard path was: read the paper, look at the figure, accept the caption. This site replaces "look at the figure" with "drag the slider and walk the parameter space yourself."

The unexpected effect: sometimes a casual visitor with a slider notices things the original researchers didn't dwell on. The Gray-Scott `drifting waves` preset and the Hopfield `spurious-mixed-state` preset were both stumbled into by exploration here, then matched against literature afterward — both are real, documented regimes, but neither has a particularly prominent description in the standard references because they're awkward to capture in a static figure. The interactive format catches them naturally.

Two things follow:

- **Most "finds" turn out to be already-published.** The literature is much wider than any single person knows. Don't treat hitting a beautiful regime as proof of original work. Treat it as a sign you've reached a live frontier — now is when reading papers is most useful, not before.

- **Some observations may still be worth writing down.** Not new physics, but new descriptions or presentations of regimes that existing work mentioned in passing. An afternoon spent dragging across a 30-year-old map can yield a vocabulary the original mapmakers never bothered with.

The tool is for: students who want to **feel** what excitable medium means, teachers who want a working demo, hobbyists who want to play, and occasionally someone who finds something worth chasing into the literature. It is not a replacement for papers. It is a doorway into them.

---

## Demos

| Demo | What it shows |
|---|---|
| **Network Turing** (Nakao & Mikhailov 2010) | Activator–inhibitor reaction on a random graph; D<sub>v</sub> ≫ D<sub>u</sub> creates spontaneous high/low clusters with hub-organising structure. |
| **Adaptive Voter** (Holme–Newman 2006) | Edges rewire when neighbours disagree; opinions copy when they don't. Phase transition between consensus and echo-chamber fragmentation at φ<sub>c</sub> ≈ 0.46. |
| **Gray–Scott** | Reaction–diffusion on a 2D lattice. Six presets cover the Pearson map: mitosis, worms, maze, excitable chaos, drifting waves, U-skate gliders. |
| **Classical Turing (Brusselator)** | The original 1952 Turing mechanism on a lattice — clean stripes/spots from D<sub>v</sub>/D<sub>u</sub> instability. |
| **Hopfield Retrieval** (Hopfield 1982) | Patterns encoded in dense Hebbian weights; noisy cue converges to the nearest stored memory. Includes a spurious-mixed-state preset. |
| **Ising Model** (Lenz–Ising 1925, Onsager 1944) | Spins on a lattice with thermal noise; Onsager critical point at T<sub>c</sub> ≈ 2.269. Drag T live across the phase transition. |
| **Spiking Neurons (LIF)** (Lapicque 1907) | Leaky integrate-and-fire neurons on a 2D grid. Drive a few cells, watch waves of synchronised spikes propagate. The substrate that runs on Loihi, SpiNNaker and other neuromorphic chips. |

See [`SPEC.md`](SPEC.md) for the substrate design — what every demo in the library has to conform to, and why it's structured that way.

---

## Run locally

```sh
# install deps once (Bun, npm, yarn, or pnpm all work)
bun install

# dev server with hot reload
bun run dev   # open http://localhost:8000/

# type-check
bun run typecheck

# production build → dist/
bun run build
```

If you don't have Bun installed, the same scripts work with `npm run` / `pnpm run` / `yarn` once Node and the deps are installed.

## License

MIT
