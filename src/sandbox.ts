// adaptiveNet sandbox runtime.
//
// Lets a visitor paste a Model definition into the in-browser editor and run
// it without installing anything. Same Model interface as src/models/*.ts,
// but the user code is JavaScript (no TS compilation in browser to keep the
// runtime minimal). The user's last expression should be a Model object,
// or they can declare `const model = {...}` at the top level.
//
// The substrate API exposed to user code (via the `aNet` global):
//   aNet.generators.{er,ba,ws}(N, k, rng)  → Graph
//   aNet.RNG                                → seedable PRNG class
//
// Sharing: code is base64-encoded into the URL fragment so a permalink
// captures the exact model the visitor was running.

import { generators } from './graph.ts';
import { RNG } from './rng.ts';
import { Layout, GridLayout } from './layout.ts';
import type { Graph, Model, ModelState, ParamSpec, ParamValues, NumericParamSpec, CategoricalParamSpec } from './types.ts';

// ---------- DOM helpers ----------
function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element: #${id}`);
  return e;
}

const netcv = el('netcv') as HTMLCanvasElement;
const tscv = el('tscv') as HTMLCanvasElement;
const netctx = netcv.getContext('2d')!;
const tsctx = tscv.getContext('2d')!;

// ---------- runtime state ----------
let model: Model<any> | null = null;
let params: ParamValues = {};
let seed = 1;
let state: ModelState | null = null;
let layout: Layout | GridLayout | null = null;
let running = false;
let editor: any = null;

// Time-series buffer.
const TS_LEN = 240;
const tsBuf = new Float64Array(TS_LEN);
let tsHead = 0;
let tsCount = 0;

// view transform
let zoom = 1;
let panX = 0;
let panY = 0;

// ---------- default code (the template, JS-flavoured) ----------
const DEFAULT_CODE = `// adaptiveNet sandbox — edit me!
// The Model interface (same as src/models/*.ts):
//   { id, name, short, params, init, step, render, observe? }
//
// Available helpers via the \`aNet\` global:
//   aNet.generators.er(N, k, rng)   — Erdős–Rényi random graph
//   aNet.generators.ba(N, k, rng)   — Barabási–Albert scale-free graph
//   aNet.generators.ws(N, k, rng)   — Watts–Strogatz small-world graph
//   new aNet.RNG(seed)              — seedable PRNG with .next() / .int(n) / .uniform(a, b)

const TOPO_OPTS = ['er', 'ba', 'ws'];

const model = {
  id: 'sandbox-spread',
  name: 'Sandbox: Adaptive Spread',
  short: 'Edit me. Nodes activate via random edges; active nodes prune dissenting links.',

  params: {
    p_spread:    { label: 'p_spread (activation)', min: 0,    max: 1,    step: 0.01, default: 0.30, live: true },
    p_rewire:    { label: 'p_rewire (rewire)',     min: 0,    max: 1,    step: 0.01, default: 0.10, live: true },
    init_active: { label: 'initial active',        min: 0.01, max: 0.5,  step: 0.01, default: 0.05, live: false },
    N:           { label: 'nodes',                 min: 50,   max: 1000, step: 10,   default: 200,  live: false },
    k:           { label: 'avg degree',            min: 2,    max: 14,   step: 1,    default: 6,    live: false },
    topo:        { label: 'topology',              options: TOPO_OPTS,   default: 'er',             live: false },
    speed:       { label: 'speed',                 min: 0.1,  max: 5,    step: 0.1,  default: 1.0,  live: true },
  },

  init(params, rng) {
    const N = Math.round(params.N);
    const graph = aNet.generators[params.topo](N, Math.round(params.k), rng);
    const X = new Float64Array(N);
    for (let i = 0; i < N; i++) X[i] = rng.next() < params.init_active ? 1 : 0;
    return { N, d: 1, X, graph, t: 0, step_count: 0 };
  },

  step(state, params, rng) {
    const { N, X, graph } = state;
    const { adj, edges, deg } = graph;
    const ticks = Math.max(1, Math.floor(edges.length * 0.05 * params.speed));

    for (let t = 0; t < ticks; t++) {
      if (edges.length === 0) return;
      const eIdx = rng.int(edges.length);
      const [i, j] = edges[eIdx];
      if (X[i] === X[j]) continue;
      const activeNode = X[i] === 1 ? i : j;
      const inactiveNode = X[i] === 1 ? j : i;

      if (rng.next() < params.p_rewire) {
        adj[activeNode] = adj[activeNode].filter(x => x !== inactiveNode);
        adj[inactiveNode] = adj[inactiveNode].filter(x => x !== activeNode);
        deg[activeNode]--;
        deg[inactiveNode]--;
        edges[eIdx] = edges[edges.length - 1];
        edges.pop();
        let kk = -1;
        for (let attempts = 0; attempts < 30; attempts++) {
          const cand = rng.int(N);
          if (cand === activeNode || X[cand] !== 1) continue;
          if (adj[activeNode].includes(cand)) continue;
          kk = cand;
          break;
        }
        if (kk >= 0) {
          adj[activeNode].push(kk);
          adj[kk].push(activeNode);
          deg[activeNode]++;
          deg[kk]++;
          edges.push(activeNode < kk ? [activeNode, kk] : [kk, activeNode]);
        }
      } else if (rng.next() < params.p_spread) {
        X[inactiveNode] = 1;
      }
      state.step_count++;
    }
    state.t = state.step_count;
  },

  render: {
    nodeColor(state, i) { return state.X[i] === 1 ? '#e63946' : '#2c5fbf'; },
    nodeSize(state, i) { return 4 + Math.sqrt(state.graph.deg[i] || 1) * 1.4; },
    edgeAlpha: 0.18,
  },

  observe: {
    timeSeries: {
      label: 'fraction active',
      value(state) {
        let count = 0;
        for (let i = 0; i < state.N; i++) if (state.X[i] === 1) count++;
        return count / state.N;
      },
    },
  },
};

model;
`;

