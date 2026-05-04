// adaptiveNet player runtime.
//
// Loads a model module by id (URL ?model=...), builds a parameter UI from the
// model's schema, runs init / step / observe / render, manages seed and the
// shareable permalink.

import { RNG } from './rng.ts';
import { Layout, GridLayout } from './layout.ts';
import type { Model, ModelState, ParamSpec, ParamValues, NumericParamSpec, CategoricalParamSpec, Preset } from './types.ts';

type AnyLayout = Layout | GridLayout;

// ---------- model registry ----------
const MODEL_REGISTRY: Record<string, () => Promise<{ default: Model<any> }>> = {
  'nakao-2010': () => import('./models/nakao.ts'),
  'holme-newman': () => import('./models/voter.ts'),
  'adaptive-sis': () => import('./models/adaptive-sis.ts'),
  'gray-scott': () => import('./models/gray-scott.ts'),
  'brusselator-grid': () => import('./models/brusselator.ts'),
  'hopfield': () => import('./models/hopfield.ts'),
  'hopfield-capacity': () => import('./models/hopfield-capacity.ts'),
  'hopfield-modern': () => import('./models/hopfield-modern.ts'),
  'ising': () => import('./models/ising.ts'),
  'lif': () => import('./models/lif.ts'),
  'avalanches': () => import('./models/avalanches.ts'),
};

// ---------- DOM helpers ----------
function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing element: #${id}`);
  return e;
}

const netcv = el('netcv') as HTMLCanvasElement;
const histcv = el('histcv') as HTMLCanvasElement;
const tscv = el('tscv') as HTMLCanvasElement;
const netctx = netcv.getContext('2d')!;
const histctx = histcv.getContext('2d')!;
const tsctx = tscv.getContext('2d')!;

function fitCanvas(c: HTMLCanvasElement): void {
  const r = c.getBoundingClientRect();
  // If CSS layout hasn't completed (rect is zero), fall back to a reasonable
  // default so we never render into a 50×50 stamp in the corner. The next
  // resize / rebuild will pick up real dimensions.
  c.width = r.width > 1 ? Math.floor(r.width) : 800;
  c.height = r.height > 1 ? Math.floor(r.height) : 600;
}
function fitAll(): void {
  fitCanvas(netcv);
  fitCanvas(histcv);
  fitCanvas(tscv);
}

// ---------- URL state ----------
function parseURL(): {
  id: string;
  seed: number;
  params: Record<string, string | number>;
  presetId: string | null;
} {
  const u = new URL(location.href);
  const id = u.searchParams.get('model') || 'nakao-2010';
  const seedRaw = u.searchParams.get('seed');
  const seed = seedRaw ? parseInt(seedRaw, 10) || 1 : 1;
  const pStr = u.searchParams.get('p') || '';
  const params: Record<string, string | number> = {};
  if (pStr) {
    for (const part of pStr.split(',')) {
      const [k, v] = part.split(':');
      if (!k || v === undefined) continue;
      const num = parseFloat(v);
      params[k] = Number.isNaN(num) || /[^0-9.+\-eE]/.test(v) ? v : num;
    }
  }
  const presetId = u.searchParams.get('preset');
  return { id, seed, params, presetId };
}

function buildQuery(id: string, seed: number, params: ParamValues): string {
  const pStr = Object.entries(params).map(([k, v]) => `${k}:${v}`).join(',');
  return `?model=${id}&seed=${seed}&p=${pStr}`;
}

// ---------- runtime state ----------
let model: Model<any> | null = null;
let params: ParamValues = {};
let seed = 1;
let state: ModelState | null = null;
let layout: AnyLayout | null = null;
let running = true;

// view transform (canvas-space → screen-space)
let zoom = 1;
let panX = 0;
let panY = 0;
let hoverNode: number | null = null;
let isDragging = false;
let dragStart = { x: 0, y: 0, panX: 0, panY: 0 };
let didPan = false;

const TS_LEN = 240;
const tsBuf = new Float64Array(TS_LEN);
const tsBuf2 = new Float64Array(TS_LEN);
let tsHead = 0;
let tsCount = 0;
let hasTs2 = false;

