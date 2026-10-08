import 'fake-indexeddb/auto';
import { Dexie } from 'dexie';
import { describe, expect, it } from 'vitest';
import { DAY_MS, initialProgression, type ProgressionState } from '../domain/records';
import { GuitarDb, SCHEMA_VERSION, TABLE_NAMES } from './db';
import { applyImport, exportAll, parseImport } from './exportImport';
import { CONDITIONAL_PRESCRIPTION_SESSIONS, countedSessions, progressionV1toV2 } from './migrations';
import { Repository } from './repo';

const T0 = new Date(2026, 8, 1, 18).getTime();
let counter = 0;
const uniqueName = () => `migration-db-${++counter}-${Date.now()}`;

/** A v1 progression row as v1 stored it (SPEC v1 §13.2). */
function v1Progression(): Record<string, unknown> {
  return {
    key: 'current',
    stage: 4,
    stageEnteredAt: T0 + 10 * DAY_MS,
    sessionsInStage: 2,
    gVoicing: 'G-2f',
    history: [{ stage: 3, enteredAt: T0, leftAt: T0 + 10 * DAY_MS, conditional: true }],
    exam: {},
    completedBeginner1: false,
    prescribedDrills: ['Am|Em'],
  };
}

function v1Sessions(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    startedAt: T0 + i * DAY_MS,
    endedAt: T0 + i * DAY_MS + 1_200_000,
    routineId: null,
    plannedItems: 8,
    completedItems: i === 0 ? 0 : 6,
    selfReport: null,
    stage: 3,
  }));
}

/** The v1 schema exactly (version 1 only), to create a database as v1 left it. */
class V1Db extends Dexie {
  constructor(name: string) {
    super(name);
    this.version(1).stores({
      voicings: 'id, symbol, stage, *tags',
      routines: 'id, source',
      sessions: 'id, startedAt',
      attempts: 'id, sessionId, exerciseType, startedAt, [exerciseType+startedAt]',
      metrics: '++seq, [subjectKey+metric+at], attemptId',
      skills: 'subjectKey, due, lastPracticedAt',
      progression: 'key',
      reviews: 'subjectKey, due',
      calibrations: 'id, createdAt, [inputDeviceLabel+outputDeviceLabel]',
      recordings: 'id, createdAt, label',
      meta: 'key',
    });
  }
}

describe('AC-DT1 schema v2 and migrations (SPEC v1.1 §13.2–13.3)', () => {
  it('converts v1 conditional-promotion drills into prescriptions that started at stage entry', () => {
    const sessions = v1Sessions(9); // 8 counted (the first one practised nothing)
    expect(countedSessions(sessions)).toBe(8);
    const migrated = progressionV1toV2(v1Progression(), countedSessions(sessions));
    expect(migrated).not.toHaveProperty('prescribedDrills');
    expect(migrated.completedBeginner2).toBe(false);
    expect(migrated.prescriptions).toEqual([
      {
        kind: 'omcToPfc',
        subjectKey: 'pair:Am|Em',
        startedSession: 6,
        startedAt: T0 + 10 * DAY_MS,
        expiresAfterSessions: CONDITIONAL_PRESCRIPTION_SESSIONS,
        reason: 'conditionalPromotion',
      },
    ]);
    // Already-v2 rows pass through unchanged.
    const v2: ProgressionState = { ...initialProgression(T0), prescriptions: migrated.prescriptions };
    expect(progressionV1toV2(v2 as unknown as Record<string, unknown>, 8)).toEqual(v2);
  });

  it('upgrades a v1 IndexedDB database in place (Dexie version 2)', async () => {
    const name = uniqueName();
    const old = new V1Db(name);
    await old.table('progression').put(v1Progression());
    await old.table('sessions').bulkPut(v1Sessions(9));
    await old.table('reviews').put({
      subjectKey: 'chord:D',
      kind: 'chord',
      step: 1,
      due: T0,
      enqueuedAt: T0,
      lastReviewedAt: null,
      lapses: 0,
    });
    old.close();

    const db = new GuitarDb(name);
    await db.open();
    expect(db.verno).toBe(SCHEMA_VERSION);
    const progression = await db.progression.get('current');
    expect(progression?.prescriptions.map((p) => p.subjectKey)).toEqual(['pair:Am|Em']);
    expect(progression).not.toHaveProperty('prescribedDrills');
    expect(progression?.stage).toBe(4);
    expect(await db.reviews.where('kind').equals('chord').count()).toBe(1);
    db.close();
  });

  it('imports a v1 export file into v2 (migration 1 → 2) and exports schemaVersion 2', async () => {
    const v1File = {
      app: 'guitar-hero',
      schemaVersion: 1,
      exportedAt: T0,
      tables: { progression: [v1Progression()], sessions: v1Sessions(9) },
    };
    const preview = parseImport(JSON.stringify(v1File));
    expect(preview.envelope.schemaVersion).toBe(2);
    const repo = new Repository(new GuitarDb(uniqueName()));
    await applyImport(repo, preview.envelope, 'replace');
    const progression = await repo.progression(T0);
    expect(progression.prescriptions).toHaveLength(1);
    expect(progression.completedBeginner2).toBe(false);
    const exported = await exportAll(repo.db, T0);
    expect(exported.schemaVersion).toBe(2);
  });

  it('round-trips v2 fields (prescriptions, Beginner 2, split sessions) through export → import', async () => {
    const source = new Repository(new GuitarDb(uniqueName()));
    await source.saveProgression({
      ...initialProgression(T0),
      stage: 11,
      gVoicing: 'G-4f',
      completedBeginner1: true,
      completedBeginner2: true,
      beginner2CompletedAt: T0 + DAY_MS,
      prescriptions: [
        {
          kind: 'slowerTempo',
          subjectKey: 'strum:P7:single',
          startedSession: 40,
          startedAt: T0,
          expiresAfterSessions: 8,
          expiresAt: T0 + 7 * DAY_MS,
          reason: 'stagnation',
        },
      ],
    });
    await source.startSession({
      id: 'b',
      startedAt: T0,
      endedAt: null,
      routineId: null,
      plannedItems: 5,
      completedItems: 0,
      selfReport: null,
      stage: 11,
      splitOf: 'a',
    });
    const exported = await exportAll(source.db, T0);
    const target = new Repository(new GuitarDb(uniqueName()));
    await applyImport(target, parseImport(JSON.stringify(exported)).envelope, 'replace');
    const again = await exportAll(target.db, T0);
    for (const table of TABLE_NAMES) expect(again.tables[table], table).toEqual(exported.tables[table]);
    expect(await target.db.sessions.where('splitOf').equals('a').count()).toBe(1);
  });
});
