import { describe, expect, it } from 'vitest';
import { formatDuration, renderSummary, STEPS } from './verify';

describe('verify', () => {
  it('runs the steps in the SPEC §5.3 order', () => {
    expect(STEPS.map((s) => s.name)).toEqual([
      'licenses',
      'typecheck',
      'lint',
      'test',
      'bench:dsp',
      'bench:guitarset',
      'build',
      'test:e2e',
    ]);
  });

  it('formats durations like the §14.7 table', () => {
    expect(formatDuration(2_000)).toBe('2s');
    expect(formatDuration(192_000)).toBe('3m12s');
    expect(formatDuration(245_400)).toBe('4m05s');
  });

  it('renders PASS, BLOCKED and FAIL results', () => {
    const ok = renderSummary('abc1234', [
      { name: 'licenses', status: 'PASS', ms: 2000, detail: undefined },
      { name: 'bench:guitarset', status: 'BLOCKED', ms: 1000, detail: 'download blocked' },
    ]);
    expect(ok).toContain('VERIFY SUMMARY (guitar-hero @ abc1234)');
    expect(ok.split('\n').at(-1)).toBe('RESULT: PASS (BLOCKED: bench:guitarset)');
    const bad = renderSummary('abc1234', [{ name: 'lint', status: 'FAIL', ms: 1000, detail: undefined }]);
    expect(bad.split('\n').at(-1)).toBe('RESULT: FAIL (lint)');
  });
});