// ---------- formatting ----------
function formatNum(v: number, step: number): string {
  const dec = step >= 1 ? 0 : Math.min(4, Math.max(1, -Math.floor(Math.log10(step))));
  return v.toFixed(dec);
}

// ---------- parameter UI ----------
function isNumericSpec(s: ParamSpec): s is NumericParamSpec {
  return (s as NumericParamSpec).options === undefined;
}

// Refs so applyPreset can sync slider visuals without rebuilding the DOM.
const paramInputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
const paramValueSpans = new Map<string, HTMLElement>();

function buildParamsUI(): void {
  const root = el('params');
  root.innerHTML = '';
  paramInputs.clear();
  paramValueSpans.clear();
  if (!model) return;

  for (const [key, specRaw] of Object.entries(model.params)) {
    const spec = specRaw as ParamSpec;
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('label');
    label.appendChild(document.createTextNode((spec.label || key) + ' '));

    if (!isNumericSpec(spec)) {
      // categorical: dropdown with the current value mirrored as a label span
      const valSpan = document.createElement('span');
      valSpan.className = 'v';
      valSpan.textContent = String(params[key]);
      label.appendChild(valSpan);
      row.appendChild(label);

      const select = document.createElement('select');
      const cspec = spec as CategoricalParamSpec;
      for (const opt of cspec.options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      }
      select.value = String(params[key]);
      select.addEventListener('input', () => {
        params[key] = select.value;
        valSpan.textContent = select.value;
        if (!cspec.live) rebuild();
      });
      row.appendChild(select);
      paramInputs.set(key, select);
      paramValueSpans.set(key, valSpan);
    } else {
      // numeric: editable number input (in the label) + range slider beneath.
      // Either control writes the same value; the other mirrors it.
      const min = spec.min;
      const max = spec.max;
      const step = spec.step;
      const live = !!spec.live;

      const valInput = document.createElement('input');
      valInput.type = 'number';
      valInput.className = 'v';
      valInput.min = String(min);
      valInput.max = String(max);
      valInput.step = String(step);
      valInput.value = formatNum(params[key] as number, step);
      label.appendChild(valInput);
      row.appendChild(label);

      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(params[key]);
      row.appendChild(range);

      const apply = (raw: number, source: 'range' | 'text'): void => {
        let v = raw;
        if (Number.isNaN(v)) {
          // bad text → revert
          valInput.value = formatNum(params[key] as number, step);
          return;
        }
        if (v < min) v = min;
        if (v > max) v = max;
        params[key] = v;
        if (source !== 'text') valInput.value = formatNum(v, step);
        if (source !== 'range') range.value = String(v);
        if (!live) rebuild();
      };

      range.addEventListener('input', () => apply(parseFloat(range.value), 'range'));
      // commit typed value on Enter or blur, but don't rebuild on every keystroke
      valInput.addEventListener('change', () => apply(parseFloat(valInput.value), 'text'));
      valInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      });

      paramInputs.set(key, range);
      paramValueSpans.set(key, valInput);
    }

    root.appendChild(row);
  }
}

function syncParamUI(): void {
  if (!model) return;
  for (const [key, input] of paramInputs) {
    const v = params[key];
    if (v === undefined) continue;
    input.value = String(v);
    const display = paramValueSpans.get(key);
    if (!display) continue;
    const spec = model.params[key]!;
    if (display instanceof HTMLInputElement && isNumericSpec(spec)) {
      display.value = formatNum(v as number, spec.step);
    } else {
      display.textContent = String(v);
    }
  }
}

// ---------- presets ----------
function buildPresetsUI(): void {
  const section = el('preset-section');
  const select = el('preset-select') as HTMLSelectElement;
  const note = el('preset-note');
  select.innerHTML = '';
  note.textContent = '';
  if (!model || !model.presets || model.presets.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— pick a regime —';
  select.appendChild(placeholder);

  for (const preset of model.presets) {
    const opt = document.createElement('option');
    opt.value = preset.id;
    opt.textContent = preset.name;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const id = select.value;
    if (!id) {
      note.textContent = '';
      return;
    }
    const preset = model!.presets!.find((p) => p.id === id);
    if (!preset) return;
    applyPreset(preset);
    note.textContent = preset.short ?? '';
  });
}

