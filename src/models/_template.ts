// =============================================================================
// TEMPLATE — Adaptive Spread
// =============================================================================
//
// This file is the canonical *starting point* for adding your own model to
// adaptiveNet. It is intentionally simple, but it exercises every part of the
// Model interface so you can copy-paste this file and modify it incrementally.
//
// The dynamics implemented here ("Adaptive Spread"):
//   - each node has a binary state ∈ {0, 1} ("inactive" / "active")
//   - 5% of nodes start active
//   - each tick, a random edge is picked. if its endpoints disagree:
//     - with prob p_spread, the inactive endpoint activates
//     - with prob p_rewire, the active endpoint cuts the edge and reconnects
//       to a random other active node (homophily-style restructuring)
//
// Order parameter: fraction of active nodes.
//
// To create your own model:
//   1. Copy this file:  cp src/models/_template.ts src/models/myname.ts
//   2. Open it, change the `id`, `name`, and `name_zh` strings
//   3. Modify `params`, `init`, `step` to your dynamics
//   4. Update the `observe` block to declare your order parameter
//   5. Register the new model in src/player.ts MODEL_REGISTRY
//   6. Optionally add a card to index.html (and index.zh.html) for the gallery
//   7. Run `bun run dev` and open `http://localhost:8000/player.html?model=YOUR_ID`
//
// See CONTRIBUTING.md for the full walkthrough including style conventions,
// what makes a good demo, and how to write the "For instructors" prompts.
// =============================================================================

import { generators } from '../graph.ts';
import type { Model, ModelState, ParamValues } from '../types.ts';
import type { RNG } from '../rng.ts';

// Available initial topologies. The `generators` map exports er, ba, ws —
// you can use any subset, in any order. The first item becomes the default
// in the dropdown unless `default:` overrides.
const TOPO_OPTS = ['er', 'ba', 'ws'] as const;

