/**
 * Practice history facts the routine generator needs (SPEC v1.1 §7.3 input): the number of today's session
 * (the user's n-th session), the ordinal of today among practice days, and the last appearance of every
 * (exercise, subject) item. Derived from sessions and attempts only, so it is always recomputable.
 */
import { type Attempt, dayKey, type Session } from './records';

export interface Appearance {
  /** Session number of the latest attempt with this key. */
  session: number;
  /** Practice-day ordinal (1-based) of that session. */
  day: number;
}

export interface PracticeHistory {
  /** Today's session number: finished sessions in which something was practised, plus one. */
  sessionNumber: number;
  /** Today's practice-day ordinal (1-based; days with a counted session). */
  practiceDay: number;
  /** `<exercise>|<subject>` → last appearance. */
  appearances: ReadonlyMap<string, Appearance>;
}

export const EMPTY_HISTORY: PracticeHistory = { sessionNumber: 1, practiceDay: 1, appearances: new Map() };

/** A session counts once it ended with at least one stored attempt (same rule as the stage's minimum stay). */
export function isCountedSession(session: Session): boolean {
  return session.endedAt !== null && session.completedItems > 0;
}

const str = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/**
 * Appearance keys an attempt stands for, read from its result. Routine attempts also carry the routine item's
 * own key (`Attempt.routineKey`); this covers attempts started elsewhere and older records.
 */
export function appearanceKeys(exerciseType: string, result: unknown): string[] {
  const r = record(result);
  const key = (subject: string | null) => (subject === null ? [] : [`${exerciseType}|${subject}`]);
  switch (exerciseType) {
    case 'E0':
      return key('tuning');
    case 'E1':
      return key(str(r.voicingId) && `chord:${r.voicingId}`);
    case 'E2':
      return [...key(str(r.pair) && `pair:${r.pair}`), ...key(str(r.direction) && `pairdir:${r.direction}`)];
    case 'E3':
      return key(str(r.pair) && `pair:${r.pair}`);
    case 'E4':
      return key(str(r.pair) && `drill:${r.pair}`);
    case 'E5': {
      const pattern = str(r.patternId);
      if (!pattern) return [];
      const keys = [...key(`strum:${pattern}`), ...key(str(r.mode) && `strum:${pattern}:${r.mode}`)];
      if (r.cuesHidden === true) keys.push(...key(`strum:${pattern}:hidden`));
      if (r.dynamics === true) keys.push(...key(`strum:${pattern}:dynamics`));
      if (r.palmMute === true) keys.push(...key(`strum:${pattern}:palmMute`));
      return keys;
    }
    case 'E6':
      return key(Array.isArray(r.progression) ? `onebeat:${r.progression.join('-')}` : null);
    case 'E7':
      return key('stretch');
    case 'E8':
      return key(typeof r.stringIdx === 'number' ? `altpick:${r.stringIdx}` : null);
    case 'E9':
      return key('chromatic');
    case 'E10':
      return key(str(r.scaleId) && `scale:${r.scaleId}`);
    case 'E11':
      return key('hammer');
    case 'E12':
      return key('pinky');
    case 'E16':
      return key('fretpos');
    case 'E17':
      return key(str(r.riffId) && `riff:${r.riffId}`);
    case 'K1':
      return Array.isArray(r.items)
        ? r.items.flatMap((item) => key(str(record(item).id) && `check:${record(item).id}`))
        : [];
    case 'Q1':
      return key('quiz:diagram');
    case 'Q2':
      return key('recall');
    case 'Q3':
      return key(`quiz:notes:${str(r.scope) ?? 'open'}`);
    case 'Q4':
      return key(`ear:${str(r.kind) ?? 'majmin'}`);
    case 'Q5':
      return key('quiz:tab');
    case 'S':
      return key(str(r.songId) && `song:${r.songId}`);
    default:
      return [];
  }
}

/** Exercises whose single routine item covers several subjects (each self-check card is its own item). */
const MULTI_SUBJECT_TYPES: ReadonlySet<string> = new Set(['K1']);

/**
 * The items an attempt counts as an appearance of. A routine attempt stands for the routine item that started it
 * (its key — e.g. a pattern review does not count as that pattern's rotation entry); attempts started elsewhere
 * stand for what their result names.
 */
export function attemptAppearanceKeys(
  attempt: Pick<Attempt, 'exerciseType' | 'result' | 'routineKey'>,
): string[] {
  if (!attempt.routineKey) return appearanceKeys(attempt.exerciseType, attempt.result);
  return MULTI_SUBJECT_TYPES.has(attempt.exerciseType)
    ? [attempt.routineKey, ...appearanceKeys(attempt.exerciseType, attempt.result)]
    : [attempt.routineKey];
}

/**
 * The sessions that happened (D-065, D-095): ended with an attempt, or left without the self report once they hold
 * one. The one rule the rotation and home's "오늘 연습을 마쳤어요" share, so they cannot disagree.
 */
export function countedSessions(
  sessions: readonly Session[],
  attempts: readonly Pick<Attempt, 'sessionId'>[],
): Session[] {
  const withAttempts = new Set(attempts.map((a) => a.sessionId).filter((id): id is string => id !== null));
  return sessions.filter((s) => isCountedSession(s) || withAttempts.has(s.id));
}

export function practiceHistory(
  sessions: readonly Session[],
  attempts: readonly Pick<Attempt, 'sessionId' | 'exerciseType' | 'result' | 'routineKey'>[],
  now: number,
): PracticeHistory {
  const counted = countedSessions(sessions, attempts).sort(
    (a, b) => a.startedAt - b.startedAt || (a.id < b.id ? -1 : 1),
  );
  const dayOrdinal = new Map<string, number>();
  for (const session of counted) {
    const day = dayKey(session.startedAt);
    if (!dayOrdinal.has(day)) dayOrdinal.set(day, dayOrdinal.size + 1);
  }
  const sessionInfo = new Map(
    counted.map((session, i) => [
      session.id,
      { session: i + 1, day: dayOrdinal.get(dayKey(session.startedAt))! },
    ]),
  );
  const appearances = new Map<string, Appearance>();
  for (const attempt of attempts) {
    const info = attempt.sessionId === null ? undefined : sessionInfo.get(attempt.sessionId);
    if (!info) continue;
    const keys = new Set(attemptAppearanceKeys(attempt));
    for (const key of keys) {
      const previous = appearances.get(key);
      if (!previous || previous.session < info.session) appearances.set(key, info);
    }
  }
  return {
    sessionNumber: counted.length + 1,
    practiceDay: dayOrdinal.get(dayKey(now)) ?? dayOrdinal.size + 1,
    appearances,
  };
}

/** Sessions since an item last appeared (Infinity when it never did). */
export function sessionsSince(history: PracticeHistory, key: string): number {
  const last = history.appearances.get(key);
  return last === undefined ? Number.POSITIVE_INFINITY : history.sessionNumber - last.session;
}

/** Practice days since an item last appeared (Infinity when it never did). */
export function practiceDaysSince(history: PracticeHistory, key: string): number {
  const last = history.appearances.get(key);
  return last === undefined ? Number.POSITIVE_INFINITY : history.practiceDay - last.day;
}
