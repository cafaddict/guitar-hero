/**
 * Which onset a single-take judgement (pluck, strum, recall strum) analyses — shared by the app runners and
 * the benchmarks, so the benchmark never uses ground truth to pick the event.
 *
 * The first detected strum event after arming is analysed. Another event inside the analysis span
 * (+400 ms) means the take is ambiguous → RETRY(MULTIPLE_ONSETS). No event → RETRY(NO_ONSET).
 */
import { DEFAULT_ONSET_PARAMS, refineOnset, type StrumEvent } from './onset';
import { rms } from './spectrum';
import type { RetryReason } from './types';

export const TAKE_SPAN_MS = 400;

export type TakeSelection =
  | { ok: true; event: StrumEvent }
  | { ok: false; reason: Extract<RetryReason, 'NO_ONSET' | 'MULTIPLE_ONSETS'> };

export function selectTakeEvent(
  events: readonly StrumEvent[],
  sampleRate: number,
  armedAtSample = 0,
): TakeSelection {
  const after = events.filter((e) => e.sample >= armedAtSample);
  const first = after[0];
  if (!first) return { ok: false, reason: 'NO_ONSET' };
  const span = (TAKE_SPAN_MS / 1000) * sampleRate;
  if (after.some((e) => e !== first && e.sample - first.sample <= span))
    return { ok: false, reason: 'MULTIPLE_ONSETS' };
  return { ok: true, event: first };
}

/**
 * Pluck fallback (Mode A): after the prompt "pluck string n" exactly one note is expected. When the spectral-
 * flux detector found nothing inside the armed window (a very soft or slow pluck), take the first point where
 * the 5 ms RMS envelope rises ≥ riseDb above the 25th-percentile 5 ms level of the 150 ms before it (robust to a
 * still-ringing earlier note and to near-silent gaps) and stays there for 30 ms; then refine it like any onset. Returns the onset sample or null.
 */
export function energyOnset(
  signal: ArrayLike<number>,
  sampleRate: number,
  fromSample: number,
  toSample: number,
  riseDb = 12,
): number | null {
  const win = Math.max(1, Math.round(0.005 * sampleRate));
  const hold = Math.round(0.03 * sampleRate);
  const lookback = Math.round(0.15 * sampleRate);
  const env = (start: number) => rms(signal, start, start + win);
  const ratio = 10 ** (riseDb / 20);
  for (
    let s = Math.max(fromSample, lookback);
    s + hold + win <= Math.min(toSample + hold, signal.length);
    s += win
  ) {
    const levels: number[] = [];
    for (let b = s - lookback; b + win <= s; b += win) levels.push(env(b));
    levels.sort((x, y) => x - y);
    const base = levels[Math.floor(levels.length * 0.25)] ?? 0;
    const threshold = Math.max(base, 1e-6) * ratio;
    if (env(s) < threshold) continue;
    let sustained = true;
    for (let k = s + win; k < s + hold; k += win) if (env(k) < threshold) sustained = false;
    if (!sustained) continue;
    const frameLength = Math.round((DEFAULT_ONSET_PARAMS.frameMs / 1000) * sampleRate);
    return refineOnset(signal, s + win, frameLength, sampleRate, DEFAULT_ONSET_PARAMS);
  }
  return null;
}
