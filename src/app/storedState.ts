/** Loads everything the home screen and session runner derive their plans from (one consistent snapshot). */
import { CURRICULUM } from '../content/curriculum';
import { PRACTICE_SONGS } from '../content/songs';
import { samplesOf } from '../domain/derive';
import { hammerResultSchema, stretchResultSchema } from '../domain/exerciseResults';
import { practiceHistory } from '../domain/history';
import { DAY_MS, dayKey } from '../domain/records';
import { stretchStartFretFrom } from '../domain/safety';
import { RECENT_SAMPLE_DAYS, type StoredState } from '../features/home/homeModel';
import { repo } from './services';

export const LAST_BACKUP_KEY = 'lastBackupAt';

const CHANGE_RUN_TYPES = new Set(['E2', 'E3']);

/** Samples of a stored attempt; an attempt this build cannot read (unknown or invalid result) adds none. */
function safeSamples(attempt: Parameters<typeof samplesOf>[0]): ReturnType<typeof samplesOf> {
  try {
    return samplesOf(attempt);
  } catch {
    return [];
  }
}

/** E11 minutes played on a day (the daily cap, SPEC v1.1 §11.16). */
export function hammerMinutesOn(
  attempts: readonly { exerciseType: string; startedAt: number; result: unknown }[],
  day: string,
): number {
  let ms = 0;
  for (const a of attempts) {
    if (a.exerciseType !== 'E11' || dayKey(a.startedAt) !== day) continue;
    const parsed = hammerResultSchema.safeParse(a.result);
    if (parsed.success) ms += parsed.data.durationMs;
  }
  return ms / 60_000;
}

export async function loadStoredState(now: number): Promise<StoredState & { lastBackupAt: number | null }> {
  const [progression, settings, skills, reviews, sessions, attempts, userTemplates, lastBackupAt] =
    await Promise.all([
      repo.progression(now),
      repo.settings(),
      repo.skillMap(),
      repo.reviews(),
      repo.sessions(),
      repo.attempts(),
      repo.userRoutineTemplates(),
      repo.getMeta<number>(LAST_BACKUP_KEY),
    ]);
  const today = dayKey(now);
  const since = now - RECENT_SAMPLE_DAYS * DAY_MS;
  const stretchRuns = attempts.flatMap((a) => {
    if (a.exerciseType !== 'E7') return [];
    const parsed = stretchResultSchema.safeParse(a.result);
    return parsed.success ? [parsed.data] : [];
  });
  return {
    progression,
    settings,
    skills,
    reviews,
    sessions,
    changesDoneToday: attempts.filter(
      (a) => CHANGE_RUN_TYPES.has(a.exerciseType) && dayKey(a.startedAt) === today,
    ).length,
    curriculum: CURRICULUM,
    songs: PRACTICE_SONGS,
    history: practiceHistory(sessions, attempts, now),
    recentSamples: attempts.filter((a) => a.endedAt >= since).flatMap(safeSamples),
    stretchStartFret: stretchStartFretFrom(stretchRuns),
    hammerMinutesToday: hammerMinutesOn(attempts, today),
    userTemplates,
    lastBackupAt: lastBackupAt ?? null,
  };
}
