/**
 * Pitch estimation (SPEC §10.3): McLeod Pitch Method (NSDF) with optional search-range restriction,
 * plus a harmonic-regression refinement that removes the inharmonicity bias of time-domain periodicity
 * (f_h/h = f0·√(1+B·h²) ≈ f0 + (f0·B/2)·h², so the intercept of a weighted fit over partials is f0).
 */
import { inverseRealFft, nextPow2, realFft } from './fft';
import { magnitudeSpectrum, partialPeak, type Spectrum } from './spectrum';

export interface PitchEstimate {
  f0: number;
  /** NSDF peak value (0..1): periodicity confidence. */
  clarity: number;
}

interface AcfScratch {
  buf: Float64Array;
  re: Float64Array;
  im: Float64Array;
  acf: Float64Array;
}
const acfScratch = new Map<number, AcfScratch>();

function scratchFor(n: number): AcfScratch {
  let s = acfScratch.get(n);
  if (!s) {
    s = {
      buf: new Float64Array(n),
      re: new Float64Array(n / 2 + 1),
      im: new Float64Array(n / 2 + 1),
      acf: new Float64Array(n),
    };
    acfScratch.set(n, s);
  }
  return s;
}

/**
 * Normalized square difference function n'(τ) = 2·r(τ)/m(τ) for τ in [0, maxLag], written into `out`.
 * r via FFT autocorrelation; m incrementally.
 */
export function nsdf(
  signal: ArrayLike<number>,
  start: number,
  length: number,
  maxLag: number,
  out: Float64Array,
): void {
  const n = nextPow2(2 * length);
  const s = scratchFor(n);
  start = Math.round(start);
  s.buf.fill(0);
  for (let i = 0; i < length; i++) {
    const idx = start + i;
    s.buf[i] = idx >= 0 && idx < signal.length ? signal[idx]! : 0;
  }
  realFft(s.buf, n, s.re, s.im);
  for (let k = 0; k <= n / 2; k++) {
    s.re[k] = s.re[k]! * s.re[k]! + s.im[k]! * s.im[k]!;
    s.im[k] = 0;
  }
  inverseRealFft(s.re, s.im, n, s.acf);
  let m = 2 * s.acf[0]!;
  const lagMax = Math.min(maxLag, length - 1);
  for (let tau = 0; tau <= lagMax; tau++) {
    if (tau > 0) {
      const a = s.buf[tau - 1]!;
      const b = s.buf[length - tau]!;
      m -= a * a + b * b;
    }
    out[tau] = m > 1e-12 ? (2 * s.acf[tau]!) / m : 0;
  }
}

const nsdfBuffers = new Map<number, Float64Array>();
function nsdfBuffer(size: number): Float64Array {
  let b = nsdfBuffers.get(size);
  if (!b) {
    b = new Float64Array(size);
    nsdfBuffers.set(size, b);
  }
  return b;
}

function parabolicPeak(values: Float64Array, i: number): { x: number; y: number } {
  const a = values[i - 1] ?? values[i]!;
  const b = values[i]!;
  const c = values[i + 1] ?? values[i]!;
  const denom = a - 2 * b + c;
  if (denom >= 0) return { x: i, y: b };
  const delta = Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom));
  return { x: i + delta, y: b - 0.25 * (a - c) * delta };
}

/**
 * MPM on one frame. With `restricted` the global NSDF maximum inside [fs/maxHz, fs/minHz] wins (the
 * caller knows the expected pitch, so octave errors are excluded by range). Otherwise McLeod's key-maximum
 * rule picks the first key maximum ≥ k·(highest key maximum).
 */
