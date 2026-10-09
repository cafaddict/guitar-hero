/**
 * Bar dynamics (SPEC v1.1 §10.11, beta). Each strum's peak short-time RMS (dB) is taken relative to the run
 * median; a bar's mean relative level ≥ +loudDb is "loud", ≤ −softDb "soft", otherwise "even" (the exercise
 * asks for ±6 dB changes, so half of that separates them).
 */
import { msToSamples, rms } from '../spectrum';
import { type BetaResult, beta } from './types';

export type BarDynamics = 'soft' | 'loud' | 'even';

export interface DynamicsParams {
  windowMs: number;
  frameMs: number;
  loudDb: number;
  softDb: number;
}

export const DEFAULT_DYNAMICS_PARAMS: DynamicsParams = { windowMs: 60, frameMs: 10, loudDb: 3, softDb: 3 };

/** Peak short-time RMS (dB) of each event over [onset, onset + windowMs]. */
export function eventLevelsDb(
  samples: ArrayLike<number>,
  sampleRate: number,
  onsets: readonly number[],
  params: DynamicsParams = DEFAULT_DYNAMICS_PARAMS,
): number[] {
  const frame = msToSamples(params.frameMs, sampleRate);
  const span = msToSamples(params.windowMs, sampleRate);
  return onsets.map((o) => {
    let peak = 0;
    for (let s = o; s + frame <= o + span; s += Math.max(1, frame >> 1))
      peak = Math.max(peak, rms(samples, s, s + frame));
    return 20 * Math.log10(peak + 1e-12);
  });
}

/** Per-bar label from event levels (bar index per event). */
export function barDynamics(
  levelsDb: readonly number[],
  barOf: readonly number[],
  bars: number,
  params: DynamicsParams = DEFAULT_DYNAMICS_PARAMS,
): BetaResult<BarDynamics>[] {
  const sorted = [...levelsDb].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length === 0 ? 0 : sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Array.from({ length: bars }, (_, bar) => {
    const rel = levelsDb.filter((_, i) => barOf[i] === bar).map((l) => l - median);
    if (rel.length === 0) return beta<BarDynamics>('even', 0);
    const mean = rel.reduce((a, b) => a + b, 0) / rel.length;
    const value: BarDynamics = mean >= params.loudDb ? 'loud' : mean <= -params.softDb ? 'soft' : 'even';
    return beta(value, Math.min(1, Math.abs(mean) / (2 * params.loudDb)));
  });
}
