/** E6 pause / resume (D-085): the interrupted bar is replayed, a paused run is recorded but does not pass. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { extractMetrics, oneBeatResultSchema } from '../../domain/exerciseResults';
import type { TimingSlot } from '../../dsp/timing';
import { DETECTOR_VERSION } from '../../dsp/version';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { e6Plugin } from './plugin';
import { type E6Params, OneBeatRunner } from './runner';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** C → G at 80 BPM: one bar = 3 s; RTT 30 ms. */
const BAR_S = 3;
const BARS = 16;
const RTT_S = 0.03;
const PARAMS: E6Params = { progression: ['C', 'G'], patternId: 'P0', bpm: 80, bars: BARS };

/** Mode C scores [C, G] of a strum that sounds like `chord`. */
const sounds = (chord: 'C' | 'G') => ({ scores: chord === 'C' ? [0.8, 0.2] : [0.2, 0.8] });
const chordOf = (bar: number): 'C' | 'G' => (bar % 2 === 0 ? 'C' : 'G');

function take() {
  const t = testContext();
  t.ctx.calibration = { rttMs: RTT_S * 1000 } as NonNullable<typeof t.ctx.calibration>;
  const runner = new OneBeatRunner(t.ctx, PARAMS);
  const slots: (readonly TimingSlot[])[] = [];
  const analyze = t.mic.analyzeTiming.bind(t.mic);
  t.mic.analyzeTiming = (request) => {
    slots.push(request.slots);
    return analyze(request);
  };
  const pending: { time: number; result: unknown }[] = [];
  /** Quarter strums of bars `from…to−1` on a grid starting with bar `first`, heard 0.45 s later. */
  const strumBars = (
    grid: number,
    first: number,
    from: number,
    to: number,
    options: { until?: number; sound?: (bar: number) => 'C' | 'G' } = {},
  ) => {
    for (let b = from; b < to; b++)
      for (const o of [0, 0.75, 1.5, 2.25]) {
        const time = grid + (b - first) * BAR_S + o + RTT_S;
        if (options.until !== undefined && time > options.until) continue;
        pending.push({ time, result: sounds((options.sound ?? chordOf)(b)) });
      }
    pending.sort((a, b) => a.time - b.time);
  };
  const runTo = (time: number) =>
    t.output.run(t.clock, time - t.clock.t, () => {
      while (pending.length > 0 && pending[0]!.time <= t.clock.t - 0.45) {
        const e = pending.shift()!;
        t.mic.judged.emit({
          time: e.time,
          result: e.result,
          jobKind: t.mic.job?.kind ?? 'onsets',
          detectorVersion: DETECTOR_VERSION,
          processingMs: 1,
        });
      }
      runner.tick();
    });
  const grid = () => t.output.metronome.gridStartTime()!;
  return { t, runner, slots, strumBars, runTo, grid };
}

describe('E6 pause and resume (D-085)', () => {
  it('a mid-bar pause replays that bar; every bar is judged once; the run is recorded but does not pass', async () => {
    const { t, runner, slots, strumBars, runTo, grid } = take();
    runner.start();
    runner.command('toggle');
    await flush();
    const g1 = grid();
    const pauseAt = g1 + 5 * BAR_S + 1.5;
    strumBars(g1, 0, 0, 6, { until: pauseAt });
    runTo(pauseAt);
    runner.command('pause');
    expect(runner.snapshot()).toMatchObject({ phase: 'paused', view: { bar: 5, chord: 'G' } });
    runTo(t.clock.t + 1);
    expect(runner.snapshot().view.liveBars.length).toBeLessThanOrEqual(5);
    expect(runner.snapshot().view.liveBars.every((b) => b.status === 'good')).toBe(true);
    runner.command('pause');
    await flush();
    expect(t.output.lastConfig).toMatchObject({ countInBars: 1, stopAfterBars: BARS - 5 });
    const g2 = grid();
    runTo(g2 - 0.5);
    expect(runner.snapshot()).toMatchObject({ phase: 'countIn', view: { bar: 5 } });
    // The replayed bar still sounds like the previous chord: the resume's count-in led into it, not checked.
    strumBars(g2, 5, 5, BARS, { sound: (b) => (b === 5 ? 'C' : chordOf(b)) });
    runTo(g2 + 11 * BAR_S + 3);
    await flush();
    expect(runner.snapshot().phase).toBe('done');
    expect(slots[0]!.map((s) => s.time)).toEqual([
      ...Array.from({ length: 5 }, (_, b) => g1 + b * BAR_S),
      ...Array.from({ length: 11 }, (_, i) => g2 + i * BAR_S),
    ]);
    const live = runner.snapshot().view.liveBars;
    expect(live.map((b) => b.bar)).toEqual(Array.from({ length: BARS }, (_, b) => b));
    expect(live.every((b) => b.status === 'good')).toBe(true);
    expect(live[5]!.chord).toBeNull();
    const result = oneBeatResultSchema.parse(runner.finish());
    expect(result).toMatchObject({
      barsInWindow: BARS,
      stops: 0,
      passed: false,
      pauses: 1,
      chordCorrectRatio: 1,
    });
    // Not passed: the ladder stays.
    expect(extractMetrics('E6', result)).toContainEqual({
      subjectKey: 'onebeat:C-G',
      metric: 'ladderBpm',
      value: 80,
    });
  });

  it('a pause in the count-in is not counted: the run can still pass', async () => {
    const { t, runner, strumBars, runTo, grid } = take();
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() - 2);
    runner.command('pause');
    runTo(t.clock.t + 1);
    runner.command('toggle'); // Space resumes too
    await flush();
    const g = grid();
    strumBars(g, 0, 0, BARS);
    runTo(g + BARS * BAR_S + 3);
    await flush();
    const result = runner.finish();
    expect(result).toMatchObject({ barsInWindow: BARS, passed: true });
    expect(result.pauses).toBeUndefined();
  });

  it('the summary says a paused run does not count; E6 is pausable', () => {
    const result = oneBeatResultSchema.parse({
      progression: ['C', 'G'],
      patternId: 'P0',
      bpm: 80,
      bars: BARS,
      barsInWindow: BARS,
      stops: 0,
      beat1DelayMsMean: 0,
      missingBarRatio: 0,
      passed: false,
      source: 'mic',
      pauses: 1,
    });
    const html = renderToStaticMarkup(<e6Plugin.Summary result={result} params={PARAMS} />);
    expect(html).toContain(ko.exercises.common.pausedRun);
    expect(
      renderToStaticMarkup(<e6Plugin.Summary result={{ ...result, pauses: undefined }} params={PARAMS} />),
    ).not.toContain(ko.exercises.common.pausedRun);
    expect(e6Plugin.pausable).toBe(true);
  });
});