// ---------- evaluate user code into a Model ----------
function evalUserCode(code: string): Model<any> {
  // Wrap and inject the substrate as `aNet`. Function constructor avoids
  // capturing the lexical scope of this module — the user's code can only
  // see `aNet` and the standard JS globals.
  const fn = new Function(
    'aNet',
    `${code}\n;return typeof model !== 'undefined' ? model : null;`,
  );
  const aNet = { generators, RNG };
  const result = fn(aNet);
  if (!result || typeof result !== 'object') {
    throw new Error('Editor code did not produce a `model` object. Define `const model = {...}` at the top level, ending with `model;`.');
  }
  if (typeof result.init !== 'function' || typeof result.step !== 'function') {
    throw new Error('Model is missing `init` or `step` function.');
  }
  if (!result.params || typeof result.params !== 'object') {
    throw new Error('Model is missing `params` object.');
  }
  return result as Model<any>;
}

// ---------- params UI ----------
function isNumericSpec(s: ParamSpec): s is NumericParamSpec {
  return (s as NumericParamSpec).options === undefined;
}

function formatNum(v: number, step: number): string {
  const dec = step >= 1 ? 0 : Math.min(4, Math.max(1, -Math.floor(Math.log10(step))));
  return v.toFixed(dec);
}

const paramInputs = new Map<string, HTMLInputElement | HTMLSelectElement>();

