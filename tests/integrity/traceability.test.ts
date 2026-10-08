/**
 * SPEC v1.1 §14.6-7 / §14.9-7: the research traceability table is complete. Every entry is implemented (with
 * SPEC sections that exist in the v1.1 SPEC and AC ids that exist in the PROGRESS AC table) or excluded with a
 * reason; there are at least `minimumEntries` entries.
 */
import { describe, expect, it } from 'vitest';
import { readSource } from './source-scan';

interface Entry {
  id: string;
  source: string;
  recommendation: string;
  status: string;
  spec?: string[];
  ac?: string[];
  note?: string;
}

const table = JSON.parse(readSource('docs/goal/v1.1/traceability.json')) as {
  minimumEntries: number;
  entries: Entry[];
};
const spec = readSource('docs/goal/v1.1/SPEC.md');
const progress = readSource('docs/goal/v1.1/PROGRESS.md');

/** "§7.3" → a heading "### 7.3 …" (or "## 7. …" for a whole chapter) in the v1.1 SPEC. */
function specHasSection(ref: string): boolean {
  const number = ref.replace(/^§/, '');
  const escaped = number.replace(/\./g, '\\.');
  const heading = number.includes('.')
    ? new RegExp(`^###\\s+${escaped}\\s`, 'm')
    : new RegExp(`^##\\s+${escaped}\\.\\s`, 'm');
  return heading.test(spec);
}

/** AC ids in the first column of the PROGRESS AC table. */
const progressAcs = new Set([...progress.matchAll(/^\|\s*(AC-[A-Z]+\d+)\s*\|/gm)].map((m) => m[1]!));

describe('§14.6-7 traceability.json completeness', () => {
  it('has at least minimumEntries entries with unique ids', () => {
    expect(table.entries.length).toBeGreaterThanOrEqual(table.minimumEntries);
    expect(new Set(table.entries.map((e) => e.id)).size).toBe(table.entries.length);
  });

  it('every entry is implemented or excluded', () => {
    const bad = table.entries
      .filter((e) => e.status !== 'implemented' && e.status !== 'excluded')
      .map((e) => e.id);
    expect(bad).toEqual([]);
  });

  it('implemented entries point at v1.1 SPEC sections and PROGRESS AC ids that exist', () => {
    expect(progressAcs.size).toBeGreaterThanOrEqual(41);
    const problems: string[] = [];
    for (const e of table.entries.filter((x) => x.status === 'implemented')) {
      if (!e.spec?.length) problems.push(`${e.id}: no SPEC section`);
      if (!e.ac?.length) problems.push(`${e.id}: no AC`);
      for (const ref of e.spec ?? []) if (!specHasSection(ref)) problems.push(`${e.id}: ${ref} not in SPEC`);
      for (const ac of e.ac ?? []) if (!progressAcs.has(ac)) problems.push(`${e.id}: ${ac} not in PROGRESS`);
    }
    expect(problems).toEqual([]);
  });

  it('excluded entries carry a non-empty reason', () => {
    const bad = table.entries
      .filter((e) => e.status === 'excluded' && !(e.note ?? '').trim())
      .map((e) => e.id);
    expect(bad).toEqual([]);
  });

  it('the section check rejects a section that does not exist (self-test)', () => {
    expect(specHasSection('§7.3')).toBe(true);
    expect(specHasSection('§11.21')).toBe(true);
    expect(specHasSection('§7.99')).toBe(false);
  });
});