export function mpm(
  signal: ArrayLike<number>,
  start: number,
  length: number,
  sampleRate: number,
  minHz: number,
  maxHz: number,
  options: { restricted: boolean; k?: number } = { restricted: false },
): PitchEstimate | null {
  const minLag = Math.max(2, Math.floor(sampleRate / maxHz));
  const maxLag = Math.min(length - 2, Math.ceil(sampleRate / minHz));
  if (maxLag <= minLag) return null;
  const values = nsdfBuffer(nextPow2(length + 2));
  nsdf(signal, start, length, maxLag + 1, values);
  let chosen = -1;
  if (options.restricted) {
    let best = Number.NEGATIVE_INFINITY;
    for (let tau = minLag; tau <= maxLag; tau++) {
      const v = values[tau]!;
      if (v > best && v >= values[tau - 1]! && v >= (values[tau + 1] ?? v)) {
        best = v;
        chosen = tau;
      }
    }
  } else {
    // Key maxima: the highest value between consecutive positive-going zero crossings.
    const keys: number[] = [];
    let tau = 1;
    while (tau <= maxLag && values[tau]! > 0) tau++;
    while (tau <= maxLag) {
      while (tau <= maxLag && values[tau]! <= 0) tau++;
      let bestTau = -1;
      let bestVal = 0;
      while (tau <= maxLag && values[tau]! > 0) {
        if (values[tau]! > bestVal) {
          bestVal = values[tau]!;
          bestTau = tau;
        }
        tau++;
      }
      if (bestTau >= minLag) keys.push(bestTau);
    }
    if (keys.length === 0) return null;
    const highest = Math.max(...keys.map((t) => values[t]!));
    const k = options.k ?? 0.9;
    chosen = keys.find((t) => values[t]! >= k * highest) ?? keys[0]!;
  }
  if (chosen < 0) return null;
  const peak = parabolicPeak(values, chosen);
  return { f0: sampleRate / peak.x, clarity: Math.max(0, Math.min(1, peak.y)) };
}

export interface HarmonicFit {
  f0: number;
  /** Estimated inharmonicity B (may be ~0 or noisy when few partials are present). */
  b: number;
  partialsUsed: number;
}

/**
 * Refines a coarse f0 by locating partials h = 1..maxPartials near h·f0·√(1+B·h²) and fitting
 * f_h/h = f0 + c·h² by weighted least squares (weights ∝ (amplitude·h)²). Partials below
 * `minMag` (absolute amplitude) are ignored. Falls back to the strongest single partial.
 */
export function refineHarmonic(
  spec: Spectrum,
  coarseF0: number,
  options: { maxPartials?: number; maxHz?: number; minMag?: number; priorB?: number; tolCents?: number } = {},
): HarmonicFit {
  const maxPartials = options.maxPartials ?? 12;
  const maxHz = options.maxHz ?? 5000;
  const minMag = options.minMag ?? 0;
  const priorB = options.priorB ?? 5e-5;
  const tol = options.tolCents ?? 40;
  const xs: number[] = [];
  const ys: number[] = [];
  const ws: number[] = [];
  for (let h = 1; h <= maxPartials; h++) {
    const expected = h * coarseF0 * Math.sqrt(1 + priorB * h * h);
    if (expected > maxHz) break;
    const peak = partialPeak(spec, expected, tol);
    if (peak.mag <= minMag) continue;
    // Skip peaks pinned to the search edge (no real partial inside the window).
    const edge = Math.abs(1200 * Math.log2(peak.hz / expected));
    if (edge > tol * 0.95) continue;
    xs.push(h * h);
    ys.push(peak.hz / h);
    ws.push((peak.mag * h) ** 2);
  }
  if (xs.length === 0) return { f0: coarseF0, b: 0, partialsUsed: 0 };
  if (xs.length < 3) {
    // Not enough partials to fit a slope: use the weighted mean of f_h/h (B prior corrected).
    let sw = 0;
    let sy = 0;
    for (let i = 0; i < xs.length; i++) {
      sw += ws[i]!;
      sy += (ws[i]! * ys[i]!) / Math.sqrt(1 + priorB * xs[i]!);
    }
    return { f0: sy / sw, b: priorB, partialsUsed: xs.length };
  }
  let sw = 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const w = ws[i]!;
    sw += w;
    sx += w * xs[i]!;
    sy += w * ys[i]!;
    sxx += w * xs[i]! * xs[i]!;
    sxy += w * xs[i]! * ys[i]!;
  }
  const det = sw * sxx - sx * sx;
  if (Math.abs(det) < 1e-12 * sw * sxx) return { f0: sy / sw, b: 0, partialsUsed: xs.length };
  let slope = (sw * sxy - sx * sy) / det;
  // Stiffness can only raise partials; clamp an implausible negative slope to zero.
  if (slope < 0) slope = 0;
  const f0 = (sy - slope * sx) / sw;
  return { f0, b: (2 * slope) / f0, partialsUsed: xs.length };
}

/** Convenience: spectrum of a window and harmonic refinement in one call. */
export function refineInWindow(
  signal: ArrayLike<number>,
  start: number,
  length: number,
  sampleRate: number,
  coarseF0: number,
  minMag: number,
): HarmonicFit {
  const spec = magnitudeSpectrum(signal, start, length, sampleRate, 4);
  return refineHarmonic(spec, coarseF0, { minMag });
}
