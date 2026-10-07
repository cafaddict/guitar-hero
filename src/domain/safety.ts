/**
 * Practice safety rules (SPEC §7.3 rules 1, 7, 8; research 01 §5.7). Pure.
 * Wording that reaches the user carries "의학적 조언이 아닙니다" (rendered via i18n).
 */
import { DAY_MS, type SelfReport } from './records';

export const DEFAULT_SESSION_MINUTES = 20;
export const EARLY_PERIOD_DAYS = 28;
export const EARLY_CAP_MINUTES = 20;
export const PAIN_REDUCTION_THRESHOLD = 5;
export const PAIN_REDUCTION_FACTOR = 0.5;
export const BREAK_AFTER_MS = 30 * 60_000;

export interface SessionLengthDecision {
  minutes: number;
  /** The user asked for more than the early-period cap and has not confirmed yet. */
  needsConfirmation: boolean;
  capped: boolean;
}

/** First four weeks: sessions are capped at 20 minutes unless the user confirms (rule 1). */
export function decideSessionLength(
  requestedMinutes: number,
  firstPracticeAt: number | null,
  now: number,
  confirmedOverCap: boolean,
): SessionLengthDecision {
  const inEarlyPeriod = firstPracticeAt === null || now - firstPracticeAt < EARLY_PERIOD_DAYS * DAY_MS;
  if (!inEarlyPeriod || requestedMinutes <= EARLY_CAP_MINUTES) {
    return { minutes: requestedMinutes, needsConfirmation: false, capped: false };
  }
  if (confirmedOverCap) return { minutes: requestedMinutes, needsConfirmation: false, capped: false };
  return { minutes: EARLY_CAP_MINUTES, needsConfirmation: true, capped: true };
}

export type PainAdvice = 'none' | 'reduceFingertipLoad' | 'restDay';

/** Rule 7: danger symptoms → rest day; pain ≥ 5/10 → halve fingertip-load items (E1, E2). */
export function painAdvice(lastReport: SelfReport | null): PainAdvice {
  if (!lastReport) return 'none';
  if (lastReport.dangerFlags.length > 0) return 'restDay';
  if (lastReport.pain >= PAIN_REDUCTION_THRESHOLD) return 'reduceFingertipLoad';
  return 'none';
}

/** Exercise types that load the fingertips (rule 7). */
export const FINGERTIP_LOAD_TYPES: ReadonlySet<string> = new Set(['E1', 'E2']);

/**
 * Rule 8: break reminder after 30 minutes of continuous practice. `continuousMs` is measured from the
 * session start or the last break, by clock difference (not tick counting).
 */
export function breakReminderDue(continuousMs: number): boolean {
  return continuousMs >= BREAK_AFTER_MS;
}

/** E7 stretch progression (SPEC §11.8): three sessions with pain ≤ 2 → start one fret lower (min 1). */
export function nextStretchStartFret(currentStartFret: number, recentPains: readonly number[]): number {
  const lastThree = recentPains.slice(-3);
  if (lastThree.length === 3 && lastThree.every((p) => p <= 2)) return Math.max(1, currentStartFret - 1);
  return currentStartFret;
}
