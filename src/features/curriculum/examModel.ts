/**
 * Beginner 1 graduation exam (SPEC §7.6) as measurable, separately passable items. Pure rules over exercise
 * results and stored skills; the screen runs the exercises and records passes in progression.exam.
 */
import { BEGINNER_CHORD_CLASSES, voicingForClass } from '../../content/voicings';
import {
  changesPerMinute,
  type OneMinuteResult,
  RECALL_LIMIT_MS,
  type RecallResult,
  type StrumResult,
  type TuningResult,
} from '../../domain/exerciseResults';
import { CORE_PAIRS } from '../../domain/pairs';
import { mulberry32, shuffled } from '../../domain/prng';
import type { SkillState } from '../../domain/records';
import { cleanRatio } from '../../domain/skills';

export const EXAM_TUNING_CENTS = 5;
export const EXAM_CHORD_CLEAN_MIN = 0.5;
export const EXAM_PAIR_COUNT = 5;
export const EXAM_PAIR_CPM = 30;
export const EXAM_PATTERN = { patternId: 'P3', bpm: 80, bars: 8, hitRate: 0.9 } as const;
export const EXAM_SONGS = 5;

/** 1. All six strings in tune within ±5 cents on the tuner (needs the microphone: cents must be measured). */
export function exam1Passed(result: TuningResult): boolean {
  return (
    result.strings.length === 6 &&
    result.strings.every((s) => s.inTune && s.cents !== null && Math.abs(s.cents) <= EXAM_TUNING_CENTS)
  );
}

/** 2. Eight chords in random order: each named chord strummed correctly within 3 s, and its Chord Perfect
 * clean ratio over the last 10 checks ≥ 50 %. */
export function exam2Passed(
  recall: RecallResult,
  skills: ReadonlyMap<string, SkillState>,
  gVoicing: 'G-2f' | 'G-3f',
): { passed: boolean; clean: Record<string, number | null> } {
  const clean: Record<string, number | null> = {};
  for (const cls of BEGINNER_CHORD_CLASSES)
    clean[cls] = cleanRatio(skills.get(`chord:${voicingForClass(cls, gVoicing)}`)) ?? null;
  const asked = new Set(recall.items.map((i) => i.chordClass));
  const allAsked = BEGINNER_CHORD_CLASSES.every((c) => asked.has(c));
  const allInTime = recall.items.every(
    (i) => i.correct && i.reactionMs !== null && i.reactionMs <= RECALL_LIMIT_MS,
  );
  const allClean = BEGINNER_CHORD_CLASSES.every((c) => (clean[c] ?? 0) >= EXAM_CHORD_CLEAN_MIN);
  return { passed: allAsked && allInTime && allClean, clean };
}

/** 3. Five random core pairs, each ≥ 30 changes in one minute. */
export function examPairs(seed: number): [string, string][] {
  return shuffled(mulberry32(seed), CORE_PAIRS)
    .slice(0, EXAM_PAIR_COUNT)
    .map(([a, b]) => [a, b] as [string, string]);
}

export function exam3Passed(results: readonly OneMinuteResult[]): boolean {
  return (
    results.length === EXAM_PAIR_COUNT &&
    results.every((r) => r.durationMs >= 60_000 && changesPerMinute(r) >= EXAM_PAIR_CPM)
  );
}

/** 4. Standard pattern D DU UDU at 80 BPM, 8 bars, hit rate ≥ 90 % — with and without visual cues. */
export function exam4Passed(shown: StrumResult, hidden: StrumResult): boolean {
  const ok = (r: StrumResult) =>
    r.patternId === EXAM_PATTERN.patternId &&
    r.bpm >= EXAM_PATTERN.bpm &&
    r.bars >= EXAM_PATTERN.bars &&
    r.hitRate >= EXAM_PATTERN.hitRate;
  return ok(shown) && ok(hidden) && !shown.cuesHidden && hidden.cuesHidden;
}

/** 5. Five different practice songs completed with the chart hidden (self-reported). */
export function exam5Songs(skills: ReadonlyMap<string, SkillState>): number {
  return [...skills.values()].filter(
    (s) => s.subjectKey.startsWith('song:') && (s.metrics.hiddenCompleted?.best ?? 0) >= 1,
  ).length;
}
