/**
 * SPEC v1.1 §14.6-9: functions the SPEC requires the app to use have a call site in production code — v1 had
 * several defined, tested and never called (GAP_AUDIT A-16, 18, 22, 33). Call sites count only in non-test files
 * under src/ (tools/ and tests/ excluded); `generateRoutine` and `evaluateStage` must be called outside the
 * simulation. `verifySequence` joins the list in M12 (SPEC v1.1 §16 "무결성 9 단계화").
 */
import { describe, expect, it } from 'vitest';
import { listFiles, readSource, stripComments } from './source-scan';

const REQUIRED = [
  'detectStagnation',
  'suggestedGVoicing',
  'nextStretchStartFret',
  'saveRoutineTemplate',
  'userRoutineTemplates',
  'generateRoutine',
  'evaluateStage',
] as const;
/** Calls inside these files do not count for the listed functions (the simulation drives its own copies). */
const EXCLUDED_CALLERS: Readonly<Record<string, readonly string[]>> = {
  generateRoutine: ['src/domain/simulate.ts'],
  evaluateStage: ['src/domain/simulate.ts'],
};

const files = listFiles('src', /\.(ts|tsx)$/).filter(
  (f) => !/\.test\.tsx?$/.test(f) && !f.includes('/testing/'),
);
const sources = new Map(files.map((f) => [f, stripComments(readSource(f), { stripStrings: true })]));

/** Call sites `name(` that are not the definition (`function name(`, a method `async name(` / `name(…) {`). */
function callSites(code: string, name: string): number {
  const pattern = new RegExp(String.raw`(^|[^\w$])${name}\s*\(`, 'gm');
  let count = 0;
  for (const match of code.matchAll(pattern)) {
    const before = code.slice(Math.max(0, (match.index ?? 0) - 20), (match.index ?? 0) + match[1]!.length);
    if (/\bfunction\s*$/.test(before) || /\basync\s*$/.test(before)) continue;
    // A class/object method definition: `name(...) {` at the start of a line.
    const lineStart = code.lastIndexOf('\n', match.index ?? 0) + 1;
    const line = code.slice(lineStart, code.indexOf('\n', match.index ?? 0));
    if (new RegExp(String.raw`^\s*${name}\s*\([^)]*\)\s*(:[^{]*)?\{`).test(line)) continue;
    count += 1;
  }
  return count;
}

describe('§14.6-9 SPEC-required functions are called in production code', () => {
  it.each(REQUIRED)('%s has a production call site', (name) => {
    const excluded = new Set(EXCLUDED_CALLERS[name] ?? []);
    const callers = [...sources]
      .filter(([file, code]) => !excluded.has(file) && callSites(code, name) > 0)
      .map(([f]) => f);
    expect(callers, `${name} callers`).not.toEqual([]);
  });

  it('the call-site scan ignores definitions and counts real calls (self-test)', () => {
    expect(callSites('export function foo(a: number) {\n  return a;\n}', 'foo')).toBe(0);
    expect(callSites('class R {\n  async foo(x: T): Promise<void> {\n  }\n}', 'foo')).toBe(0);
    expect(callSites('const r = repo.foo(1);', 'foo')).toBe(1);
    expect(callSites('bar(foo(1));', 'foo')).toBe(1);
    expect(callSites('const food = 1; foods(2);', 'foo')).toBe(0);
  });
});
