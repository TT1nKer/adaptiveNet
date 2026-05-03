// v2 prototype — declarative composition API for node-edge dynamical systems.
//
// A model is built by calling `define({...})` with declarations of:
//   topology, state, step (= one of four scheduling regimes), render,
//   diagnostics, params, presets.
//
// `define` synthesises a substrate-conformant Model<S> object from the
// declarations — the runtime sees nothing different from a hand-written
// model file. The win is on the authoring side: every demo's boilerplate
// (graph construction, sub-step loops, async per-cell scheduling, drive +
// cascade resolution) is centralised in this file and the helpers in
// `lib.ts`, so a v2 demo file can express only what is **specific** to its
// model (kinetics, rules, init, parameters).
//
// This is a prototype. The final v2 API will likely tweak signatures,
// rename a few things, and possibly support nested or composite update
// regimes. The shape — declare-don't-implement — is intended to be stable.

import type {
  Model,
  ModelState,
  ParamSchema,
  ParamValues,
  Graph,
  RenderConfig,
  ObserveConfig,
  Preset,
} from '../types.ts';
import type { RNG } from '../rng.ts';
import { buildGrid, buildER, buildBA, buildWS, emptyGraphOf } from './lib.ts';

// ---------- Topology ----------

export type Topology =
  | { kind: 'random_graph'; generator: 'er' | 'ba' | 'ws'; N: number; k: number; beta?: number }
  | { kind: 'grid'; cols: number; rows: number; periodic: boolean }
  | { kind: 'empty'; N: number };

export const topology = {
  randomGraph(generator: 'er' | 'ba' | 'ws', opts: { N: number; k: number; beta?: number }): Topology {
    return { kind: 'random_graph', generator, N: opts.N, k: opts.k, beta: opts.beta };
  },
  grid(cols: number, rows: number, opts: { periodic?: boolean } = {}): Topology {
    return { kind: 'grid', cols, rows, periodic: opts.periodic ?? true };
  },
  empty(N: number): Topology {
    return { kind: 'empty', N };
  },
};

// Topology can also be a function of params (so user can wire size/k sliders to it).
export type TopologySpec = Topology | ((params: ParamValues) => Topology);

function buildTopology(spec: Topology, rng: RNG): Graph {
  switch (spec.kind) {
    case 'random_graph':
      if (spec.generator === 'er') return buildER(spec.N, spec.k, rng);
      if (spec.generator === 'ba') return buildBA(spec.N, spec.k, rng);
      return buildWS(spec.N, spec.k, spec.beta ?? 0.15, rng);
    case 'grid':
      return buildGrid(spec.cols, spec.rows, spec.periodic);
    case 'empty':
      return emptyGraphOf(spec.N);
  }
}

// ---------- Init ----------

export interface InitContext {
  N: number;
  cols?: number;
  rows?: number;
  graph: Graph;
}

export type InitFn = (i: number, d: number, X: Float64Array, rng: RNG, ctx: InitContext) => void;

export const init = {
  fill(values: number[]): InitFn {
    return (i, d, X) => {
      for (let k = 0; k < d; k++) X[i * d + k] = values[k] ?? 0;
    };
  },
  fpWithNoise(fp: number[], noiseAmp: number): InitFn {
    return (i, d, X, rng) => {
      for (let k = 0; k < d; k++) X[i * d + k] = (fp[k] ?? 0) + rng.uniform(-noiseAmp, noiseAmp);
    };
  },
  randomBinary(values: [number, number] = [-1, 1]): InitFn {
    return (i, d, X, rng) => {
      for (let k = 0; k < d; k++) X[i * d + k] = rng.next() < 0.5 ? values[0] : values[1];
    };
  },
  scalarUniform(lo: number, hi: number): InitFn {
    return (i, d, X, rng) => {
      for (let k = 0; k < d; k++) X[i * d + k] = rng.uniform(lo, hi);
    };
  },
};

