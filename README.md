# adaptiveNet

A general-purpose tool for defining and exploring **node–edge dynamical systems** — systems where N entities have state, the pairwise weights between them also have state, and both coevolve under user-defined rules. Browser-runnable, GPU-native substrate, NetLogo-style separation between fixed substrate and user-editable rules.

**See [`SPEC.md`](SPEC.md) for the full problem definition.** The repository is currently in the problem-definition phase; architecture and tech choices are deliberately not yet committed.

## Current state

Single-file HTML demo of network Turing patterns (Nakao & Mikhailov 2010) lives at [`nakao.html`](nakao.html). It is a *concrete instance* of what the tool will eventually express as one entry in a library — useful as a sanity-check for the substrate, not as the product.

## Run

The site is a small static site of ES modules. Two ways to run it:

**On GitHub Pages (recommended for trying it):** open the published URL.

**Locally:** ES modules cannot be loaded over `file://`, so serve the directory:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

No build step, no `npm install`, no dependencies. Just static files.

## License

MIT
