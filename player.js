// adaptiveNet player runtime.
// Loads a model module by id (URL ?model=...), builds a parameter UI from the
// model's schema, runs init / step / observe / render, manages seed and history.

import { RNG } from './rng.js';
import { computeLayout } from './layout.js';

// --- registry of available models ---
const MODEL_REGISTRY = {
  'nakao-2010': () => import('./models/nakao.js')
};

// --- DOM handles ---
const $  = (id) => document.getElementById(id);
const netcv  = $('netcv'),  netctx  = netcv.getContext('2d');
const histcv = $('histcv'), histctx = histcv.getContext('2d');
const tscv   = $('tscv'),   tsctx   = tscv.getContext('2d');

function fitCanvas(c) {
  const r = c.getBoundingClientRect();
  c.width  = Math.max(50, Math.floor(r.width));
  c.height = Math.max(50, Math.floor(r.height));
}
function fitAll() { fitCanvas(netcv); fitCanvas(histcv); fitCanvas(tscv); }

// --- URL state ---
function parseURL() {
  const u = new URL(location.href);
  const id = u.searchParams.get('model') || 'nakao-2010';
  const seed = +(u.searchParams.get('seed') || 1) || 1;
  const pStr = u.searchParams.get('p') || '';
  const params = {};
  if (pStr) {
    for (const part of pStr.split(',')) {
      const [k, v] = part.split(':');
      if (!k) continue;
      const num = parseFloat(v);
      params[k] = (Number.isNaN(num) || /[^0-9.+\-eE]/.test(v)) ? v : num;
    }
  }
  return { id, seed, params };
}

function buildQuery(id, seed, params) {
  const pStr = Object.entries(params).map(([k, v]) => `${k}:${v}`).join(',');
  return `?model=${id}&seed=${seed}&p=${pStr}`;
}

// --- runtime state ---
let model = null;
let params = {};         // current parameter values
let seed = 1;
let state = null;        // model state object
let pos = null;          // node positions, Float64Array(N*2)
let running = true;
let rafId = 0;

const TS_LEN = 240;
let tsBuf = new Float64Array(TS_LEN);
let tsHead = 0, tsCount = 0;

// --- UI building ---
function buildParamsUI() {
  const root = $('params');
  root.innerHTML = '';
  for (const [key, spec] of Object.entries(model.params)) {
    const row = document.createElement('div');
    row.className = 'row';

    const label = document.createElement('label');
    const span = document.createElement('span'); span.className = 'v';
    label.textContent = (spec.label || key) + ' ';
    label.appendChild(span);
    row.appendChild(label);

    let input;
    if (spec.options) {
      input = document.createElement('select');
      for (const opt of spec.options) {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        input.appendChild(o);
      }
      input.value = String(params[key]);
      span.textContent = String(params[key]);
      input.addEventListener('input', () => {
        params[key] = input.value;
        span.textContent = input.value;
        if (spec.live) { /* live: no rebuild */ }
        else rebuild();
      });
    } else {
      input = document.createElement('input');
      input.type = 'range';
      input.min = String(spec.min);
      input.max = String(spec.max);
      input.step = String(spec.step);
      input.value = String(params[key]);
      span.textContent = formatNum(params[key], spec.step);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        params[key] = v;
        span.textContent = formatNum(v, spec.step);
        if (!spec.live) rebuild();
      });
    }
    row.appendChild(input);
    root.appendChild(row);
  }
}

function formatNum(v, step) {
  // pick decimals from the step magnitude
  const dec = step >= 1 ? 0 : Math.min(4, Math.max(1, -Math.floor(Math.log10(step))));
  return Number(v).toFixed(dec);
}

// --- init / rebuild ---
function rebuild() {
  $('loading').style.display = 'flex';
  // yield to browser so the overlay paints before the heavy work
  setTimeout(() => {
    fitAll();
    const rng = new RNG(seed);
    state = model.init(params, rng);
    pos = computeLayout(state.graph, netcv.width, netcv.height, rng);
    tsBuf.fill(0); tsHead = 0; tsCount = 0;
    $('netinfo').textContent =
      `N=${state.N} · |E|=${state.graph.edges.length} · ⟨k⟩=${(2 * state.graph.edges.length / state.N).toFixed(2)} · Δ=${maxDeg(state.graph.deg)}`;
    $('loading').style.display = 'none';
  }, 16);
}

