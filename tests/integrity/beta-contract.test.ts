/**
 * SPEC v1.1 §14.6-10 beta contract: the beta targets are report-only. Their keys never appear in the hard
 * sections (synthetic, guitarset.hard), and the benchmark's exit code does not depend on beta values (checked
 * with fabricated results where only the beta metrics fail).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BETA_METRICS } from '../../tools/bench/betaBench';
import { benchExitCode, type MetricResult } from '../../tools/bench/metrics';
import { THRESHOLDS_PATH } from '../../tools/bench/thresholds';

const raw = JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8'));

function metric(area: string, key: string, pass: boolean): MetricResult {
  return { area, key, value: pass ? 1 : 0, threshold: 0.5, pass, n: 10 };
}

describe('§14.6-10 beta contract', () => {
  it('the beta section is report-only and its keys are not hard keys', () => {
    expect(raw.beta.reportOnly).toBe(true);
    const betaKeys = Object.keys(raw.beta.targets);
    const hardKeys = new Set([
      ...Object.values(raw.synthetic).flatMap((area) => Object.keys(area as object)),
      ...Object.keys(raw.guitarset.hard),
    ]);
    for (const key of betaKeys) expect(hardKeys.has(key), key).toBe(false);
  });

  it('every beta target is measured by the benchmark, and nothing else is reported as beta', () => {
    expect(Object.keys(BETA_METRICS).sort()).toEqual(Object.keys(raw.beta.targets).sort());
  });

  it('the exit code ignores beta: beta-only failures exit 0, a hard failure exits 1 (test split)', () => {
    const hardPass = [metric('modeA', 'okRetryMax', true), metric('sequence', 'cleanNoteOkRateMin', true)];
    const betaFail = Object.keys(raw.beta.targets).map((key) => metric('beta', key, false));
    const betaPass = Object.keys(raw.beta.targets).map((key) => metric('beta', key, true));
    expect(benchExitCode('test', hardPass, betaFail)).toBe(0);
    expect(benchExitCode('test', hardPass, betaPass)).toBe(0);
    expect(benchExitCode('test', [...hardPass, metric('swing', 'onsetF1At25msMin', false)], betaPass)).toBe(
      1,
    );
    expect(benchExitCode('dev', [metric('swing', 'onsetF1At25msMin', false)], betaFail)).toBe(0);
  });
});