// ---------- Update strategies ----------

// Helpers passed to user-defined sync rules.
export interface SyncCtx {
  /** Σ_j (X[j][field] - X[i][field]) — graph-Laplacian-style neighbour reduction. */
  neighborDiffSum(i: number, field: number): number;
  /** Σ_j X[j][field] — raw neighbour sum (no -X[i] subtraction). */
  neighborSum(i: number, field: number): number;
  /** Number of neighbours of i. */
  degree(i: number): number;
  /** State of node i, dimension `field`. */
  s(i: number, field: number): number;
  /** Grid coordinates of i (only meaningful for grid topology). */
  rowCol(i: number): [number, number];
}

export type SyncRule = (
  i: number,
  ctx: SyncCtx,
  params: ParamValues,
) => number[];

export type AsyncRule = (
  i: number,
  ctx: SyncCtx,
  params: ParamValues,
  rng: RNG,
) => number[];

export type EdgeEventRule = (
  i: number,
  j: number,
  edgeIdx: number,
  X: Float64Array,
  d: number,
  graph: Graph,
  params: ParamValues,
  rng: RNG,
) => void;

export type DriveFn = (i: number, X: Float64Array, d: number, params: ParamValues) => void;
export type FireRule = (
  i: number,
  X: Float64Array,
  d: number,
  graph: Graph,
  params: ParamValues,
  pushFireCandidate: (j: number) => void,
) => void;

export type StepStrategy =
  | {
      kind: 'sync';
      dt: number;
      substeps: number | ((p: ParamValues) => number);
      rule: SyncRule;
    }
  | {
      kind: 'async';
      updatesPerFrame: (p: ParamValues, N: number) => number;
      rule: AsyncRule;
    }
  | {
      kind: 'edgeEvent';
      eventsPerFrame: (p: ParamValues, edgeCount: number) => number;
      rule: EdgeEventRule;
    }
  | {
      kind: 'driveCascade';
      drivesPerFrame: (p: ParamValues) => number;
      drive: DriveFn;
      threshold: number | ((p: ParamValues) => number);
      fire: FireRule;
      ageField?: number; // optional: this field is auto-aged each step (for visual flash)
      diagnosticField?: '_lastSize' | '_smoothSize'; // optional: write avalanche size here
    };

export const update = {
  sync(opts: {
    dt: number;
    substeps: number | ((p: ParamValues) => number);
    rule: SyncRule;
  }): StepStrategy {
    return { kind: 'sync', ...opts };
  },
  asyncPerCell(opts: {
    updatesPerFrame: (p: ParamValues, N: number) => number;
    rule: AsyncRule;
  }): StepStrategy {
    return { kind: 'async', ...opts };
  },
  eventPerEdge(opts: {
    eventsPerFrame: (p: ParamValues, edgeCount: number) => number;
    rule: EdgeEventRule;
  }): StepStrategy {
    return { kind: 'edgeEvent', ...opts };
  },
  driveAndCascade(opts: {
    drivesPerFrame: (p: ParamValues) => number;
    drive: DriveFn;
    threshold: number | ((p: ParamValues) => number);
    fire: FireRule;
    ageField?: number;
    diagnosticField?: '_lastSize' | '_smoothSize';
  }): StepStrategy {
    return { kind: 'driveCascade', ...opts };
  },
};

// ---------- Render helpers ----------

