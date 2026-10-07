/**
 * AC-U5 wording rules (SPEC §12.4): FAIL = what + how, RETRY worded per cause, never a bare "틀렸습니다".
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CoachingHint } from '../domain/coaching';
import { ko, type RetryReasonCode } from './ko';

const RETRY: RetryReasonCode[] = [
  'LOW_LEVEL',
  'CLIPPING',
  'NOISY',
  'AMBIGUOUS',
  'NO_ONSET',
  'MULTIPLE_ONSETS',
  'DETUNED',
];
const HINTS: CoachingHint[] = [
  { code: 'mutedOpenAdjacentFinger', stringNo: 3, finger: 2 },
  { code: 'mutedOpenGeneric', stringNo: 1 },
  { code: 'mutedFretted', stringNo: 2, finger: 1 },
  { code: 'wrongFret', stringNo: 4, semitones: 1 },
  { code: 'wrongFret', stringNo: 4, semitones: -2 },
  { code: 'openStringPressed', stringNo: 3 },
  { code: 'openStringFlat', stringNo: 3 },
  { code: 'unexpectedXString', stringNo: 6, lowestStringNo: 5 },
  { code: 'weak', stringNo: 2 },
  { code: 'generalTip', tipIndex: 0 },
];

describe('Korean wording rules (SPEC §12.4)', () => {
  it('FAIL messages always say what went wrong and how to fix it', () => {
    for (const what of [
      ko.verdict.stringMuted(2),
      ko.verdict.stringWrong(4),
      ko.verdict.stringUnexpected(6),
    ]) {
      for (const hint of HINTS.filter((h) => h.code !== 'generalTip')) {
        const how = ko.coaching.render(hint);
        const line = ko.verdict.fail(what, how);
        expect(line.startsWith(what)).toBe(true);
        expect(line.endsWith(how)).toBe(true);
        expect(how.length).toBeGreaterThan(5);
      }
    }
  });

  it('every coaching hint is an action (non-empty, not a bare verdict)', () => {
    for (const hint of HINTS) expect(ko.coaching.render(hint).length).toBeGreaterThan(10);
  });

  it('RETRY wording is specific to each cause', () => {
    const texts = RETRY.map((r) => ko.verdict.retry(r));
    expect(new Set(texts).size).toBe(RETRY.length);
    for (const t of texts) expect(t.length).toBeGreaterThan(10);
  });

  it('never uses a bare "틀렸습니다" anywhere in the strings', () => {
    const source = readFileSync(join(import.meta.dirname, 'ko.ts'), 'utf8');
    expect(source.includes('틀렸습니다')).toBe(false);
  });

  it('the "microphone is an aid, your ears come first" notice exists for onboarding and settings', () => {
    expect(ko.verdict.micAssistNotice).toContain('내 귀');
    expect(ko.settingsScreen.micNotice).toContain('내 귀');
  });
});
