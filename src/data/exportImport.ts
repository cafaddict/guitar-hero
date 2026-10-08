/**
 * JSON export / import (SPEC §13.3): zod-validated envelope, schema migrations, preview counts,
 * merge (skip existing ids) or replace.
 */
import { z } from 'zod';
import { type GuitarDb, SCHEMA_VERSION, TABLE_NAMES, type TableName } from './db';
import { countedSessions, progressionV1toV2 } from './migrations';
import type { Repository } from './repo';

const row = z.record(z.string(), z.unknown());

export const exportEnvelopeSchema = z.object({
  app: z.literal('guitar-hero'),
  schemaVersion: z.number().int().min(1),
  exportedAt: z.number(),
  tables: z.object(
    Object.fromEntries(TABLE_NAMES.map((t) => [t, z.array(row).default([])])) as Record<
      TableName,
      z.ZodDefault<z.ZodArray<typeof row>>
    >,
  ),
});
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

/** Minimal per-table row checks: the primary key must be present with the right type. */
const PRIMARY_KEYS: Record<TableName, { key: string; type: 'string' | 'number' }> = {
  voicings: { key: 'id', type: 'string' },
  routines: { key: 'id', type: 'string' },
  sessions: { key: 'id', type: 'string' },
  attempts: { key: 'id', type: 'string' },
  metrics: { key: 'seq', type: 'number' },
  skills: { key: 'subjectKey', type: 'string' },
  progression: { key: 'key', type: 'string' },
  reviews: { key: 'subjectKey', type: 'string' },
  calibrations: { key: 'id', type: 'string' },
  recordings: { key: 'id', type: 'string' },
  meta: { key: 'key', type: 'string' },
};

/** schemaVersion n → n+1 transforms (the same row transforms as the Dexie upgrades in db.ts). */
export const MIGRATIONS: Readonly<Record<number, (envelope: ExportEnvelope) => ExportEnvelope>> = {
  1: (envelope) => {
    const count = countedSessions(envelope.tables.sessions);
    return {
      ...envelope,
      schemaVersion: 2,
      tables: {
        ...envelope.tables,
        progression: envelope.tables.progression.map(
          (row) => progressionV1toV2(row, count) as unknown as Record<string, unknown>,
        ),
      },
    };
  },
};

export function migrate(envelope: ExportEnvelope): ExportEnvelope {
  if (envelope.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `export schemaVersion ${envelope.schemaVersion} is newer than this app (${SCHEMA_VERSION})`,
    );
  }
  let current = envelope;
  while (current.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[current.schemaVersion];
    if (!step) throw new Error(`no migration from schemaVersion ${current.schemaVersion}`);
    current = step(current);
  }
  return current;
}

export async function exportAll(db: GuitarDb, now: number): Promise<ExportEnvelope> {
  const tables = {} as Record<TableName, Record<string, unknown>[]>;
  for (const name of TABLE_NAMES)
    tables[name] = (await db.table(name).toArray()) as Record<string, unknown>[];
  return { app: 'guitar-hero', schemaVersion: SCHEMA_VERSION, exportedAt: now, tables };
}

export function exportFileName(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `guitar-hero-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

export interface ImportPreview {
  envelope: ExportEnvelope;
  counts: Record<TableName, number>;
}

/** Parses and validates an export file's text; throws with a readable message when invalid. */
export function parseImport(text: string): ImportPreview {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('not a JSON file');
  }
  const envelope = migrate(exportEnvelopeSchema.parse(raw));
  for (const name of TABLE_NAMES) {
    const { key, type } = PRIMARY_KEYS[name];
    envelope.tables[name].forEach((r, i) => {
      if (typeof r[key] !== type) throw new Error(`${name}[${i}]: missing ${key}`);
    });
  }
  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, envelope.tables[t].length])) as Record<
    TableName,
    number
  >;
  return { envelope, counts };
}

/** Tables a merge copies (rows whose key is absent); the rest are caches rebuilt from the attempts. */
const MERGED_TABLES: readonly TableName[] = [
  'voicings',
  'routines',
  'sessions',
  'attempts',
  'calibrations',
  'recordings',
  'progression',
  'meta',
];

/**
 * Applies an import. 'replace' clears everything and restores rows verbatim (derived tables included);
 * 'merge' adds only rows whose primary key does not exist yet (§13.3 "같은 id는 건너뜀") — facts, and also the
 * progression and settings/meta rows a fresh device lacks — then rebuilds the derived caches.
 */
export async function applyImport(
  repo: Repository,
  envelope: ExportEnvelope,
  mode: 'merge' | 'replace',
): Promise<void> {
  const db = repo.db;
  if (mode === 'replace') {
    await db.transaction(
      'rw',
      TABLE_NAMES.map((t) => db.table(t)),
      async () => {
        for (const name of TABLE_NAMES) {
          await db.table(name).clear();
          if (envelope.tables[name].length > 0) await db.table(name).bulkAdd(envelope.tables[name]);
        }
      },
    );
    return;
  }
  await db.transaction(
    'rw',
    MERGED_TABLES.map((t) => db.table(t)),
    async () => {
      for (const name of MERGED_TABLES) {
        const { key } = PRIMARY_KEYS[name];
        const table = db.table(name);
        const existing = new Set((await table.toCollection().primaryKeys()) as unknown[]);
        const fresh = envelope.tables[name].filter((r) => !existing.has(r[key]));
        if (fresh.length > 0) await table.bulkAdd(fresh);
      }
    },
  );
  await repo.rebuildDerived();
}