function buildParamsUI(): void {
  const root = el('params');
  root.innerHTML = '';
  paramInputs.clear();
  if (!model) return;

  for (const [key, specRaw] of Object.entries(model.params)) {
    const spec = specRaw as ParamSpec;
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('label');
    label.appendChild(document.createTextNode((spec.label || key) + ' '));

    if (!isNumericSpec(spec)) {
      const valSpan = document.createElement('span');
      valSpan.className = 'v';
      valSpan.textContent = String(params[key]);
      label.appendChild(valSpan);
      row.appendChild(label);

      const select = document.createElement('select');
      select.className = 'full';
      const opts = (spec as CategoricalParamSpec).options;
      for (const o of opts) {
        const opt = document.createElement('option');
        opt.value = o;
        opt.textContent = o;
        select.appendChild(opt);
      }
      select.value = String(params[key]);
      select.addEventListener('change', () => {
        params[key] = select.value;
        valSpan.textContent = select.value;
        if (!spec.live) rebuild();
      });
      row.appendChild(select);
      paramInputs.set(key, select);
    } else {
      const numSpec = spec as NumericParamSpec;
      const valInput = document.createElement('input');
      valInput.className = 'v';
      valInput.type = 'text';
      valInput.value = formatNum(params[key] as number, numSpec.step);
      label.appendChild(valInput);
      row.appendChild(label);

      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(numSpec.min);
      range.max = String(numSpec.max);
      range.step = String(numSpec.step);
      range.value = String(params[key]);
      range.addEventListener('input', () => {
        const v = parseFloat(range.value);
        params[key] = v;
        valInput.value = formatNum(v, numSpec.step);
        if (!spec.live) rebuild();
      });
      valInput.addEventListener('change', () => {
        const v = parseFloat(valInput.value);
        if (!isFinite(v)) return;
        params[key] = v;
        range.value = String(v);
        if (!spec.live) rebuild();
      });
      row.appendChild(range);
      paramInputs.set(key, range);
    }
    root.appendChild(row);
  }
}

// ---------- runtime ----------
function fitCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  netcv.width = netcv.clientWidth * dpr;
  netcv.height = netcv.clientHeight * dpr;
  netctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tscv.width = tscv.clientWidth * dpr;
  tscv.height = tscv.clientHeight * dpr;
  tsctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function rebuild(): void {
  if (!model) return;
  fitCanvas();
  const rng = new RNG(seed);
  state = model.init(params, rng) as ModelState;
  if (model.view === 'grid' && state.cols && state.rows) {
    layout = new GridLayout(state.cols, state.rows, netcv.width, netcv.height);
  } else {
    layout = new Layout(state.graph, netcv.width / (window.devicePixelRatio || 1), netcv.height / (window.devicePixelRatio || 1), rng);
  }
  tsBuf.fill(0);
  tsHead = 0;
  tsCount = 0;
  zoom = 1;
  panX = 0;
  panY = 0;
  let maxDeg = 0;
  for (let i = 0; i < state.graph.deg.length; i++) {
    if (state.graph.deg[i]! > maxDeg) maxDeg = state.graph.deg[i]!;
  }
  if (model.view === 'grid') {
    el('netinfo').textContent = `${state.cols} × ${state.rows} grid · N=${state.N}`;
  } else {
    el('netinfo').textContent =
      `N=${state.N} · |E|=${state.graph.edges.length} · ⟨k⟩=${(2 * state.graph.edges.length / state.N).toFixed(2)} · Δ=${maxDeg}`;
  }
}

function drawNetwork(): void {
  if (!state || !layout || !model) return;
  const dpr = window.devicePixelRatio || 1;
  const W = netcv.width / dpr;
  const H = netcv.height / dpr;
  netctx.clearRect(0, 0, W, H);
  const pos = layout.pos;

  netctx.save();
  netctx.translate(panX, panY);
  netctx.scale(zoom, zoom);

  if (model.view === 'grid' && state.cols && state.rows) {
    const cw = W / state.cols;
    const ch = H / state.rows;
    for (let i = 0; i < state.N; i++) {
      netctx.fillStyle = model.render.nodeColor(state, i, params);
      const x = pos[i * 2]!;
      const y = pos[i * 2 + 1]!;
      netctx.fillRect(x - cw / 2, y - ch / 2, cw + 0.5, ch + 0.5);
    }
  } else {
    netctx.strokeStyle = `rgba(140,150,170,${model.render.edgeAlpha ?? 0.18})`;
    netctx.lineWidth = 0.5;
    netctx.beginPath();
    const edges = state.graph.edges;
    for (let e = 0; e < edges.length; e++) {
      const [i, j] = edges[e]!;
      netctx.moveTo(pos[i * 2]!, pos[i * 2 + 1]!);
      netctx.lineTo(pos[j * 2]!, pos[j * 2 + 1]!);
    }
    netctx.stroke();

    for (let i = 0; i < state.N; i++) {
      const r = model.render.nodeSize(state, i, params);
      netctx.fillStyle = model.render.nodeColor(state, i, params);
      netctx.beginPath();
      netctx.arc(pos[i * 2]!, pos[i * 2 + 1]!, r, 0, Math.PI * 2);
      netctx.fill();
    }
  }
  netctx.restore();
}

