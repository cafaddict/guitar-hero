/**
 * Which onset a single-take judgement (pluck, strum, recall strum) analyses — shared by the app runners and
 * the benchmarks, so the benchmark never uses ground truth to pick the event.
 *
 * The first detected strum event after arming is analysed. Another event inside the analysis span
 * (+400 ms) means the take is ambiguous → RETRY(MULTIPLE_ONSETS). No event → RETRY(NO_ONSET).
 */
import type { StrumEvent } from './onset';
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