function maxDeg(deg) {
  let m = 0;
  for (let i = 0; i < deg.length; i++) if (deg[i] > m) m = deg[i];
  return m;
}

// --- rendering ---
function drawNetwork() {
  if (!state || !pos) return;
  const W = netcv.width, H = netcv.height;
  netctx.clearRect(0, 0, W, H);

  const edges = state.graph.edges;
  const alpha = (model.render.edgeAlpha ?? 0.18);
  netctx.strokeStyle = `rgba(140,150,170,${alpha})`;
  netctx.lineWidth = 1;
  netctx.beginPath();
  for (let e = 0; e < edges.length; e++) {
    const [i, j] = edges[e];
    netctx.moveTo(pos[i * 2], pos[i * 2 + 1]);
    netctx.lineTo(pos[j * 2], pos[j * 2 + 1]);
  }
  netctx.stroke();

  for (let i = 0; i < state.N; i++) {
    const r = model.render.nodeSize(state, i, params);
    netctx.fillStyle = model.render.nodeColor(state, i, params);
    netctx.beginPath();
    netctx.arc(pos[i * 2], pos[i * 2 + 1], r, 0, Math.PI * 2);
    netctx.fill();
    netctx.strokeStyle = 'rgba(0,0,0,0.4)';
    netctx.stroke();
  }
}

function drawHist() {
  histctx.clearRect(0, 0, histcv.width, histcv.height);
  if (!state) return;
  const obs = model.observe?.histogram;
  if (!obs) return;
  const W = histcv.width, H = histcv.height;

  const values = obs.values(state);
  const [lo, hi] = obs.range;
  const BINS = obs.bins ?? 30;
  const bins = new Int32Array(BINS);
  for (let k = 0; k < values.length; k++) {
    let t = (values[k] - lo) / (hi - lo);
    if (t < 0) t = 0; else if (t >= 1) t = 0.9999;
    bins[Math.floor(t * BINS)]++;
  }
  let mx = 1;
  for (let b = 0; b < BINS; b++) if (bins[b] > mx) mx = bins[b];

  const bw = W / BINS;
  for (let b = 0; b < BINS; b++) {
    const t = (b + 0.5) / BINS;
    const xv = lo + t * (hi - lo);
    histctx.fillStyle = colorFromObserved(model, state, xv, params);
    const h = (bins[b] / mx) * (H - 14);
    histctx.fillRect(b * bw + 1, H - h - 4, bw - 2, h);
  }
  histctx.fillStyle = '#6b7280';
  histctx.font = '10px ui-monospace, monospace';
  histctx.fillText(`${lo}`, 2, H - 1);
  histctx.fillText(`${hi}`, W - 18, H - 1);
}

// best-effort: try to use the model's nodeColor by faking a node with the bin's value;
// fall back to a neutral grey.
function colorFromObserved(model, state, val) {
  try {
    const fake = { ...state, X: new Float64Array(state.d || 1) };
    fake.X[0] = val;
    return model.render.nodeColor(fake, 0, params);
  } catch (e) {
    return '#cbd2dc';
  }
}

function drawTimeSeries() {
  const obs = model.observe?.timeSeries;
  if (!obs) { tsctx.clearRect(0, 0, tscv.width, tscv.height); return; }
  const W = tscv.width, H = tscv.height;
  tsctx.clearRect(0, 0, W, H);
  if (tsCount < 2) return;

  let mx = 0;
  for (let i = 0; i < tsCount; i++) if (tsBuf[i] > mx) mx = tsBuf[i];
  if (mx < 1e-6) mx = 1;

  tsctx.strokeStyle = 'rgba(140,150,170,0.1)';
  tsctx.beginPath();
  for (let i = 1; i < 4; i++) { tsctx.moveTo(0, i * H / 4); tsctx.lineTo(W, i * H / 4); }
  tsctx.stroke();

  tsctx.strokeStyle = '#e63946';
  tsctx.lineWidth = 1.4;
  tsctx.beginPath();
  for (let i = 0; i < tsCount; i++) {
    const idx = (tsHead - tsCount + i + TS_LEN) % TS_LEN;
    const x = (i / (TS_LEN - 1)) * W;
    const y = H - 4 - (tsBuf[idx] / mx) * (H - 8);
    if (i === 0) tsctx.moveTo(x, y); else tsctx.lineTo(x, y);
  }
  tsctx.stroke();

  tsctx.fillStyle = '#6b7280';
  tsctx.font = '10px ui-monospace, monospace';
  tsctx.fillText(`max = ${mx.toFixed(3)}`, 4, 12);
}