const template: Model = {
  // Stable identifier — used as ?model=... in the URL. Avoid changing this
  // after the model has been shared, since it would break existing links.
  id: 'template-adaptive-spread',

  // Display name shown in the player header. Keep under ~50 chars.
  name: 'Template — Adaptive Spread',

  // Optional Chinese display name. Falls back to `name` when absent.
  name_zh: '范式模型 — 自适应传播',

  // One-line description for the gallery card (and for the `short` line at
  // the top of the player panel). Aim for ~100-180 characters.
  short: 'A minimal adaptive model: nodes activate when adjacent to active ones; active nodes prune dissenting connections. Provided as a starting template — copy this file and modify to build your own.',

  // Optional Chinese short. If absent, falls back to English.
  short_zh: '一个最简的自适应模型：节点在邻居活跃时被激活；活跃节点剪掉与不活跃节点的连接。作为起点模板提供——复制本文件并修改即可构建你自己的模型。',

  // Multi-paragraph description shown when the user expands the "about this
  // model" details on the player page. Markdown-light: blank lines separate
  // paragraphs, **bold** and *italic* are supported, no headings or lists.
  long: `A minimal adaptive-network model, intentionally derivative. Each node holds a binary state (inactive 0 / active 1). Each tick, a random edge is selected:

— if both endpoints share the same state, nothing happens.
— otherwise, with probability **p_spread** the inactive endpoint activates.
— or, with probability **p_rewire**, the active endpoint cuts the edge to the inactive neighbour and reconnects to some other random active node.

The two processes compete: spreading grows the active subgraph, rewiring isolates inactive holdouts. The fraction of active nodes is the order parameter. Try p_spread = 0.5 / p_rewire = 0 for pure contagion (everyone activates eventually); p_spread = 0 / p_rewire = 0.3 for pure structural sorting (network bipartitions but no spread).

This model is provided as a *template* — copy src/models/_template.ts to a new file under src/models/ and modify the dynamics to build your own adaptive network model. See [CONTRIBUTING.md](https://github.com/TT1nKer/adaptiveNet/blob/main/CONTRIBUTING.md) for the walkthrough.`,

  long_zh: `一个最简的自适应网络模型，特意做成派生品。每个节点持有二元状态 (不活跃 0 / 活跃 1)。每一步随机选一条边：

— 若两端点状态相同，不发生任何变化。
— 否则，以概率 **p_spread** 激活不活跃的一端。
— 或，以概率 **p_rewire**，活跃的一端切断与不活跃邻居的连接，重新连到某个随机的另一个活跃节点。

两个过程竞争：传播扩大活跃子图，重连孤立掉不活跃的剩余者。活跃节点比例是序参量。试 p_spread = 0.5 / p_rewire = 0 看纯传染 (最终所有节点都被激活)；p_spread = 0 / p_rewire = 0.3 看纯结构分选 (网络二分，但没有传播)。

这个模型作为*模板*提供——复制 src/models/_template.ts 到 src/models/ 下的新文件，修改动力学即可构建你自己的自适应网络模型。完整教程见 [CONTRIBUTING.md](https://github.com/TT1nKer/adaptiveNet/blob/main/CONTRIBUTING.md)。`,

  // Parameter schema. Each entry becomes a slider (numeric) or dropdown
  // (categorical with `options`). `live: true` means changing it does not
  // require a graph rebuild — applies on the next step.
  params: {
    p_spread: { label: 'p_spread (activation prob)', min: 0,   max: 1,    step: 0.01, default: 0.30, live: true },
    p_rewire: { label: 'p_rewire (rewire prob)',     min: 0,   max: 1,    step: 0.01, default: 0.10, live: true },
    init_active: { label: 'initial active fraction', min: 0.01, max: 0.5, step: 0.01, default: 0.05, live: false },
    N:        { label: 'nodes',                      min: 50,  max: 1000, step: 10,   default: 200, live: false },
    k:        { label: 'avg degree',                 min: 2,   max: 14,   step: 1,    default: 6,   live: false },
    topo:     { label: 'topology (init)',            options: TOPO_OPTS, default: 'er',              live: false },
    speed:    { label: 'speed',                      min: 0.1, max: 5,    step: 0.1,  default: 1.0, live: true },
  },

  // Optional named parameter scenarios. Selecting a preset overrides the
  // params it specifies; unspecified params keep their current values.
  presets: [
    { id: 'pure-spread',  name: 'pure spread (no rewire)', short: 'p_rewire = 0: everyone activates eventually.', params: { p_spread: 0.5, p_rewire: 0.0 } },
    { id: 'pure-rewire',  name: 'pure rewire (no spread)', short: 'p_spread = 0: network bipartitions; activation level frozen.', params: { p_spread: 0.0, p_rewire: 0.30 } },
    { id: 'balanced',     name: 'balanced',                short: 'Both knobs on. Spreading and isolation compete.', params: { p_spread: 0.30, p_rewire: 0.15 } },
  ],

  // Build the initial state from params. Receives a seeded RNG; never use
  // Math.random() — it would break reproducibility from URL permalinks.
  init(params: ParamValues, rng: RNG): ModelState {
    const N = Math.round(params.N as number);
    const k = Math.round(params.k as number);
    const topo = params.topo as string;
    const initActive = params.init_active as number;
    const generator = generators[topo];
    if (!generator) throw new Error(`unknown topology: ${topo}`);
    const graph = generator(N, k, rng);

    // Node state: 0 = inactive, 1 = active. Float64Array for compatibility
    // with the X buffer convention even though we only use 0/1 here.
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < initActive ? 1 : 0;

    return { N, d: 1, X, graph, t: 0, step_count: 0 };
  },

  // Advance the simulation by one frame. Mutate `state` in place. Use the
  // provided `rng`, not Math.random(). Tick volume here scales with edge
  // count and a `speed` multiplier so the visual pace stays similar
  // regardless of N.
  step(state: ModelState, params: ParamValues, rng: RNG): void {
    const p_spread = params.p_spread as number;
    const p_rewire = params.p_rewire as number;
    const speed = params.speed as number;
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;

    // Roughly 5% of edges per frame at speed = 1 — visible motion without
    // overwhelming the eye.
    const ticks = Math.max(1, Math.floor(edges.length * 0.05 * speed));

    for (let t = 0; t < ticks; t++) {
      if (edges.length === 0) return;

      // Pick a random edge.
      const eIdx = rng.int(edges.length);
      const [i, j] = edges[eIdx]!;
      const xi = X[i]!;
      const xj = X[j]!;
      if (xi === xj) continue;

      // Identify which endpoint is active and which is inactive.
      const activeNode = xi === 1 ? i : j;
      const inactiveNode = xi === 1 ? j : i;

      if (rng.next() < p_rewire) {
        // ----- rewire: active node detaches from inactive, attaches to
        //               random other active node -----
        adj[activeNode] = adj[activeNode]!.filter((x) => x !== inactiveNode);
        adj[inactiveNode] = adj[inactiveNode]!.filter((x) => x !== activeNode);
        deg[activeNode]!--;
        deg[inactiveNode]!--;
        // Swap-pop removal of the edge from the edges array (O(1)).
        const last = edges[edges.length - 1]!;
        edges[eIdx] = last;
        edges.pop();

        // Find a candidate active node not already connected. Bounded
        // attempts so we don't loop forever if active nodes are saturated.
        let kk = -1;
        for (let attempts = 0; attempts < 30; attempts++) {
          const cand = rng.int(N);
          if (cand === activeNode) continue;
          if (X[cand] !== 1) continue;
          if (adj[activeNode]!.includes(cand)) continue;
          kk = cand;
          break;
        }
        if (kk >= 0) {
          adj[activeNode]!.push(kk);
          adj[kk]!.push(activeNode);
          deg[activeNode]!++;
          deg[kk]!++;
          edges.push(activeNode < kk ? [activeNode, kk] : [kk, activeNode]);
        }
      } else if (rng.next() < p_spread) {
        // ----- spread: inactive becomes active -----
        X[inactiveNode] = 1;
      }
      state.step_count++;
    }
    state.t = state.step_count;
  },

  // How nodes look on the canvas. `nodeColor` returns a CSS colour string
  // per node; `nodeSize` returns a radius in pixels. `edgeAlpha` is a
  // single constant for now (may become per-edge in a future version).
  render: {
    nodeColor(state: ModelState, i: number): string {
      return state.X[i] === 1 ? '#e63946' : '#2c5fbf';
    },
    nodeSize(state: ModelState, i: number): number {
      return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
    },
    edgeAlpha: 0.18,
  },

  // Diagnostic charts. `histogram` plots a value distribution; `timeSeries`
  // plots a single scalar over time (the canonical order parameter). Both
  // are optional. See other models (hopfield-capacity, adaptive-sis) for
  // examples of `timeSeries2` (a second overlaid series).
  observe: {
    timeSeries: {
      label: 'fraction active',
      value(state: ModelState): number {
        let count = 0;
        for (let i = 0; i < state.N; i++) if (state.X[i] === 1) count++;
        return count / state.N;
      },
    },
  },
};

export default template;
