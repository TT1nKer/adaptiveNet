# adaptiveNet

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20018115.svg)](https://doi.org/10.5281/zenodo.20018115)

An interactive playground for **node–edge dynamical systems** — networks where node states and connection strengths coevolve under simple rules. Spiking neurons, Hopfield memory, Ising spins, reaction–diffusion, voter dynamics, self-organised criticality, adaptive epidemics: eleven different specific systems, all instances of one abstract shape.

The shape — *units + co-evolving connections* — is what neuromorphic computing, classical statistical mechanics, and several theories of biological cognition all share. Whether intelligence requires neurons specifically, or a more general structure, is an open question. This is a place to play with candidates.

11 demos, browser, zero install. Drag sliders, hit play, share by URL. **中文版：[index.zh.html](https://tt1nker.github.io/adaptiveNet/index.zh.html)**.

**Live at https://tt1nker.github.io/adaptiveNet/** — open it, click any demo, drag the sliders.

## Cite

If you use adaptiveNet in published work, please cite via the DOI above (or use the [`CITATION.cff`](CITATION.cff) metadata, which GitHub renders into a "Cite this repository" widget on the sidebar).

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

## References

Each demo wraps published work. Use these to follow up if a regime catches your eye — the demo is for getting the intuition fast, the papers and catalogues below are where the precise claims live.

**Network Turing** — Nakao & Mikhailov, *Turing patterns in network-organized activator–inhibitor systems*, *Nature Physics* **6**, 544 (2010), [doi:10.1038/nphys1651](https://doi.org/10.1038/nphys1651).

**Adaptive Voter** — Holme & Newman, *Nonequilibrium phase transition in the coevolution of networks and opinions*, *Phys. Rev. E* **74**, 056108 (2006), [doi:10.1103/PhysRevE.74.056108](https://doi.org/10.1103/PhysRevE.74.056108).

**Gray–Scott** —
- Pearson, *Complex Patterns in a Simple System*, *Science* **261**, 189 (1993), [doi:10.1126/science.261.5118.189](https://doi.org/10.1126/science.261.5118.189) — the canonical (F, k) phase diagram.
- Robert Munafo, [Pearson's Classification (Extended)](https://mrob.com/pub/comp/xmorphia/pearson-classes.html) — Greek-letter-named regions of the (F, k) plane, with descriptions and animated images. Each Gray-Scott preset corresponds to a named region:
  - `mitosis` → near λ region, [#lam](https://mrob.com/pub/comp/xmorphia/pearson-classes.html#lam)
  - `worms` → near δ/η transition, [#del](https://mrob.com/pub/comp/xmorphia/pearson-classes.html#del)
  - `maze` → κ region, [#kap](https://mrob.com/pub/comp/xmorphia/pearson-classes.html#kap)
  - `xi-bz-spirals` → ξ region, [#xi](https://mrob.com/pub/comp/xmorphia/pearson-classes.html#xi)
  - `beta-wavefield` → β region, [#bet](https://mrob.com/pub/comp/xmorphia/pearson-classes.html#bet)
  - `alpha-wavelet-chaos` → α region, [#alp](https://mrob.com/pub/comp/xmorphia/pearson-classes.html#alp)
  - `u-skate` → π region: [Munafo's U-skate world](https://mrob.com/pub/comp/xmorphia/uskate-world.html)
- The "never-settles" presets (ξ, β, α) realise behaviours that belong to the wider **excitable-media literature** — the same dynamics show up in BZ chemistry, cardiac arrhythmia, and Dictyostelium signalling. Foundational entry points: Winfree, *Spiral Waves of Chemical Activity*, *Science* **175**, 634 (1972); Tyson & Keener, *Singular perturbation theory of traveling waves in excitable media*, *Physica D* **32**, 327 (1988).

**Classical Turing (Brusselator)** — Turing, *The Chemical Basis of Morphogenesis*, *Phil. Trans. R. Soc. B* **237**, 37 (1952), [doi:10.1098/rstb.1952.0012](https://doi.org/10.1098/rstb.1952.0012). Brusselator kinetics: Prigogine & Lefever (1968).

**Hopfield** —
- Hopfield, *Neural networks and physical systems with emergent collective computational abilities*, *PNAS* **79**, 2554 (1982), [doi:10.1073/pnas.79.8.2554](https://doi.org/10.1073/pnas.79.8.2554).
- Capacity calculation: Amit, Gutfreund & Sompolinsky (1985–87), three papers in *Phys. Rev. A* and *Ann. Phys.* using the spin-glass replica method to derive the α<sub>c</sub> ≈ 0.138 critical capacity.
- Modern attention connection: Ramsauer et al., [*Hopfield Networks is All You Need*](https://arxiv.org/abs/2008.02217), arXiv:2008.02217 (2020).

**Ising** — Lenz (1920), Ising (1925); Onsager, *Crystal statistics. I. A two-dimensional model with an order-disorder transition*, *Phys. Rev.* **65**, 117 (1944), [doi:10.1103/PhysRev.65.117](https://doi.org/10.1103/PhysRev.65.117) — exact 2D solution and the T<sub>c</sub> = 2/ln(1+√2) result.

**Spiking Neurons (LIF)** — Lapicque (1907); the model predates Hodgkin–Huxley by 45 years and is still the standard "neuron" used in modern neuromorphic chips. Modern textbook treatment: Gerstner, Kistler, Naud & Paninski, *Neuronal Dynamics*, Cambridge (2014), [free online](https://neuronaldynamics.epfl.ch/online/index.html).

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