// --- main loop ---
function loop() {
  if (running && state) {
    model.step(state, params, new RNG(seed ^ state.step_count));
    const ts = model.observe?.timeSeries;
    if (ts) {
      tsBuf[tsHead] = ts.value(state);
      tsHead = (tsHead + 1) % TS_LEN;
      if (tsCount < TS_LEN) tsCount++;
    }
    $('t-val').textContent    = (state.t ?? 0).toFixed(2);
    $('step-val').textContent = (state.step_count ?? 0);
  }
  drawNetwork();
  drawHist();
  drawTimeSeries();
  rafId = requestAnimationFrame(loop);
}

// --- description rendering (very small markdown-ish) ---
function renderDescription(md) {
  // *italic*, **bold**, paragraph breaks on blank lines
  const html = md
    .split(/\n\s*\n/)
    .map(p => p
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>'))
    .map(p => `<p>${p.replace(/\n/g, ' ')}</p>`)
    .join('');
  return html;
}

// --- bootstrap ---
async function boot() {
  const url = parseURL();
  seed = url.seed;
  $('seed').value = String(seed);

  const loader = MODEL_REGISTRY[url.id];
  if (!loader) {
    document.body.innerHTML = `<div style="padding:40px">unknown model: <b>${url.id}</b>. <a href="index.html">back to gallery</a></div>`;
    return;
  }
  model = (await loader()).default;

  // initialize params with defaults, override with URL
  params = {};
  for (const [k, spec] of Object.entries(model.params)) {
    params[k] = (k in url.params) ? coerceParam(spec, url.params[k]) : spec.default;
  }

  // chrome
  $('model-name').textContent = model.name;
  $('description').innerHTML = renderDescription(model.long || model.short || '');
  document.title = `adaptiveNet — ${model.name}`;

  buildParamsUI();
  attachActions();
  rebuild();
  loop();
}

function coerceParam(spec, raw) {
  if (spec.options) return String(raw);
  const n = Number(raw);
  return Number.isFinite(n) ? n : spec.default;
}

function attachActions() {
  $('reset').addEventListener('click', rebuild);
  $('reseed').addEventListener('click', () => {
    seed = (Math.random() * 2147483647) | 0 || 1;
    $('seed').value = String(seed);
    rebuild();
  });
  $('seed').addEventListener('change', () => {
    const v = parseInt($('seed').value, 10);
    if (Number.isFinite(v) && v > 0) { seed = v; rebuild(); }
  });
  $('seed-rand').addEventListener('click', () => {
    seed = (Math.random() * 2147483647) | 0 || 1;
    $('seed').value = String(seed);
    rebuild();
  });
  $('pause').addEventListener('click', () => {
    running = !running;
    $('pause').textContent = running ? 'pause' : 'play';
  });
  $('share').addEventListener('click', async () => {
    const link = location.origin + location.pathname + buildQuery(model.id, seed, params);
    try {
      await navigator.clipboard.writeText(link);
      $('share').textContent = 'copied!';
      setTimeout(() => { $('share').textContent = 'copy link'; }, 1200);
    } catch (e) {
      prompt('copy this link:', link);
    }
  });

  addEventListener('resize', () => {
    fitAll();
    if (state) {
      // recompute layout in-place; RNG split off the seed so layout is stable on resize.
      pos = computeLayout(state.graph, netcv.width, netcv.height, new RNG(seed ^ 0xA5A5A5));
    }
  });
}

boot();
