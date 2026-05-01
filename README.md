# adaptiveNet

A general-purpose tool for defining and exploring **node–edge dynamical systems** — systems where N entities have state, the pairwise weights between them also have state, and both coevolve under user-defined rules. Browser-runnable, GPU-native substrate, NetLogo-style separation between fixed substrate and user-editable rules.

**See [`SPEC.md`](SPEC.md) for the full problem definition.** The repository is currently in the problem-definition phase; architecture and tech choices are deliberately not yet committed.

## Current state

Single-file HTML demo of network Turing patterns (Nakao & Mikhailov 2010) lives at [`nakao.html`](nakao.html). It is a *concrete instance* of what the tool will eventually express as one entry in a library — useful as a sanity-check for the substrate, not as the product.

## Run

The project is a small TypeScript + Vite static site.

```sh
# install deps once (Bun, npm, yarn, or pnpm all work)
bun install

# dev server with hot reload
bun run dev
# open http://localhost:8000/

# type-check only
bun run typecheck

# production build → dist/
bun run build

# serve the built site
bun run preview
```

If you don't have Bun installed, the same scripts work with `npm run` /
`pnpm run` / `yarn` once Node and the deps are installed.

## License

MIT