export const render = {
  divergingByField(field: number, centre: number, halfWidth: number) {
    return {
      nodeColor(state: ModelState, i: number): string {
        const v = state.X[i * state.d + field]!;
        let t = (v - centre) / Math.max(0.0001, halfWidth);
        if (t < -1) t = -1;
        else if (t > 1) t = 1;
        const a = (t + 1) / 2;
        const r = Math.round(44 + (230 - 44) * a);
        const g = Math.round(95 + (57 - 95) * a);
        const b = Math.round(191 + (70 - 191) * a);
        return `rgb(${r},${g},${b})`;
      },
      nodeSize(state: ModelState, i: number): number {
        return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
      },
      edgeAlpha: 0.18,
    };
  },
  binaryByField(field: number, on = '#e63946', off = '#2c5fbf') {
    return {
      nodeColor(state: ModelState, i: number): string {
        return state.X[i * state.d + field]! > 0.5 ? on : off;
      },
      nodeSize(state: ModelState, i: number): number {
        return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4;
      },
      edgeAlpha: 0.18,
    };
  },
  // Grid view: node colour mapped, no edges drawn, full cell fill (handled by player view='grid').
  gridDiverging(field: number, centre: number, halfWidth: number) {
    return {
      nodeColor(state: ModelState, i: number): string {
        const v = state.X[i * state.d + field]!;
        let t = (v - centre) / Math.max(0.0001, halfWidth);
        if (t < -1) t = -1;
        else if (t > 1) t = 1;
        const a = (t + 1) / 2;
        const r = Math.round(20 + (220 - 20) * a);
        const g = Math.round(28 + (62 - 28) * a);
        const b = Math.round(60 + (38 - 60) * a);
        return `rgb(${r},${g},${b})`;
      },
      nodeSize(): number {
        return 1;
      },
    };
  },
  // Grid with optional flash on freshly-aged cells (age field).
  gridWithFlash(opts: {
    valueField: number;
    ageField: number;
    range: [number, number];
    base?: 'navy-orange' | 'binary';
  }) {
    return {
      nodeColor(state: ModelState, i: number): string {
        const age = state.X[i * state.d + opts.ageField]!;
        if (age === 0) return '#ffffff';
        if (age <= 3) {
          const fade = age / 3;
          const r = Math.round(255 - 60 * fade);
          const g = Math.round(255 - 100 * fade);
          const b = Math.round(180 - 130 * fade);
          return `rgb(${r},${g},${b})`;
        }
        const v = state.X[i * state.d + opts.valueField]!;
        const [lo, hi] = opts.range;
        let t = (v - lo) / Math.max(0.0001, hi - lo);
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
        const r = Math.round(20 + (220 - 20) * t);
        const g = Math.round(28 + (62 - 28) * t);
        const b = Math.round(60 + (38 - 60) * t);
        return `rgb(${r},${g},${b})`;
      },
      nodeSize(): number {
        return 1;
      },
    };
  },
};

// ---------- Diagnostics ----------

export const diagnostics = {
  histogramOf(field: number, range: [number, number], bins = 30, label = 'distribution') {
    return {
      label,
      range,
      bins,
      values(state: ModelState): Float64Array {
        const N = state.N;
        const out = new Float64Array(N);
        for (let i = 0; i < N; i++) out[i] = state.X[i * state.d + field]!;
        return out;
      },
    };
  },
  stdOf(field: number, label = 'σ') {
    return {
      label,
      value(state: ModelState): number {
        const N = state.N;
        let s1 = 0;
        let s2 = 0;
        for (let i = 0; i < N; i++) {
          const v = state.X[i * state.d + field]!;
          s1 += v;
          s2 += v * v;
        }
        const m = s1 / N;
        return Math.sqrt(Math.max(0, s2 / N - m * m));
      },
    };
  },
  meanOf(field: number, label = 'mean') {
    return {
      label,
      value(state: ModelState): number {
        const N = state.N;
        let s = 0;
        for (let i = 0; i < N; i++) s += state.X[i * state.d + field]!;
        return s / N;
      },
    };
  },
  scalarFromState(label: string, fn: (state: ModelState) => number) {
    return { label, value: fn };
  },
};

// ---------- The define() function ----------

export interface Definition<S extends ModelState = ModelState> {
  id: string;
  name: string;
  short: string;
  long?: string;
  view?: 'graph' | 'grid';

