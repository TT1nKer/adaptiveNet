// v2 library — named reaction kernels.
//
// Each entry is a factory returning a function (u, v, params) → [du, dv].
// Reaction-diffusion demos can compose these with the `update.reactionDiffusion`
// pattern instead of writing the kinetics inline. Same model on a different
// topology / with different parameters becomes a one-line change.
//
// All factories take an "options" object naming which params control the
// kinetics. Defaults match the standard literature parameter sets, but the
// user can wire any param schema they like to these.

import type { ParamValues } from '../types.ts';

export type Reaction2 = (u: number, v: number, params: ParamValues) => [number, number];

// ---------- Mimura–Murray (Nakao 2010 default) ----------
//
//   du/dt = ((a + b u - u²) / c − v) u
//   dv/dt = (u − 1 − d v) v
//
// Default (a, b, c, d) = (35, 16, 9, 0.4) puts the FP at (5, 10).

export interface MimuraMurrayOpts {
  a?: number | string;
  b?: number | string;
  c?: number | string;
  d?: number | string;
}
export function mimuraMurray(opts: MimuraMurrayOpts = {}): Reaction2 {
  const A = opts.a ?? 35;
  const B = opts.b ?? 16;
  const C = opts.c ?? 9;
  const D = opts.d ?? 0.4;
  return (u, v, params) => {
    const a = typeof A === 'string' ? (params[A] as number) : A;
    const b = typeof B === 'string' ? (params[B] as number) : B;
    const c = typeof C === 'string' ? (params[C] as number) : C;
    const d = typeof D === 'string' ? (params[D] as number) : D;
    return [
      ((a + b * u - u * u) / c - v) * u,
      (u - 1 - d * v) * v,
    ];
  };
}

// ---------- Brusselator (Prigogine–Lefever 1968) ----------
//
//   du/dt = a − (b + 1) u + u² v
//   dv/dt = b u − u² v

export interface BrusselatorOpts {
  a?: number | string;
  b?: number | string;
}
export function brusselator(opts: BrusselatorOpts = {}): Reaction2 {
  const A = opts.a ?? 'a';   // default to reading from params
  const B = opts.b ?? 'b';
  return (u, v, params) => {
    const a = typeof A === 'string' ? (params[A] as number) : A;
    const b = typeof B === 'string' ? (params[B] as number) : B;
    return [
      a - (b + 1) * u + u * u * v,
      b * u - u * u * v,
    ];
  };
}

// ---------- Gray–Scott ----------
//
//   du/dt = -u v² + f (1 − u)
//   dv/dt =  u v² − (f + k) v

export interface GrayScottOpts {
  f?: number | string;
  k?: number | string;
}
export function grayScott(opts: GrayScottOpts = {}): Reaction2 {
  const F = opts.f ?? 'f';
  const K = opts.k ?? 'k';
  return (u, v, params) => {
    const f = typeof F === 'string' ? (params[F] as number) : F;
    const k = typeof K === 'string' ? (params[K] as number) : K;
    return [
      -u * v * v + f * (1 - u),
      u * v * v - (f + k) * v,
    ];
  };
}

// ---------- Schnakenberg ----------
//
//   du/dt = a − u + u² v
//   dv/dt = b − u² v

export interface SchnakenbergOpts {
  a?: number | string;
  b?: number | string;
}
export function schnakenberg(opts: SchnakenbergOpts = {}): Reaction2 {
  const A = opts.a ?? 'a';
  const B = opts.b ?? 'b';
  return (u, v, params) => {
    const a = typeof A === 'string' ? (params[A] as number) : A;
    const b = typeof B === 'string' ? (params[B] as number) : B;
    return [
      a - u + u * u * v,
      b - u * u * v,
    ];
  };
}

// ---------- FitzHugh–Nagumo (excitable / oscillator) ----------
//
//   du/dt = u − u³/3 − v + I
//   dv/dt = ε (u + a − b v)
//
// With external current I; tuning (a, b, ε) gives oscillatory or excitable.

export interface FitzHughNagumoOpts {
  a?: number | string;
  b?: number | string;
  epsilon?: number | string;
  I?: number | string;
}
export function fitzHughNagumo(opts: FitzHughNagumoOpts = {}): Reaction2 {
  const A = opts.a ?? 0.7;
  const B = opts.b ?? 0.8;
  const E = opts.epsilon ?? 0.08;
  const I = opts.I ?? 0;
  return (u, v, params) => {
    const a = typeof A === 'string' ? (params[A] as number) : A;
    const b = typeof B === 'string' ? (params[B] as number) : B;
    const eps = typeof E === 'string' ? (params[E] as number) : E;
    const i = typeof I === 'string' ? (params[I] as number) : I;
    return [
      u - (u * u * u) / 3 - v + i,
      eps * (u + a - b * v),
    ];
  };
}
