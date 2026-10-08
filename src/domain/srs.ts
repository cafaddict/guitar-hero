/**
 * Review queue (spaced repetition) and weekly streak (SPEC v1.1 §7.5). Pure.
 * Graduated items (chords, pairs, patterns, scale steps, riffs) and knowledge cards use the fixed ladder
 * 1 → 3 → 7 → 14 → 30 → 90 days (research 01:269, 01:353; D-055); songs use 1 week … 1 year (01:363).
 */
import { DAY_MS, dayKey, type ReviewItem, type ReviewKind } from './records';

/** Graduated chords, pairs, patterns, scale steps, riffs and knowledge cards: 1 → 3 → 7 → 14 → 30 → 90 days. */
export const REVIEW_INTERVALS_DAYS: readonly number[] = [1, 3, 7, 14, 30, 90];
/** Songs: 1 week → 2 weeks → 1 month → 3 months → 6 months → 1 year. */
export const SONG_REVIEW_INTERVALS_DAYS: readonly number[] = [7, 14, 30, 90, 180, 365];

export function intervalsFor(kind: ReviewKind): readonly number[] {
  return kind === 'song' ? SONG_REVIEW_INTERVALS_DAYS : REVIEW_INTERVALS_DAYS;
}

export function enqueueReview(subjectKey: string, kind: ReviewKind, now: number): ReviewItem {
  return {
    subjectKey,
    kind,
    step: 0,
    due: now + intervalsFor(kind)[0]! * DAY_MS,
    enqueuedAt: now,
    lastReviewedAt: null,
    lapses: 0,
  };
}

/** Pass → next (longer) interval; fail → one step back (SPEC §7.5 "복습 실패 시 한 단계 후퇴"). */
export function recordReview(item: ReviewItem, passed: boolean, now: number): ReviewItem {
  const intervals = intervalsFor(item.kind);
  const step = passed ? Math.min(item.step + 1, intervals.length - 1) : Math.max(item.step - 1, 0);
  return {
    ...item,
    step,
    due: now + intervals[step]! * DAY_MS,
    lastReviewedAt: now,
    lapses: item.lapses + (passed ? 0 : 1),
  };
}

/** A knowledge card answer counts as "fast" under this reaction time (SPEC v1.1 §7.5). */
export const CARD_FAST_MS = 3000;

/**
 * Knowledge cards (Q2 chord cards, Q3 note cards, Q4 question types — SPEC v1.1 §7.5): a new card starts at
 * 1 day; correct and < 3 s → next interval, correct but slow → same interval, wrong → back to 1 day.
 */
export function recordCardAnswer(
  card: ReviewItem | undefined,
  subjectKey: string,
  correct: boolean,
  reactionMs: number | null,
  now: number,
): ReviewItem {
  const intervals = intervalsFor('card');
  if (!card) {
    return {
      subjectKey,
      kind: 'card',
      step: 0,
      due: now + intervals[0]! * DAY_MS,
      enqueuedAt: now,
      lastReviewedAt: now,
      lapses: correct ? 0 : 1,
    };
  }
  const fast = correct && reactionMs !== null && reactionMs < CARD_FAST_MS;
  const step = !correct ? 0 : fast ? Math.min(card.step + 1, intervals.length - 1) : card.step;
  return {
    ...card,
    step,
    due: now + intervals[step]! * DAY_MS,
    lastReviewedAt: now,
    lapses: card.lapses + (correct ? 0 : 1),
  };
}

export function dueReviews(items: readonly ReviewItem[], now: number): ReviewItem[] {
  return items
    .filter((item) => item.due <= now)
    .sort((a, b) => a.due - b.due || a.subjectKey.localeCompare(b.subjectKey));
}

/** Monday-based week index, local time. */
export function weekIndex(ms: number): number {
  const d = new Date(ms);
  d.setHours(12, 0, 0, 0);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  // Days since a fixed Monday (1970-01-05) / 7, rounded to absorb DST hour shifts.
  return Math.round((d.getTime() - new Date(1970, 0, 5, 12).getTime()) / (7 * DAY_MS));
}

/** Days with practice per week index. */
function practiceDaysByWeek(practiceTimes: readonly number[]): Map<number, Set<string>> {
  const byWeek = new Map<number, Set<string>>();
  for (const t of practiceTimes) {
    const w = weekIndex(t);
    const set = byWeek.get(w) ?? new Set<string>();
    set.add(dayKey(t));
    byWeek.set(w, set);
  }
  return byWeek;
}

export const STREAK_MIN_DAYS_PER_WEEK = 4;

/**
 * Weekly streak (SPEC §7.5): number of consecutive weeks with practice on ≥ 4 distinct days.
 * The current week counts once it qualifies; an unfinished current week never breaks the streak.
 */
export function weeklyStreak(practiceTimes: readonly number[], now: number): number {
  const byWeek = practiceDaysByWeek(practiceTimes);
  const qualifies = (w: number) => (byWeek.get(w)?.size ?? 0) >= STREAK_MIN_DAYS_PER_WEEK;
  const current = weekIndex(now);
  let streak = qualifies(current) ? 1 : 0;
  for (let w = current - 1; qualifies(w); w--) streak++;
  return streak;
}