  topology: TopologySpec;
  state: { d: number; init: InitFn };
  step: StepStrategy;
  render: RenderConfig<S>;
  diagnostics?: ObserveConfig<S>;
  params: ParamSchema;
  presets?: Preset[];

  /** Optional: set up extra fields on the state once after init. */
  postInit?: (state: ModelState, params: ParamValues, rng: RNG) => void;
}

function makeSyncCtx(state: ModelState): SyncCtx {
  const { d, X, graph } = state;
  const adj = graph.adj;
  return {
    neighborDiffSum(i, field) {
      const ai = adj[i]!;
      const xi = X[i * d + field]!;
      let s = 0;
      for (let p = 0; p < ai.length; p++) s += X[ai[p]! * d + field]! - xi;
      return s;
    },
    neighborSum(i, field) {
      const ai = adj[i]!;
      let s = 0;
      for (let p = 0; p < ai.length; p++) s += X[ai[p]! * d + field]!;
      return s;
    },
    degree(i) {
      return graph.deg[i]!;
    },
    s(i, field) {
      return X[i * d + field]!;
    },
    rowCol(i) {
      const cols = state.cols ?? 1;
      return [Math.floor(i / cols), i % cols];
    },
  };
}

function asNum(x: number | ((p: ParamValues) => number), p: ParamValues): number {
  return typeof x === 'function' ? x(p) : x;
}

export function define<S extends ModelState = ModelState>(def: Definition<S>): Model<S> {
  return {
    id: def.id,
    name: def.name,
    short: def.short,
    long: def.long,
    view: def.view,
    params: def.params,
    presets: def.presets,

    init(params: ParamValues, rng: RNG): S {
      const topo = typeof def.topology === 'function' ? def.topology(params) : def.topology;
      const graph = buildTopology(topo, rng);
      const N = graph.N;
      const d = def.state.d;
      const X = new Float64Array(N * d);
      const cols = topo.kind === 'grid' ? topo.cols : undefined;
      const rows = topo.kind === 'grid' ? topo.rows : undefined;
      const ctx: InitContext = { N, cols, rows, graph };
      for (let i = 0; i < N; i++) def.state.init(i, d, X, rng, ctx);

      const state = {
        N,
        d,
        X,
        graph,
        t: 0,
        step_count: 0,
        cols,
        rows,
      } as ModelState;

      if (def.postInit) def.postInit(state, params, rng);

      return state as S;
    },

    step(state: S, params: ParamValues, rng: RNG): void {
      runStep(state, def.step, params, rng);
    },

    render: def.render,
    observe: def.diagnostics,
  };
}

// ---------- Step strategy runners ----------

function runStep(state: ModelState, strategy: StepStrategy, params: ParamValues, rng: RNG): void {
  switch (strategy.kind) {
    case 'sync':
      runSync(state, strategy, params);
      break;
    case 'async':
      runAsync(state, strategy, params, rng);
      break;
    case 'edgeEvent':
      runEdgeEvent(state, strategy, params, rng);
      break;
    case 'driveCascade':
      runDriveCascade(state, strategy, params, rng);
      break;
  }
}

function runSync(
  state: ModelState,
  s: Extract<StepStrategy, { kind: 'sync' }>,
  params: ParamValues,
): void {
  const { N, d, X } = state;
  const SUB = Math.max(1, Math.round(asNum(s.substeps, params) * (params.speed as number ?? 1)));
  const dt = s.dt;
  const ctx = makeSyncCtx(state);

  // reuse buffer across frames
  const aux = state as ModelState & { _Xnew?: Float64Array };
  if (!aux._Xnew || aux._Xnew.length !== N * d) aux._Xnew = new Float64Array(N * d);
  const X_new = aux._Xnew;

  for (let sub = 0; sub < SUB; sub++) {
    for (let i = 0; i < N; i++) {
      const newVals = s.rule(i, ctx, params);
      for (let k = 0; k < d; k++) X_new[i * d + k] = X[i * d + k]! + dt * (newVals[k] ?? 0);
    }
    for (let i = 0; i < N * d; i++) X[i] = X_new[i]!;
    state.step_count++;
  }
  state.t = state.step_count;
}