function applyPreset(preset: Preset): void {
  if (!model) return;
  for (const [k, v] of Object.entries(preset.params)) {
    if (v !== undefined) params[k] = v;
  }
  if (preset.seed !== undefined) {
    seed = preset.seed;
    (el('seed') as HTMLInputElement).value = String(seed);
  }
  syncParamUI();
  rebuild();
}

function selectPresetInUI(id: string, showNote = true): void {
  const select = el('preset-select') as HTMLSelectElement;
  if (!select) return;
  select.value = id;
  if (showNote && model?.presets) {
    const preset = model.presets.find((p) => p.id === id);
    if (preset) el('preset-note').textContent = preset.short ?? '';
  }
}

// ---------- init / rebuild ----------
function rebuild(): void {
  if (!model) return;
  fitAll();
  const rng = new RNG(seed);
  state = model.init(params, rng) as ModelState;
  if (model.view === 'grid' && state.cols && state.rows) {
    layout = new GridLayout(state.cols, state.rows, netcv.width, netcv.height);
  } else {
    // Incremental force-directed layout for graph view: starts from a circle,
    // converges over a second or so before the dynamics begin.
    layout = new Layout(state.graph, netcv.width, netcv.height, rng);
  }
  tsBuf.fill(0);
  tsBuf2.fill(0);
  tsHead = 0;
  tsCount = 0;
  hasTs2 = !!model.observe?.timeSeries2;
  resetView();
  hoverNode = null;
  let maxDeg = 0;
  for (let i = 0; i < state.graph.deg.length; i++) {
    const d = state.graph.deg[i]!;
    if (d > maxDeg) maxDeg = d;
  }
  if (model.view === 'grid') {
    el('netinfo').textContent = `${state.cols} × ${state.rows} grid · N=${state.N}`;
  } else {
    el('netinfo').textContent =
      `N=${state.N} · |E|=${state.graph.edges.length} · ⟨k⟩=${(2 * state.graph.edges.length / state.N).toFixed(2)} · Δ=${maxDeg}`;
  }
}

// ---------- rendering ----------
function drawNetwork(): void {
  const W = netcv.width;
  const H = netcv.height;
  netctx.clearRect(0, 0, W, H);
  if (!state || !layout || !model) return;
  const pos = layout.pos;

  netctx.save();
  netctx.translate(panX, panY);
  netctx.scale(zoom, zoom);

  if (model.view === 'grid' && state.cols && state.rows) {
    // ----- grid view: filled cells, no edges -----
    const cols = state.cols;
    const rows = state.rows;
    const cellW = W / cols;
    const cellH = H / rows;
    for (let i = 0; i < state.N; i++) {
      const c = i % cols;
      const r = (i / cols) | 0;
      netctx.fillStyle = model.render.nodeColor(state, i, params);
      // +0.5 fudge keeps neighbouring cells from showing seam gaps
      netctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);
    }
    if (hoverNode !== null && hoverNode < state.N) {
      const c = hoverNode % cols;
      const r = (hoverNode / cols) | 0;
      netctx.strokeStyle = '#e8edf4';
      netctx.lineWidth = 2 / zoom;
      netctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
    }
  } else {
    // ----- graph view: edges + node circles -----
    const edges = state.graph.edges;
    const alpha = model.render.edgeAlpha ?? 0.18;
    netctx.strokeStyle = `rgba(140,150,170,${alpha})`;
    netctx.lineWidth = 1 / zoom;
    netctx.beginPath();
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
      netctx.strokeStyle = 'rgba(0,0,0,0.4)';
      netctx.lineWidth = 1 / zoom;
      netctx.stroke();
    }

    if (hoverNode !== null && hoverNode < state.N) {
      const i = hoverNode;
      const r = model.render.nodeSize(state, i, params);
      netctx.strokeStyle = '#e8edf4';
      netctx.lineWidth = 2 / zoom;
      netctx.beginPath();
      netctx.arc(pos[i * 2]!, pos[i * 2 + 1]!, r + 3 / zoom, 0, Math.PI * 2);
      netctx.stroke();
    }
  }

  netctx.restore();

  // tooltip in screen space
  if (hoverNode !== null && hoverNode < state.N) drawTooltip(hoverNode);

  // zoom indicator
  if (Math.abs(zoom - 1) > 0.01) {
    netctx.fillStyle = '#6b7280';
    netctx.font = '11px ui-monospace, monospace';
    netctx.fillText(`zoom ${zoom.toFixed(2)}× — double-click to reset`, 10, 18);
  }
}