function drawTimeSeries(): void {
  const dpr = window.devicePixelRatio || 1;
  const W = tscv.width / dpr;
  const H = tscv.height / dpr;
  tsctx.clearRect(0, 0, W, H);
  if (tsCount < 2 || !model?.observe?.timeSeries) return;
  el('ts-ttl').textContent = model.observe.timeSeries.label;
  let mx = 0;
  for (let i = 0; i < tsCount; i++) if (tsBuf[i]! > mx) mx = tsBuf[i]!;
  if (mx < 1e-6) mx = 1;

  tsctx.strokeStyle = '#e63946';
  tsctx.lineWidth = 1.4;
  tsctx.beginPath();
  for (let i = 0; i < tsCount; i++) {
    const idx = (tsHead - tsCount + i + TS_LEN) % TS_LEN;
    const x = (i / (TS_LEN - 1)) * W;
    const y = H - 4 - (tsBuf[idx]! / mx) * (H - 8);
    if (i === 0) tsctx.moveTo(x, y);
    else tsctx.lineTo(x, y);
  }
  tsctx.stroke();

  tsctx.fillStyle = '#6b7280';
  tsctx.font = '11px ui-monospace, monospace';
  tsctx.fillText(`max = ${mx.toFixed(3)}`, 4, 12);
}

function loop(): void {
  if (state && layout && !layout.done) {
    const stepsPerFrame = state.N > 500 ? 1 : 2;
    for (let s = 0; s < stepsPerFrame; s++) layout.step();
    if (layout.done) el('netinfo').textContent =
      `N=${state.N} · |E|=${state.graph.edges.length} · ⟨k⟩=${(2 * state.graph.edges.length / state.N).toFixed(2)}`;
  } else if (running && state && model) {
    try {
      model.step(state, params, new RNG(seed ^ state.step_count));
      const ts = model.observe?.timeSeries;
      if (ts) {
        tsBuf[tsHead] = ts.value(state);
        tsHead = (tsHead + 1) % TS_LEN;
        if (tsCount < TS_LEN) tsCount++;
      }
      el('t-val').textContent = state.t.toFixed(2);
      el('step-val').textContent = String(state.step_count);
    } catch (err) {
      running = false;
      setStatus(`step() threw: ${(err as Error).message}`, 'error');
    }
  }
  drawNetwork();
  drawTimeSeries();
  requestAnimationFrame(loop);
}

// ---------- status / share / lang ----------
function setStatus(msg: string, kind: 'ok' | 'error' | 'info' = 'info'): void {
  const e = el('editor-status');
  e.textContent = msg;
  e.className = 'editor-status ' + kind;
  el('model-status').textContent = '— ' + msg;
}

function encodeCodeToHash(code: string): string {
  return '#code=' + btoa(unescape(encodeURIComponent(code)));
}

