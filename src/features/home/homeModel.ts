/**
 * Pure assembly of what the home screen and the session runner need (SPEC v1.1 §12.1 홈, §7.3): the routine input
 * from stored state, this week's practice time, weak pairs, the backup reminder and the stage checklist.
 */
import type { PracticeSong, RoutineTemplate, StageDef } from '../../content/schemas';
import type { Settings } from '../../data/settings';
import type { PracticeHistory } from '../../domain/history';
import { pairKey, parsePairId } from '../../domain/pairs';
import { deriveSeed } from '../../domain/prng';
import { evaluateStage, type StageEvaluation, unlockedPairIds } from '../../domain/progression';
import {
  DAY_MS,
  dayKey,
  type MetricSample,
  type ProgressionState,
  type ReviewItem,
  type Session,
  type SkillState,
  sessionPracticeMs,
} from '../../domain/records';
import type { RoutineInput } from '../../domain/routine';
import { recentMedian } from '../../domain/skills';
import { dueReviews, weekIndex, weeklyStreak } from '../../domain/srs';

export const BACKUP_REMINDER_DAYS = 7;
export const EXAM_ITEMS = ['1', '2', '3', '4', '5'] as const;
/** Metric samples this many days back are loaded for stagnation (14 days) and plateau (21 days) windows. */
export const RECENT_SAMPLE_DAYS = 22;

export interface StoredState {
  progression: ProgressionState;
  settings: Settings;
  skills: ReadonlyMap<string, SkillState>;
  reviews: readonly ReviewItem[];
  sessions: readonly Session[];
  /** One-minute-change / PFC attempts started today. */
  changesDoneToday: number;
  curriculum: readonly StageDef[];
  songs: readonly PracticeSong[];
  /** Session numbers, practice days and last appearances (SPEC v1.1 §7.3 input). */
  history: PracticeHistory;
  /** Metric samples of the last RECENT_SAMPLE_DAYS days (stagnation, conditional promotion). */
  recentSamples: readonly MetricSample[];
  /** Today's E7 start fret from the stretch records. */
  stretchStartFret: number;
  /** Saved user routine templates (one per stage, §7.3-9). */
  userTemplates: readonly RoutineTemplate[];
}

const finished = (sessions: readonly Session[]) => sessions.filter((s) => s.endedAt !== null);

/** The user's saved template for a stage, if any. */
export function userTemplateFor(
  templates: readonly RoutineTemplate[],
  stage: number,
): RoutineTemplate | null {
  return templates.find((t) => t.source === 'user' && t.stage === stage) ?? null;
}

export function examPassed(progression: ProgressionState): boolean {
  return EXAM_ITEMS.every((item) => progression.exam[item] !== undefined);
}

export function routineInputFrom(state: StoredState, now: number): RoutineInput {
  const done = finished(state.sessions).sort((a, b) => a.startedAt - b.startedAt);
  const last = done.at(-1);
  return {
    stage: state.progression.stage,
    curriculum: state.curriculum,
    songs: state.songs,
    gVoicing: state.progression.gVoicing,
    skills: state.skills,
    now,
    lastPracticeAt: last?.startedAt ?? null,
    firstPracticeAt: done[0]?.startedAt ?? null,
    lastSelfReport: last?.selfReport ?? null,
    sessionMinutes: state.settings.sessionLengthMode === 'custom' ? state.settings.sessionMinutes : null,
    confirmedOverCap: state.settings.confirmedOverCap,
    dueReviews: dueReviews(state.reviews, now),
    changesDoneToday: state.changesDoneToday,
    prescriptions: state.progression.prescriptions,
    history: state.history,
    sessionsInStage: state.progression.sessionsInStage,
    stretchStartFret: state.stretchStartFret,
    userTemplate: userTemplateFor(state.userTemplates, state.progression.stage),
    // Same day → same routine (SPEC §7.3 rule 14), a new one tomorrow.
    seed: deriveSeed(1, dayKey(now)),
  };
}

/** Minutes practised in the current calendar week (Mon–Sun), from finished sessions. */
export function weekPracticeMinutes(sessions: readonly Session[], now: number): number {
  const week = weekIndex(now);
  const ms = finished(sessions)
    .filter((s) => weekIndex(s.startedAt) === week)
    .reduce((sum, s) => sum + sessionPracticeMs(s), 0);
  return Math.round(ms / 60_000);
}

export function streakWeeks(sessions: readonly Session[], now: number): number {
  return weeklyStreak(
    finished(sessions).map((s) => s.startedAt),
    now,
  );
}

export function practicedToday(sessions: readonly Session[], now: number): boolean {
  return finished(sessions).some((s) => dayKey(s.startedAt) === dayKey(now));
}

export interface WeakPair {
  pairId: string;
  /** Median of the last 3 one-minute-change runs (changes/min); null = not practised yet. */
  median: number | null;
}

/** Weakest unlocked pairs: lowest recent medians first, then pairs never practised (SPEC §12.1 "약한 쌍 Top 3"). */
export function weakPairs(
  skills: ReadonlyMap<string, SkillState>,
  curriculum: readonly StageDef[],
  stage: number,
  n = 3,
): WeakPair[] {
  const pairs = unlockedPairIds(curriculum, stage).map((pairId) => {
    const [a, b] = parsePairId(pairId);
    return { pairId, median: recentMedian(skills.get(pairKey(a, b)), 'cpm') ?? null };
  });
  const practised = pairs.filter((p) => p.median !== null).sort((x, y) => x.median! - y.median!);
  const fresh = pairs.filter((p) => p.median === null);
  return [...practised, ...fresh].slice(0, n);
}

/** Backup reminder (SPEC §13.3): data exists and the last backup (or the first session) is ≥ 7 days old. */
export function backupReminderDue(
  lastBackupAt: number | null,
  sessions: readonly Session[],
  now: number,
): boolean {
  const first = finished(sessions).reduce<number | null>(
    (min, s) => (min === null || s.startedAt < min ? s.startedAt : min),
    null,
  );
  if (first === null) return false;
  return now - (lastBackupAt ?? first) >= BACKUP_REMINDER_DAYS * DAY_MS;
}

export function stageChecklist(state: StoredState, now: number): StageEvaluation | null {
  const def = state.curriculum.find((d) => d.stage === state.progression.stage);
  if (!def || def.locked) return null;
  return evaluateStage(def, {
    stage: state.progression.stage,
    curriculum: state.curriculum,
    songs: state.songs,
    skills: state.skills,
    sessionsInStage: state.progression.sessionsInStage,
    stageEnteredAt: state.progression.stageEnteredAt,
    examPassed: examPassed(state.progression),
    now,
    recentSamples: state.recentSamples,
  });
}
