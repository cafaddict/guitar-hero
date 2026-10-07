/**
 * Derived state from attempts (SPEC §13.1-3): metric samples, skill states and the review queue are caches
 * that can always be recomputed by replaying attempts in order through applyAttempt().
 */
import { patternById, STRUM_PATTERNS } from '../content/patterns';
import { extractMetrics } from './exerciseResults';
import { graduatedItems } from './progression';
import { type Attempt, dayKey, type MetricSample, type ReviewItem, type SkillState } from './records';
import { applySample } from './skills';
import { enqueueReview, recordReview } from './srs';

export interface DerivedState {
  skills: Map<string, SkillState>;
  reviews: Map<string, ReviewItem>;
}

export interface AttemptDerivation {
  samples: MetricSample[];
  changedSkills: SkillState[];
  changedReviews: ReviewItem[];
}

export const PATTERN_TARGETS: Readonly<Record<string, number>> = Object.fromEntries(
  STRUM_PATTERNS.filter((p) => p.targetBpm !== undefined).map((p) => [p.id, p.targetBpm!]),
);

/** Whether a review attempt passed, judged from the attempt's own samples. */
export function reviewPassed(reviewOf: string, samples: readonly MetricSample[]): boolean {
  const mine = samples.filter((s) => s.subjectKey === reviewOf);
  if (reviewOf.startsWith('chord:')) return mine.some((s) => s.metric === 'clean' && s.value >= 1);
  if (reviewOf.startsWith('pair:')) {
    // Pair reviews are run as a directed one-minute change; the undirected pair sample carries the score.
    return mine.some((s) => s.metric === 'cpm' && s.value >= 30);
  }
  if (reviewOf.startsWith('strum:')) {
    const target = patternById(reviewOf.slice('strum:'.length)).targetBpm ?? 0;
    return mine.some((s) => s.metric === 'passBpm' && s.value >= target);
  }
  if (reviewOf.startsWith('song:')) return mine.some((s) => s.metric === 'completed' && s.value >= 1);
  return false;
}

/** Applies one attempt to the derived state (mutates `state`) and reports what changed. */
export function applyAttempt(state: DerivedState, attempt: Attempt): AttemptDerivation {
  const samples: MetricSample[] = extractMetrics(attempt.exerciseType, attempt.result).map((input) => ({
    ...input,
    at: attempt.endedAt,
    day: dayKey(attempt.endedAt),
    attemptId: attempt.id,
  }));
  const touched = new Map<string, SkillState>();
  for (const sample of samples) {
    const next = applySample(state.skills.get(sample.subjectKey), sample);
    state.skills.set(sample.subjectKey, next);
    touched.set(sample.subjectKey, next);
  }
  const changedReviews = new Map<string, ReviewItem>();
  if (attempt.reviewOf) {
    const item = state.reviews.get(attempt.reviewOf);
    if (item) {
      const next = recordReview(item, reviewPassed(attempt.reviewOf, samples), attempt.endedAt);
      state.reviews.set(item.subjectKey, next);
      changedReviews.set(item.subjectKey, next);
    }
  }
  for (const graduation of graduatedItems(touched, PATTERN_TARGETS)) {
    if (state.reviews.has(graduation.subjectKey)) continue;
    const item = enqueueReview(graduation.subjectKey, graduation.kind, attempt.endedAt);
    state.reviews.set(item.subjectKey, item);
    changedReviews.set(item.subjectKey, item);
  }
  return { samples, changedSkills: [...touched.values()], changedReviews: [...changedReviews.values()] };
}

export function compareAttempts(a: Attempt, b: Attempt): number {
  return a.endedAt - b.endedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Replays every attempt from scratch. */
export function deriveAll(attempts: readonly Attempt[]): DerivedState & { samples: MetricSample[] } {
  const state: DerivedState = { skills: new Map(), reviews: new Map() };
  const samples: MetricSample[] = [];
  for (const attempt of [...attempts].sort(compareAttempts))
    samples.push(...applyAttempt(state, attempt).samples);
  return { ...state, samples };
}