function decodeCodeFromHash(): string | null {
  const m = location.hash.match(/^#code=(.*)$/);
  if (!m) return null;
  try {
    return decodeURIComponent(escape(atob(m[1]!)));
  } catch {
    return null;
  }
}

// ---------- run / restart / pause ----------
function doRun(): void {
  try {
    const code = editor.getValue();
    model = evalUserCode(code);
    params = {};
    for (const [k, spec] of Object.entries(model.params)) {
      params[k] = (spec as ParamSpec).default;
    }
    el('model-name').textContent = model.name || model.id || 'model';
    buildParamsUI();
    rebuild();
    running = true;
    el('pause').textContent = 'pause';
    setStatus(`Running. Model: ${model.name || model.id}`, 'ok');
  } catch (err) {
    running = false;
    setStatus(`${(err as Error).message}`, 'error');
    console.error(err);
  }
}

function doRestart(): void {
  if (!model) return;
  rebuild();
  running = true;
  el('pause').textContent = 'pause';
}

function togglePause(): void {
  if (!model) return;
  running = !running;
  el('pause').textContent = running ? 'pause' : 'play';
}

async function doShare(): Promise<void> {
  const code = editor.getValue();
  const url = location.origin + location.pathname + encodeCodeToHash(code);
  try {
    await navigator.clipboard.writeText(url);
    setStatus(`Permalink copied to clipboard (${(code.length / 1024).toFixed(1)} KB).`, 'ok');
  } catch {
    setStatus(`URL: ${url.slice(0, 100)}…`, 'info');
  }
}

// ---------- monaco editor bootstrap ----------
function setupEditor(): void {
  const monaco = (window as any).monaco;
  const initialCode = decodeCodeFromHash() ?? DEFAULT_CODE;
  editor = monaco.editor.create(el('editor'), {
    value: initialCode,
    language: 'javascript',
    theme: 'vs-dark',
    fontSize: 12,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
  });
  // Auto-run if URL came pre-loaded with code
  if (decodeCodeFromHash()) {
    setTimeout(doRun, 100);
  }
}

// ---------- mouse interaction (pan/zoom) ----------
let isDragging = false;
let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
netcv.addEventListener('mousedown', (ev) => {
  isDragging = true;
  dragStart = { x: ev.clientX, y: ev.clientY, panX, panY };
});
window.addEventListener('mousemove', (ev) => {
  if (!isDragging) return;
  panX = dragStart.panX + (ev.clientX - dragStart.x);
  panY = dragStart.panY + (ev.clientY - dragStart.y);
});
window.addEventListener('mouseup', () => { isDragging = false; });
netcv.addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const factor = ev.deltaY < 0 ? 1.1 : 1 / 1.1;
  zoom *= factor;
}, { passive: false });

// ---------- buttons ----------
el('run').addEventListener('click', doRun);
el('restart').addEventListener('click', doRestart);
el('pause').addEventListener('click', togglePause);
el('share').addEventListener('click', doShare);
(el('seed') as HTMLInputElement).addEventListener('change', (ev) => {
  seed = parseInt((ev.target as HTMLInputElement).value, 10) || 1;
  if (model) doRestart();
});
el('seed-rand').addEventListener('click', () => {
  seed = (Math.random() * 1e9) | 0;
  (el('seed') as HTMLInputElement).value = String(seed);
  if (model) doRestart();
});

// ---------- bootstrap ----------
window.addEventListener('monaco-ready', () => {
  setupEditor();
  fitCanvas();
  requestAnimationFrame(loop);
});
window.addEventListener('resize', fitCanvas);

// Lang toggle (currently only EN/ZH on landing pages; sandbox links back to itself)
const langToggle = el('lang-toggle') as HTMLAnchorElement;
const isZh = new URLSearchParams(location.search).get('lang') === 'zh';
langToggle.textContent = isZh ? 'EN' : '中文';
langToggle.addEventListener('click', (ev) => {
  ev.preventDefault();
  const u = new URL(location.href);
  if (isZh) u.searchParams.delete('lang'); else u.searchParams.set('lang', 'zh');
  location.href = u.toString();
});

// Type stub so this file compiles even without monaco's @types installed.
declare global {
  interface Window {
    monaco?: any;
  }
}

void Layout; // suppress unused-import lint when grid is used
void GridLayout;
void RNG;
void generators;
type _G = Graph;
type _PV = ParamValues;