function runAsync(
  state: ModelState,
  s: Extract<StepStrategy, { kind: 'async' }>,
  params: ParamValues,
  rng: RNG,
): void {
  const { N, d, X } = state;
  const ctx = makeSyncCtx(state);
  const updatesPerFrame = Math.max(
    1,
    Math.round(s.updatesPerFrame(params, N) * (params.speed as number ?? 1)),
  );
  for (let u = 0; u < updatesPerFrame; u++) {
    const i = rng.int(N);
    const newVals = s.rule(i, ctx, params, rng);
    for (let k = 0; k < d; k++) X[i * d + k] = newVals[k] ?? 0;
  }
  state.step_count += updatesPerFrame;
  state.t = state.step_count;
}

function runEdgeEvent(
  state: ModelState,
  s: Extract<StepStrategy, { kind: 'edgeEvent' }>,
  params: ParamValues,
  rng: RNG,
): void {
  const { d, X, graph } = state;
  const events = Math.max(
    1,
    Math.round(s.eventsPerFrame(params, graph.edges.length) * (params.speed as number ?? 1)),
  );
  for (let e = 0; e < events; e++) {
    if (graph.edges.length === 0) break;
    const eIdx = rng.int(graph.edges.length);
    const [i, j] = graph.edges[eIdx]!;
    s.rule(i, j, eIdx, X, d, graph, params, rng);
    state.step_count++;
  }
  state.t = state.step_count;
}

function runDriveCascade(
  state: ModelState,
  s: Extract<StepStrategy, { kind: 'driveCascade' }>,
  params: ParamValues,
  rng: RNG,
): void {
  const { N, d, X, graph } = state;
  const drives = Math.max(1, Math.round(s.drivesPerFrame(params) * (params.speed as number ?? 1)));
  const threshold = asNum(s.threshold, params);
  const aux = state as ModelState & {
    _stack?: Int32Array;
    _lastSize?: number;
    _smoothSize?: number;
  };
  if (!aux._stack || aux._stack.length < N) aux._stack = new Int32Array(N);
  const stack = aux._stack;

  if (s.ageField !== undefined) {
    const f = s.ageField;
    for (let i = 0; i < N; i++) X[i * d + f] = Math.min(X[i * d + f]! + 1, 1000);
  }

  let totalFires = 0;
  for (let dItr = 0; dItr < drives; dItr++) {
    const seed_i = rng.int(N);
    s.drive(seed_i, X, d, params);
    let top = 0;

    // Check every field in case multiple fields can trigger; but the standard
    // case: dimension 0 is the "activity". Let user define the threshold check
    // implicitly by setting a single threshold value compared against X[i*d + 0].
    // For richer use-cases the user can sub-class via `fire` which receives the
    // full state and can decide what to do.
    if (X[seed_i * d]! >= threshold) stack[top++] = seed_i;

    while (top > 0) {
      const i = stack[--top]!;
      if (X[i * d]! < threshold) continue;
      X[i * d] = X[i * d]! - threshold;
      if (s.ageField !== undefined) X[i * d + s.ageField] = 0;
      totalFires++;

      s.fire(i, X, d, graph, params, (j: number) => {
        if (X[j * d]! >= threshold && top < stack.length) {
          stack[top++] = j;
        }
      });
    }
  }

  if (s.diagnosticField === '_lastSize') aux._lastSize = totalFires;
  else if (s.diagnosticField === '_smoothSize') {
    aux._smoothSize = (aux._smoothSize ?? 0) * 0.85 + totalFires * 0.15;
  }

  state.step_count++;
  state.t = state.step_count;
}
