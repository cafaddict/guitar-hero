import { describe, expect, it } from 'vitest';
import { registerAllExercises } from './catalog';
import { exerciseDefinition } from './registry';
import { TEST_CONTENT } from './testing/fakes';

registerAllExercises();

const strum = (bpm: number, ladder: 'up' | 'down' | 'stay') => ({
  patternId: 'P0',
  bpm,
  bars: 8,
  mode: 'mute',
  hits: 11,
  misses: 5,
  extras: 8,
  meanOffsetMs: -11,
  sdOffsetMs: 33,
  hitRate: 0.69,
  hitRateCorrected: 0.69,
  cuesHidden: false,
  ladder,
  passed: false,
  source: 'mic',
});

describe('retry at the suggested tempo (session "N BPM으로 다시")', () => {
  it('E5 follows the ladder: up → +5, stay → no second button, an old down result → −5', () => {
    const e5 = exerciseDefinition('E5')!;
    const params = { ...(e5.defaultParams(TEST_CONTENT) as object), bpm: 60 };
    expect(e5.suggestedTempoRetry(params, strum(60, 'down'))).toMatchObject({ bpm: 55, params: { bpm: 55 } });
    expect(e5.suggestedTempoRetry(params, strum(60, 'up'))).toMatchObject({ bpm: 65, params: { bpm: 65 } });
    expect(e5.suggestedTempoRetry(params, strum(60, 'stay'))).toBeNull();
    // Everything but the tempo is the same run.
    const { params: next } = e5.suggestedTempoRetry(params, strum(60, 'down'))!;
    expect({ ...(next as object), bpm: 60 }).toEqual(e5.parseParams(params));
  });

  it('E6 and E8 suggest +5 only after a pass', () => {
    const e6 = exerciseDefinition('E6')!;
    const e6Params = e6.defaultParams(TEST_CONTENT) as { bpm: number };
    const beat = (passed: boolean) => ({
      progression: ['C', 'G'],
      patternId: 'P0',
      bpm: e6Params.bpm,
      bars: 16,
      barsInWindow: passed ? 15 : 10,
      stops: 0,
      beat1DelayMsMean: 20,
      missingBarRatio: 0,
      passed,
      source: 'mic',
    });
    expect(e6.suggestedTempoRetry(e6Params, beat(true))).toMatchObject({ bpm: e6Params.bpm + 5 });
    expect(e6.suggestedTempoRetry(e6Params, beat(false))).toBeNull();

    const e8 = exerciseDefinition('E8')!;
    const e8Params = { stringIdx: 3, bpm: 60, bars: 8 };
    const pick = (passed: boolean) => ({
      stringIdx: 3,
      bpm: 60,
      bars: 8,
      hitRate: 0.95,
      ioiCv: 0.05,
      passed,
      source: 'mic',
    });
    expect(e8.suggestedTempoRetry(e8Params, pick(true))).toEqual({
      bpm: 65,
      params: { ...e8Params, bpm: 65 },
    });
    expect(e8.suggestedTempoRetry(e8Params, pick(false))).toBeNull();
  });

  it('exercises without a tempo, and invalid results, offer no tempo retry; invalid params are rejected', () => {
    const e2 = exerciseDefinition('E2')!;
    expect(e2.suggestedTempoRetry(e2.defaultParams(TEST_CONTENT), { anything: true })).toBeNull();
    const e5 = exerciseDefinition('E5')!;
    expect(e5.suggestedTempoRetry(e5.defaultParams(TEST_CONTENT), { not: 'a result' })).toBeNull();
    expect(() => e5.suggestedTempoRetry({ bpm: 'fast' }, strum(60, 'down'))).toThrow();
  });
});
