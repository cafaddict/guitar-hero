/**
 * Derived state from attempts (SPEC §13.1-3): metric samples, skill states and the review queue are caches
 * that can always be recomputed by replaying attempts in order through applyAttempt().
 */
import { modeOpenBpm } from '../content/patterns';
import { RIFF_TARGET_EXTRA_BPM, RIFFS } from '../content/riffs';
import {
  extractMetrics,
  quizResultSchema,
  recallResultSchema,
  SCALE_GRADUATION_BPM,
} from './exerciseResults';
import { graduatedItems } from './progression';
import { type Attempt, dayKey, type MetricSample, type ReviewItem, type SkillState } from './records';
import { applySample } from './skills';
import { enqueueReview, recordCardAnswer, recordReview } from './srs';

export interface DerivedState {
  skills: Map<string, SkillState>;
  reviews: Map<string, ReviewItem>;
}

export interface AttemptDerivation {
  samples: MetricSample[];
  changedSkills: SkillState[];
  changedReviews: ReviewItem[];
}

/** Whether a review attempt passed, judged from the attempt's own samples. */
export function reviewPassed(reviewOf: string, samples: readonly MetricSample[]): boolean {
  const mine = samples.filter((s) => s.subjectKey === reviewOf);
  if (reviewOf.startsWith('chord:')) return mine.some((s) => s.metric === 'clean' && s.value >= 1);
  if (reviewOf.startsWith('pair:')) {
    // Pair reviews are run as a directed one-minute change; the undirected pair sample carries the score.
    return mine.some((s) => s.metric === 'cpm' && s.value >= 30);
  }
  if (reviewOf.startsWith('strum:')) {
    // A pattern review passes at the tempo its modes graduate at (SPEC v1.1 §6.10).
    const target = modeOpenBpm(reviewOf.slice('strum:'.length));
    return mine.some((s) => s.metric === 'passBpm' && s.value >= target);
  }
  // A song review is a perform-stage run to the end with ≤ 2 stops (SPEC v1.1 §11.10 "완주").
  if (reviewOf.startsWith('song:')) return mine.some((s) => s.metric === 'performCompleted' && s.value >= 1);
  // Scale steps and riffs pass a review the way they graduated (SPEC v1.1 §11.13, §11.19, §7.5).
  if (reviewOf.startsWith('scale:'))
    return mine.some((s) => s.metric === 'streakBpm' && s.value >= SCALE_GRADUATION_BPM);
  if (reviewOf.startsWith('riff:')) {
    const riff = RIFFS.find((r) => r.id === reviewOf.slice('riff:'.length));
    return (
      riff !== undefined &&
      mine.some((s) => s.metric === 'passBpm' && s.value >= riff.bpm + RIFF_TARGET_EXTRA_BPM)
    );
  }
  return false;
}

/** Knowledge-card answers carried by an attempt (SPEC v1.1 §7.5): Q2 chord cards, Q3 note cards, Q4 type cards. */
export function cardAnswers(
  attempt: Pick<Attempt, 'exerciseType' | 'result'>,
): { subjectKey: string; correct: boolean; reactionMs: number | null }[] {
  if (attempt.exerciseType === 'Q3' || attempt.exerciseType === 'Q4') {
    const quiz = quizResultSchema.safeParse(attempt.result);
    if (!quiz.success) return [];
    return (quiz.data.items ?? []).map((i) => ({
      subjectKey: i.card,
      correct: i.correct,
      reactionMs: i.reactionMs,
    }));
  }
  if (attempt.exerciseType !== 'Q2') return [];
  const parsed = recallResultSchema.safeParse(attempt.result);
  if (!parsed.success) return [];
  return parsed.data.items.map((item) => ({
    subjectKey: `card:recall:${item.chordClass}`,
    correct: item.correct,
    reactionMs: item.reactionMs,
  }));
}

/** The metric samples one attempt produces (the same extraction rebuilds and increments use). */
export function samplesOf(
  attempt: Pick<Attempt, 'id' | 'exerciseType' | 'result' | 'endedAt'>,
): MetricSample[] {
  return extractMetrics(attempt.exerciseType, attempt.result).map((input) => ({
    ...input,
    at: attempt.endedAt,
    day: dayKey(attempt.endedAt),
    attemptId: attempt.id,
  }));
}

/** Applies one attempt to the derived state (mutates `state`) and reports what changed. */
export function applyAttempt(state: DerivedState, attempt: Attempt): AttemptDerivation {
  const samples = samplesOf(attempt);
  const touched = new Map<string, SkillState>();
  for (const sample of samples) {
    const next = applySample(state.skills.get(sample.subjectKey), sample);
    state.skills.set(sample.subjectKey, next);
    touched.set(sample.subjectKey, next);
  }
  const changedReviews = new Map<string, ReviewItem>();
  if (attempt.reviewOf) {
    const item = state.reviews.get(attempt.reviewOf);
    // A review moves one step per due date: repeats of the same block (rule 12) do not move it again (§7.5).
    if (item && item.due <= attempt.startedAt) {
      const next = recordReview(item, reviewPassed(attempt.reviewOf, samples), attempt.endedAt);
      state.reviews.set(item.subjectKey, next);
      changedReviews.set(item.subjectKey, next);
    }
  }
  for (const answer of cardAnswers(attempt)) {
    const card = state.reviews.get(answer.subjectKey);
    // A card is graded when it is new or due; a repeat within the same interval does not move it (§7.5).
    if (card && card.due > attempt.startedAt) continue;
    const next = recordCardAnswer(
      card,
      answer.subjectKey,
      answer.correct,
      answer.reactionMs,
      attempt.endedAt,
    );
    state.reviews.set(next.subjectKey, next);
    changedReviews.set(next.subjectKey, next);
  }
  for (const graduation of graduatedItems(touched)) {
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
