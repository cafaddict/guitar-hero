import { describe, expect, it } from 'vitest';
import { oneBeatResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { chordCorrectRatio, type E6Params, OneBeatRunner, stoppedBars } from './runner';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

async function run(
  onsetsFor: (barStart: number, bar: number) => number[],
  params: Partial<E6Params> = {},
  rttMs = 30,
) {
  const t = testContext();
  t.ctx.calibration = { rttMs } as NonNullable<typeof t.ctx.calibration>;
  const full: E6Params = { progression: ['C', 'G'], patternId: 'P0', bpm: 80, bars: 16, ...params };
  const runner = new OneBeatRunner(t.ctx, full);
  runner.start();
  expect(runner.snapshot().phase).toBe('armed');
  runner.command('toggle');
  await flush();
  const grid = t.output.metronome.gridStartTime()!;
  const barS = 3;
  const pending = Array.from({ length: full.bars }, (_, b) => onsetsFor(grid + b * barS, b))
    .flat()
    .map((x) => x + rttMs / 1000)
    .sort((a, b) => a - b);
  t.output.run(t.clock, full.bars * barS + 6, () => {
    while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
      t.mic.judged.emit({
        time: pending.shift()!,
        result: null,
        // The strums arrive as whatever job the runner set (Mode C set classification with a microphone).
        jobKind: t.mic.job?.kind ?? 'onsets',
        detectorVersion: DETECTOR_VERSION,
        processingMs: 1,
      });
    }
    runner.tick();
  });
  await flush();
  return { runner, t };
}

describe('E6 change on beat 1', () => {
  it('counts the bars whose first beat is on time and passes with ≥ 14/16 and no stop', async () => {
    // Quarter strums; bars 3 and 9 start 120 ms late (outside the ±50 ms window at 80 BPM).
    const { runner } = await run((start, bar) =>
      [0, 0.75, 1.5, 2.25].map((o) => start + o + (o === 0 && (bar === 3 || bar === 9) ? 0.12 : 0)),
    );
    expect(runner.snapshot().phase).toBe('done');
    const result = runner.finish();
    expect(oneBeatResultSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      barsInWindow: 14,
      stops: 0,
      passed: true,
      missingBarRatio: 2 / 16,
      source: 'mic',
    });
    expect(Math.abs(result.beat1DelayMsMean!)).toBeLessThan(1);
  });

  it('a silent bar is a stop and fails the run', async () => {
    const { runner } = await run((start, bar) =>
      bar === 5 ? [] : [0, 0.75, 1.5, 2.25].map((o) => start + o),
    );
    expect(runner.finish()).toMatchObject({ barsInWindow: 15, stops: 1, passed: false });
  });

  it('v1.1 §11.7: with a microphone the strums are classified among the progression chords (Mode C)', async () => {
    const { t } = await run((start) => [start]);
    expect(t.mic.jobs.find((j) => j?.kind === 'set')).toMatchObject({ kind: 'set' });
  });

  it('chordCorrectRatio: each chord-changing bar is a two-way choice between its chord and the previous one', () => {
    const ev = (time: number, scores: number[]) => ({
      time,
      result: { top: 0, margin: 1, scores, detectorVersion: 'x', processingMs: 1 },
      jobKind: 'set' as const,
      detectorVersion: 'x',
      processingMs: 1,
    });
    // C G C G over 4 bars of 3 s: bars 1, 2, 3 change chord; bar 2 sounded like G (wrong), the others right.
    const events = [ev(3, [0, 5]), ev(6, [1, 4]), ev(9, [0, 5])];
    expect(chordCorrectRatio(['C', 'G'], ['C', 'G'], events, 0, 3, 4, 0, 0.05)).toBeCloseTo(2 / 3, 5);
    // Repeated chords are not checked; no event near a bar → not judged.
    expect(chordCorrectRatio(['C', 'C'], ['C'], events, 0, 3, 4, 0, 0.05)).toBeNull();
    expect(chordCorrectRatio(['C', 'G'], ['C', 'G'], [], 0, 3, 4, 0, 0.05)).toBeNull();
  });

  it('stoppedBars helper', () => {
    expect(stoppedBars([0.1, 3.2, 9.0], 0, 3, 4, 0.05)).toEqual([2]);
  });

  it('shows the current and next chord of the progression', async () => {
    const t = testContext();
    const runner = new OneBeatRunner(t.ctx, {
      progression: ['C', 'G', 'Am'],
      patternId: 'P0',
      bpm: 80,
      bars: 4,
    });
    runner.start();
    t.mic.coarse.emit(t.clock.t); // the first strum starts the count-in
    await flush();
    t.output.run(t.clock, 3 + 3.2, () => runner.tick());
    expect(runner.snapshot().view).toMatchObject({ bar: 1, chord: 'G', nextChord: 'Am' });
  });
});
