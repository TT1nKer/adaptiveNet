# adaptiveNet

Interactive browser reproductions of landmark papers in network dynamics, adaptive networks, and pattern formation on graphs.

The plan: each landmark paper becomes a single-file HTML demo you can open, parameter-sweep, and share — no install, no build step. Start narrow, expand later.

## Demos

| File | Paper | What you see |
| --- | --- | --- |
| [`nakao.html`](nakao.html) | Nakao & Mikhailov, *Turing patterns in network-organized activator–inhibitor systems*, **Nature Physics 6**, 544–550 (2010). | Mimura–Murray activator–inhibitor reaction at each node, diffusion via the graph Laplacian. Live diagnostics: u-distribution histogram, σ(u) time series, Laplacian eigenvalue spectrum with the Turing-instability band overlaid (computed analytically from the linearized dispersion relation at the homogeneous fixed point). Named numerical presets reproduce subcritical, onset, strong, hub-organized (BA), and small-world (WS) regimes. |

## Why

The adaptive-networks / network-Turing literature ships MATLAB and Python scripts and static publication figures. There is no NetLogo-equivalent for graph-based pattern formation. This repo is a slow attempt at filling that tooling gap, one paper at a time.

## Run

Open the HTML file in a browser. That's it. No dependencies.

## Roadmap

- [x] Nakao & Mikhailov 2010 — Turing patterns on static networks
- [ ] Asllani et al. 2014 — Turing patterns on directed networks
- [ ] Holme–Newman 2006 — adaptive voter model
- [ ] Muolo et al. 2025 (arXiv 2509.10124) — Turing patterns on adaptive networks

## License

MIT
