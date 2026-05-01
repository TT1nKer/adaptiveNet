// adaptiveNet player runtime.
//
// Loads a model module by id (URL ?model=...), builds a parameter UI from the
// model's schema, runs init / step / observe / render, manages seed and the
// shareable permalink.

import { RNG } from './rng.ts';
import { computeLayout } from './layout.ts';
import type { Model, ModelState, ParamSpec, ParamValues, NumericParamSpec, CategoricalParamSpec } from './types.ts';

// ---------- model registry ----------
const MODEL_REGISTRY: Record<string, () => Promise<{ default: Model }>> = {
  'nakao-2010': () => import('./models/nakao.ts'),
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
  c.width = Math.max(50, Math.floor(r.width));
  c.height = Math.max(50, Math.floor(r.height));
}
function fitAll(): void {
  fitCanvas(netcv);
  fitCanvas(histcv);
  fitCanvas(tscv);
}

// ---------- URL state ----------
function parseURL(): { id: string; seed: number; params: Record<string, string | number> } {
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
  return { id, seed, params };
}

function buildQuery(id: string, seed: number, params: ParamValues): string {
  const pStr = Object.entries(params).map(([k, v]) => `${k}:${v}`).join(',');
  return `?model=${id}&seed=${seed}&p=${pStr}`;
}

// ---------- runtime state ----------
let model: Model | null = null;
let params: ParamValues = {};
let seed = 1;
let state: ModelState | null = null;
let pos: Float64Array | null = null;
let running = true;

const TS_LEN = 240;
const tsBuf = new Float64Array(TS_LEN);
let tsHead = 0;
let tsCount = 0;

// ---------- formatting ----------
function formatNum(v: number, step: number): string {
  const dec = step >= 1 ? 0 : Math.min(4, Math.max(1, -Math.floor(Math.log10(step))));
  return v.toFixed(dec);
}

// ---------- parameter UI ----------
function isNumericSpec(s: ParamSpec): s is NumericParamSpec {
  return (s as NumericParamSpec).options === undefined;
}

function buildParamsUI(): void {
  const root = el('params');
  root.innerHTML = '';
  if (!model) return;

  for (const [key, specRaw] of Object.entries(model.params)) {
    const spec = specRaw as ParamSpec;
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('label');
    const valSpan = document.createElement('span');
    valSpan.className = 'v';
    label.textContent = (spec.label || key) + ' ';
    label.appendChild(valSpan);
    row.appendChild(label);

    if (!isNumericSpec(spec)) {
      const select = document.createElement('select');
      const cspec = spec as CategoricalParamSpec;
      for (const opt of cspec.options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        select.appendChild(o);
      }
      select.value = String(params[key]);
      valSpan.textContent = String(params[key]);
      select.addEventListener('input', () => {
        params[key] = select.value;
        valSpan.textContent = select.value;
        if (!cspec.live) rebuild();
      });
      row.appendChild(select);
    } else {
      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(params[key]);
      valSpan.textContent = formatNum(params[key] as number, spec.step);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        params[key] = v;
        valSpan.textContent = formatNum(v, spec.step);
        if (!spec.live) rebuild();
      });
      row.appendChild(input);
    }
    root.appendChild(row);
  }
}

// ---------- init / rebuild ----------
function rebuild(): void {
  if (!model) return;
  const overlay = el('loading');
  overlay.style.display = 'flex';
  // yield a frame so the overlay paints before the heavy work
  setTimeout(() => {
    if (!model) return;
    fitAll();
    const rng = new RNG(seed);
    state = model.init(params, rng);
    pos = computeLayout(state.graph, netcv.width, netcv.height, rng);
    tsBuf.fill(0);
    tsHead = 0;
    tsCount = 0;
    let maxDeg = 0;
    for (let i = 0; i < state.graph.deg.length; i++) {
      const d = state.graph.deg[i]!;
      if (d > maxDeg) maxDeg = d;
    }
    el('netinfo').textContent =
      `N=${state.N} · |E|=${state.graph.edges.length} · ⟨k⟩=${(2 * state.graph.edges.length / state.N).toFixed(2)} · Δ=${maxDeg}`;
    overlay.style.display = 'none';
  }, 16);
}

// ---------- rendering ----------
function drawNetwork(): void {
  const W = netcv.width;
  const H = netcv.height;
  netctx.clearRect(0, 0, W, H);
  if (!state || !pos || !model) return;

  const edges = state.graph.edges;
  const alpha = model.render.edgeAlpha ?? 0.18;
  netctx.strokeStyle = `rgba(140,150,170,${alpha})`;
  netctx.lineWidth = 1;
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
    netctx.stroke();
  }
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
  el('ts-ttl').textContent = obs.label;

  const W = tscv.width;
  const H = tscv.height;
  if (tsCount < 2) return;

  let mx = 0;
  for (let i = 0; i < tsCount; i++) if (tsBuf[i]! > mx) mx = tsBuf[i]!;
  if (mx < 1e-6) mx = 1;

  tsctx.strokeStyle = 'rgba(140,150,170,0.1)';
  tsctx.beginPath();
  for (let i = 1; i < 4; i++) {
    tsctx.moveTo(0, (i * H) / 4);
    tsctx.lineTo(W, (i * H) / 4);
  }
  tsctx.stroke();

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

// ---------- main loop ----------
function loop(): void {
  if (running && state && model) {
    model.step(state, params, new RNG(seed ^ state.step_count));
    const ts = model.observe?.timeSeries;
    if (ts) {
      tsBuf[tsHead] = ts.value(state);
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

async function boot(): Promise<void> {
  const url = parseURL();
  seed = url.seed;
  (el('seed') as HTMLInputElement).value = String(seed);

  const loader = MODEL_REGISTRY[url.id];
  if (!loader) {
    document.body.innerHTML = `<div style="padding:40px">unknown model: <b>${url.id}</b>. <a href="index.html">back to gallery</a></div>`;
    return;
  }
  model = (await loader()).default;

  params = {};
  for (const [k, spec] of Object.entries(model.params)) {
    params[k] = (k in url.params) ? coerceParam(spec, url.params[k]!) : spec.default;
  }

  el('model-name').textContent = model.name;
  el('description').innerHTML = renderDescription(model.long || model.short || '');
  document.title = `adaptiveNet — ${model.name}`;

  buildParamsUI();
  attachActions();
  rebuild();
  loop();
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
      pos = computeLayout(state.graph, netcv.width, netcv.height, new RNG(seed ^ 0xa5a5a5));
    }
  });
}

void boot();
