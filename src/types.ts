// Shared type declarations for the adaptiveNet substrate.
//
// A *model* is anything that conforms to the `Model` interface.
// The player runtime is generic over models — it has no knowledge of
// reaction kinetics, topology, or rendering specifics.

import type { RNG } from './rng.ts';

// ---------- parameters (slider / dropdown declarations) ----------

export interface NumericParamSpec {
  label?: string;
  min: number;
  max: number;
  step: number;
  default: number;
  /** If true, slider changes apply live without rebuilding the graph. */
  live?: boolean;
  options?: undefined;
}

export interface CategoricalParamSpec {
  label?: string;
  options: readonly string[];
  default: string;
  live?: boolean;
  min?: undefined;
  max?: undefined;
  step?: undefined;
}

export type ParamSpec = NumericParamSpec | CategoricalParamSpec;
export type ParamSchema = Record<string, ParamSpec>;
export type ParamValues = Record<string, number | string>;

// ---------- graph and state ----------

export interface Graph {
  N: number;
  adj: number[][];
  edges: Array<[number, number]>;
  deg: Int32Array;
}

/**
 * Base shape of a model state. Models may extend it with extra fields
 * (caches, auxiliary buffers, etc.) and declare their own state type.
 */
export interface ModelState {
  N: number;
  /** Per-node state dimension. */
  d: number;
  /** Length-N*d row-major node state array. */
  X: Float64Array;
  graph: Graph;
  t: number;
  step_count: number;
  /** Grid dimensions. Required when Model.view === 'grid'. */
  cols?: number;
  rows?: number;
}

// ---------- rendering ----------

export interface RenderConfig<S extends ModelState = ModelState> {
  nodeColor(state: S, i: number, params: ParamValues): string;
  nodeSize(state: S, i: number, params: ParamValues): number;
  /** Constant edge alpha for now. May become a function later. */
  edgeAlpha?: number;
}

// ---------- diagnostics ----------

export interface HistogramObservation<S extends ModelState = ModelState> {
  label: string;
  range: [number, number];
  bins?: number;
  values(state: S): Float64Array;
}

export interface TimeSeriesObservation<S extends ModelState = ModelState> {
  label: string;
  value(state: S): number;
}

export interface ObserveConfig<S extends ModelState = ModelState> {
  histogram?: HistogramObservation<S>;
  timeSeries?: TimeSeriesObservation<S>;
  /**
   * Optional second time-series, drawn on the same chart in a contrasting
   * colour. Useful when two related quantities make sense overlaid (e.g.
   * "recall to target" vs "recall to anything").
   */
  timeSeries2?: TimeSeriesObservation<S>;
}

// ---------- the Model interface ----------

/**
 * Named parameter scenario. Lets a model offer "interesting regimes" the user
 * can jump to by name, instead of dragging sliders into the right region by
 * hand. Selecting a preset overrides any params it specifies; unspecified
 * params keep their current values.
 */
export interface Preset {
  id: string;
  name: string;
  /** One-line note shown when the preset is selected. */
  short?: string;
  /** Subset of params to override. Other params keep their current values. */
  params: Partial<ParamValues>;
  /** Optional seed override for full reproducibility. */
  seed?: number;
}

export interface Model<S extends ModelState = ModelState> {
  id: string;
  name: string;
  /** One-line description for the gallery card. */
  short: string;
  /** Multi-paragraph description for the player panel. Optional. */
  long?: string;
  params: ParamSchema;
  /** Named parameter scenarios. Optional. */
  presets?: Preset[];

  /**
   * How the runtime should lay out and render this model.
   *   'graph' (default): force-directed positions, draw nodes as circles
   *                      with edge lines.
   *   'grid':            cell positions from state.cols × state.rows,
   *                      draw filled square cells with no edge lines.
   */
  view?: 'graph' | 'grid';

  init(params: ParamValues, rng: RNG): S;
  step(state: S, params: ParamValues, rng: RNG): void;

  render: RenderConfig<S>;
  observe?: ObserveConfig<S>;
}
