/**
 * IndexedDB schema (SPEC §13.2) via Dexie. The DB name is injectable so tests use isolated databases.
 */
import { Dexie, type EntityTable } from 'dexie';
import type { RoutineTemplate } from '../content/schemas';
import type {
  Attempt,
  Calibration,
  MetricSample,
  ProgressionState,
  RecordingMeta,
  ReviewItem,
  Session,
  SkillState,
} from '../domain/records';
import type { ChordVoicing } from '../domain/voicing';
import { countedSessions, progressionV1toV2 } from './migrations';

export const SCHEMA_VERSION = 2;

export interface MetaRow {
  key: string;
  value: unknown;
}

export type StoredSkill = SkillState & { due: number | null };

export class GuitarDb extends Dexie {
  voicings!: EntityTable<ChordVoicing, 'id'>;
  routines!: EntityTable<RoutineTemplate, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  metrics!: EntityTable<MetricSample, 'seq'>;
  skills!: EntityTable<StoredSkill, 'subjectKey'>;
  progression!: EntityTable<ProgressionState, 'key'>;
  reviews!: EntityTable<ReviewItem, 'subjectKey'>;
  calibrations!: EntityTable<Calibration, 'id'>;
  recordings!: EntityTable<RecordingMeta, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor(name = 'guitar-hero') {
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
    // v2 (SPEC v1.1 §13.2): reviews indexed by kind, split 30-minute sessions, prescriptions in progression.
    this.version(2)
      .stores({
        reviews: 'subjectKey, due, kind',
        sessions: 'id, startedAt, splitOf',
      })
      .upgrade(async (tx) => {
        const sessions = (await tx.table('sessions').toArray()) as Record<string, unknown>[];
        const count = countedSessions(sessions);
        await tx
          .table('progression')
          .toCollection()
          .modify((row: Record<string, unknown>) => {
            const next = progressionV1toV2(row, count) as unknown as Record<string, unknown>;
            for (const key of Object.keys(row)) if (!(key in next)) delete row[key];
            Object.assign(row, next);
          });
      });
  }
}

export const TABLE_NAMES = [
  'voicings',
  'routines',
  'sessions',
  'attempts',
  'metrics',
  'skills',
  'progression',
  'reviews',
  'calibrations',
  'recordings',
  'meta',
] as const;
export type TableName = (typeof TABLE_NAMES)[number];
