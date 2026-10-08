/**
 * Source files must never be ignored by git: v1's `.gitignore` line `data/` silently ignored `src/data/` (the
 * Dexie database, migrations, export/import, repository and settings), so a fresh clone could not build while the
 * working tree passed every gate. This scan lists ignored files under the source folders.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ROOT } from './source-scan';

/** Generated or user-recorded audio is ignored on purpose (rebuilt by `fixtures:generate` / the recording kit). */
const ALLOWED = [/^tests\/fixtures\/generated\/[^/]+\.wav$/, /^tests\/fixtures\/real\/.+\.wav$/];

function ignoredSources(): string[] {
  const out = execFileSync(
    'git',
    [
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '--',
      'src',
      'tools',
      'tests',
      'public',
      'docs',
    ],
    { cwd: ROOT, encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter((line) => line.length > 0)
    .filter((path) => !ALLOWED.some((pattern) => pattern.test(path)));
}

describe('source files are tracked (no ignore rule hides them)', () => {
  it('nothing under src/, tools/, tests/, public/ or docs/ is git-ignored except generated audio', () => {
    expect(ignoredSources()).toEqual([]);
  });
});
