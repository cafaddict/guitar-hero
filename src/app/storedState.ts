/** Loads everything the home screen and session runner derive their plans from (one consistent snapshot). */
import { CURRICULUM } from '../content/curriculum';
import { PRACTICE_SONGS } from '../content/songs';
import { dayKey } from '../domain/records';
import type { StoredState } from '../features/home/homeModel';
import { repo } from './services';

export const LAST_BACKUP_KEY = 'lastBackupAt';

export async function loadStoredState(now: number): Promise<StoredState & { lastBackupAt: number | null }> {
  const [progression, settings, skills, reviews, sessions, recentChanges, lastBackupAt] = await Promise.all([
    repo.progression(now),
    repo.settings(),
    repo.skillMap(),
    repo.reviews(),
    repo.sessions(),
    repo.recentAttempts('E2', 50),
    repo.getMeta<number>(LAST_BACKUP_KEY),
  ]);
  return {
    progression,
    settings,
    skills,
    reviews,
    sessions,
    changesDoneToday: recentChanges.filter((a) => dayKey(a.startedAt) === dayKey(now)).length,
    curriculum: CURRICULUM,
    songs: PRACTICE_SONGS,
    lastBackupAt: lastBackupAt ?? null,
  };
}
