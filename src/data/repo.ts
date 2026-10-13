/**
 * Repository over GuitarDb. Attempts are append-only (no update/delete API; only a full data reset).
 * Every write of an attempt updates the derived caches through the same pure applyAttempt() used by
 * rebuildDerived(), so incremental == rebuilt.
 */
import { Dexie } from 'dexie';
import type { RoutineTemplate } from '../content/schemas';
import { applyAttempt, type DerivedState, deriveAll } from '../domain/derive';
import {
  type Attempt,
  type Calibration,
  initialProgression,
  type ProgressionState,
  type RecordingMeta,
  type ReviewItem,
  type SelfReport,
  type Session,
  type SkillState,
} from '../domain/records';
import { type GuitarDb, type StoredSkill, TABLE_NAMES } from './db';
import { DEFAULT_SETTINGS, normalizeSettings, type Settings } from './settings';

function toStored(skill: SkillState, reviews: ReadonlyMap<string, ReviewItem>): StoredSkill {
  return { ...skill, due: reviews.get(skill.subjectKey)?.due ?? null };
}

export class Repository {
  constructor(readonly db: GuitarDb) {}

  // --- attempts (append-only) -------------------------------------------------------------

  async recordAttempt(attempt: Attempt): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.attempts, this.db.metrics, this.db.skills, this.db.reviews],
      async () => {
        if (await this.db.attempts.get(attempt.id))
          throw new Error(`attempt ${attempt.id} already exists (append-only)`);
        await this.db.attempts.add(attempt);
        const reviews = new Map((await this.db.reviews.toArray()).map((r) => [r.subjectKey, r]));
        const state: DerivedState = { skills: new Map(), reviews };
        // Skill rows are small (one per subject), so the whole set is loaded for the pure fold.
        const existing = await this.db.skills.toArray();
        for (const skill of existing) {
          const { due: _due, ...rest } = skill;
          state.skills.set(skill.subjectKey, rest);
        }
        const derivation = applyAttempt(state, attempt);
        if (derivation.samples.length > 0) await this.db.metrics.bulkAdd(derivation.samples);
        if (derivation.changedReviews.length > 0) await this.db.reviews.bulkPut(derivation.changedReviews);
        const changedKeys = new Set([
          ...derivation.changedSkills.map((s) => s.subjectKey),
          ...derivation.changedReviews.map((r) => r.subjectKey),
        ]);
        const toWrite = [...changedKeys]
          .map((k) => state.skills.get(k))
          .filter((s): s is SkillState => s !== undefined);
        if (toWrite.length > 0) await this.db.skills.bulkPut(toWrite.map((s) => toStored(s, state.reviews)));
      },
    );
  }

  async attempts(): Promise<Attempt[]> {
    return this.db.attempts.orderBy('startedAt').toArray();
  }

  /** Most recent attempts of one exercise type, newest first. */
  async recentAttempts(exerciseType: string, limit: number): Promise<Attempt[]> {
    return this.db.attempts
      .where('[exerciseType+startedAt]')
      .between([exerciseType, Dexie.minKey], [exerciseType, Dexie.maxKey])
      .reverse()
      .limit(limit)
      .toArray();
  }

  /** Attempts started at or after `since` (oldest first). */
  async attemptsSince(since: number): Promise<Attempt[]> {
    return this.db.attempts.where('startedAt').aboveOrEqual(since).sortBy('startedAt');
  }

  async attemptsForSession(sessionId: string): Promise<Attempt[]> {
    return this.db.attempts.where('sessionId').equals(sessionId).sortBy('startedAt');
  }

  /** Recomputes metrics, skills and reviews from attempts (SPEC §13.1-3). */
  async rebuildDerived(): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.attempts, this.db.metrics, this.db.skills, this.db.reviews],
      async () => {
        const derived = deriveAll(await this.db.attempts.toArray());
        await Promise.all([this.db.metrics.clear(), this.db.skills.clear(), this.db.reviews.clear()]);
        await this.db.metrics.bulkAdd(derived.samples);
        await this.db.reviews.bulkPut([...derived.reviews.values()]);
        await this.db.skills.bulkPut([...derived.skills.values()].map((s) => toStored(s, derived.reviews)));
      },
    );
  }

  // --- derived reads -----------------------------------------------------------------------

  async skillMap(): Promise<Map<string, SkillState>> {
    const rows = await this.db.skills.toArray();
    return new Map(
      rows.map((row) => {
        const { due: _due, ...skill } = row;
        return [row.subjectKey, skill];
      }),
    );
  }

  async reviews(): Promise<ReviewItem[]> {
    return this.db.reviews.toArray();
  }

  // --- sessions ------------------------------------------------------------------------------

  async startSession(session: Session): Promise<void> {
    await this.db.sessions.add(session);
  }

  /**
   * Ends a session (self report, practice time without pauses). Only a session in which something was practised
   * at the current stage counts toward the stage's minimum stay (a curriculum session for another stage does
   * not, D-072).
   */
  async finishSession(
    id: string,
    endedAt: number,
    completedItems: number,
    selfReport: SelfReport | null,
    practiceMs?: number,
  ): Promise<void> {
    await this.db.transaction('rw', [this.db.sessions, this.db.progression], async () => {
      const session = await this.db.sessions.get(id);
      if (!session) throw new Error(`no session ${id}`);
      if (session.endedAt !== null) return;
      await this.db.sessions.put({
        ...session,
        endedAt,
        completedItems,
        selfReport,
        ...(practiceMs !== undefined ? { practiceMs: Math.round(practiceMs) } : {}),
      });
      if (completedItems === 0) return;
      const progression = (await this.db.progression.get('current')) ?? initialProgression(endedAt);
      if (session.stage !== progression.stage) return;
      await this.db.progression.put({ ...progression, sessionsInStage: progression.sessionsInStage + 1 });
    });
  }

  async sessions(): Promise<Session[]> {
    return this.db.sessions.orderBy('startedAt').toArray();
  }

  async lastFinishedSession(): Promise<Session | undefined> {
    const all = await this.db.sessions.orderBy('startedAt').reverse().toArray();
    return all.find((s) => s.endedAt !== null);
  }

  // --- progression ---------------------------------------------------------------------------

  async progression(now: number): Promise<ProgressionState> {
    return (await this.db.progression.get('current')) ?? initialProgression(now);
  }

  async saveProgression(state: ProgressionState): Promise<void> {
    await this.db.progression.put(state);
  }

  // --- calibration, recordings, routines, voicings -------------------------------------------

  async saveCalibration(calibration: Calibration): Promise<void> {
    await this.db.calibrations.put(calibration);
  }

  /** Latest calibration, preferring an exact (input, output) device match. */
  async latestCalibration(inputLabel?: string, outputLabel?: string): Promise<Calibration | undefined> {
    const all = await this.db.calibrations.orderBy('createdAt').reverse().toArray();
    return (
      all.find(
        (c) =>
          inputLabel !== undefined &&
          c.inputDeviceLabel === inputLabel &&
          (outputLabel === undefined || c.outputDeviceLabel === outputLabel),
      ) ?? all[0]
    );
  }

  async addRecording(meta: RecordingMeta): Promise<void> {
    await this.db.recordings.add(meta);
  }

  async recordings(): Promise<RecordingMeta[]> {
    return this.db.recordings.orderBy('createdAt').toArray();
  }

  async saveRoutineTemplate(template: RoutineTemplate): Promise<void> {
    await this.db.routines.put(template);
  }

  async userRoutineTemplates(): Promise<RoutineTemplate[]> {
    return this.db.routines.where('source').equals('user').toArray();
  }

  /** "기본으로 되돌리기" (SPEC v1.1 §7.3-9): removes a saved user template. */
  async deleteRoutineTemplate(id: string): Promise<void> {
    await this.db.routines.delete(id);
  }

  // --- meta / settings -----------------------------------------------------------------------

  async settings(): Promise<Settings> {
    return normalizeSettings((await this.db.meta.get('settings'))?.value ?? DEFAULT_SETTINGS);
  }

  async saveSettings(settings: Settings): Promise<void> {
    await this.db.meta.put({ key: 'settings', value: settings });
  }

  async getMeta<T>(key: string): Promise<T | undefined> {
    return (await this.db.meta.get(key))?.value as T | undefined;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    await this.db.meta.put({ key, value });
  }

  /** Data reset (the only deletion path; the UI requires a two-step confirmation). */
  async resetAll(): Promise<void> {
    await this.db.transaction(
      'rw',
      TABLE_NAMES.map((t) => this.db.table(t)),
      async () => {
        await Promise.all(TABLE_NAMES.map((t) => this.db.table(t).clear()));
      },
    );
  }
}