function drawTooltip(i: number): void {
  if (!state || !layout || !model) return;
  const pos = layout.pos;
  const sx = pos[i * 2]! * zoom + panX;
  const sy = pos[i * 2 + 1]! * zoom + panY;
  const r = model.render.nodeSize(state, i, params) * zoom;

  const lines: string[] = [`node ${i} · deg ${state.graph.deg[i]}`];
  for (let k = 0; k < state.d; k++) {
    const v = state.X[i * state.d + k]!;
    lines.push(`X[${k}] = ${v.toFixed(3)}`);
  }

  netctx.font = '12px ui-monospace, monospace';
  const padding = 8;
  const lineHeight = 16;
  let textWidth = 0;
  for (const ln of lines) {
    const w = netctx.measureText(ln).width;
    if (w > textWidth) textWidth = w;
  }
  const boxW = textWidth + padding * 2;
  const boxH = lines.length * lineHeight + padding * 2 - 4;

  let bx = sx + r + 10;
  let by = sy - boxH / 2;
  if (bx + boxW > netcv.width - 4) bx = sx - r - 10 - boxW;
  if (by < 4) by = 4;
  if (by + boxH > netcv.height - 4) by = netcv.height - 4 - boxH;

  netctx.fillStyle = 'rgba(11,13,17,0.95)';
  netctx.fillRect(bx, by, boxW, boxH);
  netctx.strokeStyle = '#232a36';
  netctx.lineWidth = 1;
  netctx.strokeRect(bx + 0.5, by + 0.5, boxW, boxH);

  netctx.fillStyle = '#cbd2dc';
  for (let k = 0; k < lines.length; k++) {
    netctx.fillText(lines[k]!, bx + padding, by + padding + (k + 1) * lineHeight - 5);
  }
}

