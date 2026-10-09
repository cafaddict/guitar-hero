/**
 * Speaker backing-bleed masking (SPEC v1.1 §10.12, §8.6 policy 3a). The app synthesizes the backing, so it
 * knows every backing event and its sound. For each event the template is the backing buffer's low-band
 * (< 1 kHz) energy rise at that event; the bleed gain is learned from the events the backing plays alone
 * (the one-bar intro before the user joins). An onset candidate within arrival ± maskWindowMs is dropped
 * unless its low-band energy rise exceeds the template prediction by keepLowBandDb — a user strum on top of
 * the backing adds far more low-band energy than the leaked backing can.
 *
 * "Rise" = energy over [t, t + postMs] minus energy over [t − preGapMs − preMs, t − preGapMs]: the rise
 * ignores whatever was already sounding (the user's previous chord), which an absolute level would not.
 */
import { applyBiquad, lowpass } from './filters';

export interface BackingMaskParams {
  maskWindowMs: number;
  keepLowBandDb: number;
  lowBandHz: number;
  postMs: number;
  preMs: number;
  preGapMs: number;
  /** Without intro events the gain is this percentile of the per-event observed/template ratios. */
  fallbackGainPercentile: number;
  /** How far beyond the window an early-refined candidate may sit and still be re-refined (see below). */
  reRefineMs: number;
}

export const DEFAULT_BACKING_MASK_PARAMS: BackingMaskParams = {
  maskWindowMs: 15,
  keepLowBandDb: 6,
  lowBandHz: 1000,
  postMs: 40,
  preMs: 40,
  preGapMs: 5,
  fallbackGainPercentile: 0.5,
  reRefineMs: 30,
};

export interface BackingSchedule {
  /** Arrival of every backing event in the recording (samples: scheduled time + RTT). */
  arrivals: readonly number[];
  /** Template low-band rise of each event, measured on the backing buffer as played. */
  templateRises: readonly number[];
  /** How many leading events the backing plays alone (bleed-gain calibration). */
  introCount: number;
  /** A bleed gain measured earlier (the app learns it from the intro bar before the user plays). */
  gain?: number;
}

function energy(x: ArrayLike<number>, start: number, end: number): number {
  let sum = 0;
  for (let i = Math.max(0, start); i < Math.min(x.length, end); i++) sum += x[i]! * x[i]!;
  return sum;
}

/** Low-band energy rise at sample `at` of an already low-passed signal. */
export function lowBandRise(
  lowpassed: ArrayLike<number>,
  at: number,
  sampleRate: number,
  p: BackingMaskParams,
) {
  const ms = (v: number) => Math.round((v / 1000) * sampleRate);
  const post = energy(lowpassed, at, at + ms(p.postMs));
  const preEnd = at - ms(p.preGapMs);
  const pre = energy(lowpassed, preEnd - ms(p.preMs), preEnd);
  return Math.max(0, post - (pre * p.postMs) / p.preMs);
}

export function lowBand(signal: ArrayLike<number>, sampleRate: number, p: BackingMaskParams): Float32Array {
  return applyBiquad(signal, lowpass(p.lowBandHz, sampleRate));
}

/** Template rises of the backing events (event onsets in samples of the backing buffer). */
export function backingTemplateRises(
  backing: ArrayLike<number>,
  eventSamples: readonly number[],
  sampleRate: number,
  params: BackingMaskParams = DEFAULT_BACKING_MASK_PARAMS,
): number[] {
  const low = lowBand(backing, sampleRate, params);
  return eventSamples.map((s) => lowBandRise(low, s, sampleRate, params));
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))] ?? 0;
}

/** Bleed power gain (recording rise / template rise), from the intro events when there are any. */
export function bleedGain(
  low: ArrayLike<number>,
  sampleRate: number,
  schedule: BackingSchedule,
  params: BackingMaskParams,
): number {
  const ratios = schedule.arrivals.flatMap((a, j) => {
    const tpl = schedule.templateRises[j]!;
    return tpl > 0 ? [lowBandRise(low, a, sampleRate, params) / tpl] : [];
  });
  if (ratios.length === 0) return 0;
  const intro = ratios.slice(0, Math.min(schedule.introCount, ratios.length));
  return intro.length > 0 ? percentile(intro, 0.5) : percentile(ratios, params.fallbackGainPercentile);
}

/** Index of the arrival within ±win of `sample`, nearest first, or −1. */
function nearestArrival(arrivals: readonly number[], sample: number, win: number): number {
  let near = -1;
  let best = Number.POSITIVE_INFINITY;
  arrivals.forEach((a, j) => {
    const d = Math.abs(a - sample);
    if (d <= win && d < best) {
      best = d;
      near = j;
    }
  });
  return near;
}

/**
 * For each candidate onset (samples): false = backing bleed to drop, true = keep.
 *
 * A weak onset over a ringing chord can be refined too early (a fluctuation before it crosses the refinement
 * threshold first). When a backing event arrives just after such a candidate (within maskWindowMs +
 * `reRefineMs`), `reRefine(i, from)` refines it again with crossings before `arrival − maskWindowMs` ignored;
 * if that lands inside the window, the candidate is that backing event. The keep test always uses the
 * candidate's own onset, so a user strum played early against the backing keeps its time and its rise.
 */
export function backingKeepFlags(
  signal: ArrayLike<number>,
  sampleRate: number,
  candidateSamples: readonly number[],
  schedule: BackingSchedule,
  reRefine?: (index: number, fromSample: number) => number,
  params: BackingMaskParams = DEFAULT_BACKING_MASK_PARAMS,
): boolean[] {
  if (schedule.arrivals.length === 0) return candidateSamples.map(() => true);
  const low = lowBand(signal, sampleRate, params);
  const gain = schedule.gain ?? bleedGain(low, sampleRate, schedule, params);
  const win = (params.maskWindowMs / 1000) * sampleRate;
  const reach = ((params.maskWindowMs + params.reRefineMs) / 1000) * sampleRate;
  const keepFactor = 10 ** (params.keepLowBandDb / 10);
  return candidateSamples.map((c, i) => {
    let near = nearestArrival(schedule.arrivals, c, win);
    if (near < 0 && reRefine) {
      const later = schedule.arrivals.findIndex((a) => a - c > win && a - c <= reach);
      if (later >= 0) {
        const a = schedule.arrivals[later]!;
        if (Math.abs(reRefine(i, a - win) - a) <= win) near = later;
      }
    }
    if (near < 0) return true;
    const predicted = gain * schedule.templateRises[near]!;
    return lowBandRise(low, c, sampleRate, params) >= keepFactor * predicted;
  });
}