function findNodeAtPoint(mxModel: number, myModel: number, screenThreshold: number): number | null {
  if (!state) return null;
  // grid view: direct cell lookup, no proximity search
  if (model?.view === 'grid' && state.cols && state.rows) {
    const cellW = netcv.width / state.cols;
    const cellH = netcv.height / state.rows;
    const c = Math.floor(mxModel / cellW);
    const r = Math.floor(myModel / cellH);
    if (c < 0 || c >= state.cols || r < 0 || r >= state.rows) return null;
    return r * state.cols + c;
  }
  // graph view: nearest-node within a screen-space radius
  if (!layout) return null;
  const pos = layout.pos;
  const t = screenThreshold / zoom;
  const t2 = t * t;
  let best = -1;
  let bestD2 = t2;
  for (let i = 0; i < state.N; i++) {
    const dx = mxModel - pos[i * 2]!;
    const dy = myModel - pos[i * 2 + 1]!;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best >= 0 ? best : null;
}

function resetView(): void {
  zoom = 1;
  panX = 0;
  panY = 0;
}

function colorFromObserved(val: number): string {
  if (!state || !model) return '#cbd2dc';
  // synthesize a fake state with X[0] = val, ask the model to color it.
  // This only works if nodeColor reads X[i*d] only — true for our current models.
  try {
    const fake: ModelState = { ...state, X: new Float64Array(state.d || 1) };
    fake.X[0] = val;
    return model.render.nodeColor(fake, 0, params);
  } catch {
    return '#cbd2dc';
  }
}

function drawHist(): void {
  histctx.clearRect(0, 0, histcv.width, histcv.height);
  if (!state || !model) return;
  const obs = model.observe?.histogram;
  if (!obs) return;

  const W = histcv.width;
  const H = histcv.height;
  const values = obs.values(state);
  const [lo, hi] = obs.range;
  const BINS = obs.bins ?? 30;
  const bins = new Int32Array(BINS);
  for (let k = 0; k < values.length; k++) {
    let t = (values[k]! - lo) / (hi - lo);
    if (t < 0) t = 0;
    else if (t >= 1) t = 0.9999;
    bins[Math.floor(t * BINS)]++;
  }
  let mx = 1;
  for (let b = 0; b < BINS; b++) if (bins[b]! > mx) mx = bins[b]!;

  const bw = W / BINS;
  for (let b = 0; b < BINS; b++) {
    const t = (b + 0.5) / BINS;
    const xv = lo + t * (hi - lo);
    histctx.fillStyle = colorFromObserved(xv);
    const h = (bins[b]! / mx) * (H - 14);
    histctx.fillRect(b * bw + 1, H - h - 4, bw - 2, h);
  }
  histctx.fillStyle = '#6b7280';
  histctx.font = '11px ui-monospace, monospace';
  histctx.fillText(String(lo), 2, H - 1);
  histctx.fillText(String(hi), W - 18, H - 1);

  el('hist-ttl').textContent = obs.label;
}

function drawTimeSeries(): void {
  tsctx.clearRect(0, 0, tscv.width, tscv.height);
  if (!model) return;
  const obs = model.observe?.timeSeries;
  if (!obs) return;
  const obs2 = model.observe?.timeSeries2;

  // Title text — combine both labels if a second series exists
  if (obs2) {
    el('ts-ttl').innerHTML =
      `<span style="color:#e63946">●</span> ${obs.label} &nbsp;&nbsp; <span style="color:#fbbf24">●</span> ${obs2.label}`;
  } else {
    el('ts-ttl').textContent = obs.label;
  }

  const W = tscv.width;
  const H = tscv.height;
  if (tsCount < 2) return;

  // Find max across both series for shared y-axis
  let mx = 0;
  for (let i = 0; i < tsCount; i++) {
    if (tsBuf[i]! > mx) mx = tsBuf[i]!;
    if (hasTs2 && tsBuf2[i]! > mx) mx = tsBuf2[i]!;
  }
  if (mx < 1e-6) mx = 1;

  // grid lines
  tsctx.strokeStyle = 'rgba(140,150,170,0.1)';
  tsctx.beginPath();
  for (let i = 1; i < 4; i++) {
    tsctx.moveTo(0, (i * H) / 4);
    tsctx.lineTo(W, (i * H) / 4);
  }
  tsctx.stroke();

  // primary series — red
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

  // secondary series — yellow (if present)
  if (hasTs2) {
    tsctx.strokeStyle = '#fbbf24';
    tsctx.lineWidth = 1.4;
    tsctx.beginPath();
    for (let i = 0; i < tsCount; i++) {
      const idx = (tsHead - tsCount + i + TS_LEN) % TS_LEN;
      const x = (i / (TS_LEN - 1)) * W;
      const y = H - 4 - (tsBuf2[idx]! / mx) * (H - 8);
      if (i === 0) tsctx.moveTo(x, y);
      else tsctx.lineTo(x, y);
    }
    tsctx.stroke();
  }

  tsctx.fillStyle = '#6b7280';
  tsctx.font = '11px ui-monospace, monospace';
  tsctx.fillText(`max = ${mx.toFixed(3)}`, 4, 12);
}

// ---------- main loop ----------
function loop(): void {
  // Phase 1: layout converges. Phase 2: dynamics run on frozen layout.
  if (state && layout && !layout.done) {
    // 2 iters per frame for small N, 1 for large — keep frame budget < 16 ms.
    const stepsPerFrame = state.N > 500 ? 1 : 2;
    for (let s = 0; s < stepsPerFrame; s++) layout.step();
    el('netinfo').textContent =
      `settling layout… ${layout.iter}/${layout.maxIter}`;
    if (layout.done) {
      let maxDeg = 0;
      for (let i = 0; i < state.graph.deg.length; i++) {
        const d = state.graph.deg[i]!;
        if (d > maxDeg) maxDeg = d;
      }
      el('netinfo').textContent =
        `N=${state.N} · |E|=${state.graph.edges.length} · ⟨k⟩=${(2 * state.graph.edges.length / state.N).toFixed(2)} · Δ=${maxDeg}`;
    }
  } else if (running && state && model) {
    model.step(state, params, new RNG(seed ^ state.step_count));
    const ts = model.observe?.timeSeries;
    const ts2 = model.observe?.timeSeries2;
    if (ts) {
      tsBuf[tsHead] = ts.value(state);
      if (ts2) tsBuf2[tsHead] = ts2.value(state);
      tsHead = (tsHead + 1) % TS_LEN;
      if (tsCount < TS_LEN) tsCount++;
    }
    el('t-val').textContent = state.t.toFixed(2);
    el('step-val').textContent = String(state.step_count);
  }
  drawNetwork();
  drawHist();
  drawTimeSeries();
  requestAnimationFrame(loop);
}

// ---------- description rendering (very small markdown subset) ----------
function renderDescription(md: string): string {
  return md
    .split(/\n\s*\n/)
    .map((p) =>
      p
        .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
    )
    .map((p) => `<p>${p.replace(/\n/g, ' ')}</p>`)
    .join('');
}

// ---------- bootstrap ----------
function coerceParam(spec: ParamSpec, raw: string | number): string | number {
  if (!isNumericSpec(spec)) return String(raw);
  const n = Number(raw);
  return Number.isFinite(n) ? n : (spec as NumericParamSpec).default;
}

function showBootError(stage: string, err: unknown): void {
  const msg = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  console.error(`[adaptiveNet] boot failed at "${stage}":`, err);
  document.body.innerHTML =
    `<div style="padding:32px;color:#e63946;font:13px ui-monospace,monospace;line-height:1.6">` +
    `<h2 style="color:#e8edf4;margin:0 0 8px">boot error at: ${stage}</h2>` +
    `<pre style="white-space:pre-wrap;background:#0e1014;padding:16px;border:1px solid #232a36;border-radius:4px">${escapeHtml(msg)}</pre>` +
    `<p><a href="index.html" style="color:#e63946">← back to gallery</a></p>` +
    `</div>`;
}
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

async function boot(): Promise<void> {
  let stage = 'parseURL';
  try {
    const url = parseURL();
    seed = url.seed;

    stage = 'set seed input';
    (el('seed') as HTMLInputElement).value = String(seed);

    stage = 'lookup model';
    const loader = MODEL_REGISTRY[url.id];
    if (!loader) {
      document.body.innerHTML = `<div style="padding:40px">unknown model: <b>${escapeHtml(url.id)}</b>. <a href="index.html">back to gallery</a></div>`;
      return;
    }

    stage = `import model ${url.id}`;
    model = (await loader()).default;
    console.log('[adaptiveNet] model loaded:', model.id);

    stage = 'merge params with URL overrides';
    params = {};
    for (const [k, spec] of Object.entries(model.params)) {
      params[k] = (k in url.params) ? coerceParam(spec, url.params[k]!) : spec.default;
    }
    // If a preset is named in the URL, layer its values on top of the
    // resolved defaults. Explicit ?p= entries still win because we apply
    // them again afterward.
    if (url.presetId && model.presets) {
      const preset = model.presets.find((p) => p.id === url.presetId);
      if (preset) {
        for (const [k, v] of Object.entries(preset.params)) {
          if (v !== undefined && !(k in url.params)) params[k] = v;
        }
        if (preset.seed !== undefined && !url.params['seed']) {
          seed = preset.seed;
        }
      }
    }
    console.log('[adaptiveNet] params:', params);

    stage = 'set chrome';
    el('model-name').textContent = model.name;
    el('description-short').innerHTML = renderDescription(model.short || '');
    el('description').innerHTML = renderDescription(model.long || model.short || '');
    document.title = `adaptiveNet — ${model.name}`;
    (el('seed') as HTMLInputElement).value = String(seed);

    stage = 'buildParamsUI';
    buildParamsUI();
    buildPresetsUI();
    if (url.presetId) selectPresetInUI(url.presetId);

    stage = 'attachActions';
    attachActions();

    stage = 'first rebuild';
    requestAnimationFrame(() => {
      try {
        rebuild();
        console.log('[adaptiveNet] rebuild complete:',
          'canvas', netcv.width, '×', netcv.height,
          '· N', state?.N, '· edges', state?.graph.edges.length);
        loop();
      } catch (e) {
        showBootError('first rebuild', e);
      }
    });
  } catch (e) {
    showBootError(stage, e);
  }
}

function attachActions(): void {
  el('reset').addEventListener('click', () => rebuild());

  const reseed = (): void => {
    seed = (Math.random() * 2147483647) | 0 || 1;
    (el('seed') as HTMLInputElement).value = String(seed);
    rebuild();
  };
  el('reseed').addEventListener('click', reseed);
  el('seed-rand').addEventListener('click', reseed);

  el('seed').addEventListener('change', () => {
    const v = parseInt((el('seed') as HTMLInputElement).value, 10);
    if (Number.isFinite(v) && v > 0) {
      seed = v;
      rebuild();
    }
  });

  el('pause').addEventListener('click', () => {
    running = !running;
    el('pause').textContent = running ? 'pause' : 'play';
  });

  el('share').addEventListener('click', async () => {
    if (!model) return;
    const link = location.origin + location.pathname + buildQuery(model.id, seed, params);
    try {
      await navigator.clipboard.writeText(link);
      el('share').textContent = 'copied!';
      setTimeout(() => { el('share').textContent = 'copy link'; }, 1200);
    } catch {
      prompt('copy this link:', link);
    }
  });

  addEventListener('resize', () => {
    fitAll();
    if (state) {
      // recompute the layout in-place; gives the resize a fresh "settle" pass.
      layout = new Layout(state.graph, netcv.width, netcv.height, new RNG(seed ^ 0xa5a5a5));
      resetView();
    }
  });

  // ----- pan / zoom / hover on the network canvas -----
  netcv.style.cursor = 'grab';

  netcv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = netcv.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (netcv.width / rect.width);
    const sy = (e.clientY - rect.top) * (netcv.height / rect.height);
    const factor = e.deltaY > 0 ? 0.9 : 1.111;
    const newZoom = Math.max(0.2, Math.min(20, zoom * factor));
    // zoom centered on the mouse position
    panX = sx - (sx - panX) * (newZoom / zoom);
    panY = sy - (sy - panY) * (newZoom / zoom);
    zoom = newZoom;
  }, { passive: false });

  netcv.addEventListener('mousedown', (e) => {
    isDragging = true;
    didPan = false;
    dragStart = { x: e.clientX, y: e.clientY, panX, panY };
    netcv.style.cursor = 'grabbing';
  });

  netcv.addEventListener('mousemove', (e) => {
    const rect = netcv.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (netcv.width / rect.width);
    const sy = (e.clientY - rect.top) * (netcv.height / rect.height);

    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) didPan = true;
      panX = dragStart.panX + dx * (netcv.width / rect.width);
      panY = dragStart.panY + dy * (netcv.height / rect.height);
      hoverNode = null;
    } else {
      // hover: convert screen → model coords, find nearest node
      const mx = (sx - panX) / zoom;
      const my = (sy - panY) / zoom;
      hoverNode = findNodeAtPoint(mx, my, 12);
      netcv.style.cursor = hoverNode !== null ? 'pointer' : 'grab';
    }
  });

  netcv.addEventListener('mouseup', () => {
    isDragging = false;
    netcv.style.cursor = hoverNode !== null ? 'pointer' : 'grab';
  });

  netcv.addEventListener('mouseleave', () => {
    isDragging = false;
    hoverNode = null;
    netcv.style.cursor = 'grab';
  });

  netcv.addEventListener('dblclick', () => {
    resetView();
  });
}

void boot();
