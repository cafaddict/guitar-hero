/** E8 pause / resume (D-085): the interrupted bar is replayed, IOIs are pooled per stretch played. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { altPickResultSchema, extractMetrics } from '../../domain/exerciseResults';
import type { TimingSlot } from '../../dsp/timing';
import { DETECTOR_VERSION } from '../../dsp/version';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { e8Plugin } from './plugin';
import { AltPickRunner, type E8Params } from './runner';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** 60 BPM eighths: a pick every 0.5 s, one bar = 4 s. */
const SLOT_S = 0.5;
const BAR_S = 4;
const BARS = 8;
const PARAMS: E8Params = { stringIdx: 3, bpm: 60, bars: BARS };

function take() {
  const t = testContext();
  const runner = new AltPickRunner(t.ctx, PARAMS);
  const slots: (readonly TimingSlot[])[] = [];
  const analyze = t.mic.analyzeTiming.bind(t.mic);
  t.mic.analyzeTiming = (request) => {
    slots.push(request.slots);
    return analyze(request);
  };
  const pending: number[] = [];
  /** Even picks of bars `from…to−1` on a grid starting with bar `first` (up to `until`), heard 0.45 s later. */
  const pickBars = (
    grid: number,
    first: number,
    from: number,
    to: number,
    until = Number.POSITIVE_INFINITY,
  ) => {
    for (let b = from; b < to; b++)
      for (let i = 0; i < 8; i++) {
        const time = grid + (b - first) * BAR_S + i * SLOT_S;
        if (time <= until) pending.push(time);
      }
    pending.sort((a, b) => a - b);
  };
  const runTo = (time: number) =>
    t.output.run(t.clock, time - t.clock.t, () => {
      while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
        t.mic.judged.emit({
          time: pending.shift()!,
          result: null,
          jobKind: 'onsets',
          detectorVersion: DETECTOR_VERSION,
          processingMs: 1,
        });
      }
      runner.tick();
    });
  const grid = () => t.output.metronome.gridStartTime()!;
  return { t, runner, slots, pickBars, runTo, grid };
}

describe('E8 pause and resume (D-085)', () => {
  it('a mid-bar pause replays that bar; every bar is judged once; the run is recorded but does not pass', async () => {
    const { t, runner, slots, pickBars, runTo, grid } = take();
    runner.start();
    expect(runner.snapshot().phase).toBe('countIn');
    await flush();
    const g1 = grid();
    const pauseAt = g1 + 3 * BAR_S + 2;
    pickBars(g1, 0, 0, 4, pauseAt);
    runTo(pauseAt);
    runner.command('pause');
    expect(runner.snapshot()).toMatchObject({ phase: 'paused', view: { bar: 3 } });
    runTo(t.clock.t + 1);
    expect(runner.snapshot().view.liveBars.map((b) => b.bar)).toEqual([0, 1, 2]);
    runner.command('pause');
    await flush();
    expect(t.output.lastConfig).toMatchObject({ countInBars: 1, stopAfterBars: BARS - 3 });
    const g2 = grid();
    runTo(g2 - 0.5);
    expect(runner.snapshot()).toMatchObject({ phase: 'countIn', view: { bar: 3 } });
    pickBars(g2, 3, 3, BARS);
    runTo(g2 + 5 * BAR_S + 3);
    await flush();
    expect(runner.snapshot().phase).toBe('done');
    const bar = (start: number) => Array.from({ length: 8 }, (_, i) => start + i * SLOT_S);
    expect(slots[0]!.map((s) => s.time)).toEqual([
      ...[0, 1, 2].flatMap((b) => bar(g1 + b * BAR_S)),
      ...[0, 1, 2, 3, 4].flatMap((i) => bar(g2 + i * BAR_S)),
    ]);
    const live = runner.snapshot().view.liveBars;
    expect(live.map((b) => b.bar)).toEqual(Array.from({ length: BARS }, (_, b) => b));
    expect(live.every((b) => b.status === 'good')).toBe(true);
    const result = altPickResultSchema.parse(runner.finish());
    expect(result).toMatchObject({ hitRate: 1, passed: false, pauses: 1 });
    // The pause gap is not an interval: as even as an uninterrupted run.
    expect(result.ioiCv!).toBeCloseTo(0, 9);
    expect(extractMetrics('E8', result)).toContainEqual({
      subjectKey: 'altpick:3',
      metric: 'ladderBpm',
      value: 60,
    });
  });

  it('a pause in the first count-in is not counted: the run can still pass', async () => {
    const { t, runner, pickBars, runTo, grid } = take();
    runner.start();
    await flush();
    runTo(grid() - 2);
    runner.command('pause');
    expect(runner.snapshot().phase).toBe('paused');
    runTo(t.clock.t + 1);
    runner.command('pause');
    await flush();
    const g = grid();
    pickBars(g, 0, 0, BARS);
    runTo(g + BARS * BAR_S + 3);
    await flush();
    const result = runner.finish();
    expect(result).toMatchObject({ hitRate: 1, passed: true });
    expect(result.ioiCv!).toBeCloseTo(0, 9);
    expect(result.pauses).toBeUndefined();
  });

  it('the summary says a paused run does not count; E8 is pausable', () => {
    const result = altPickResultSchema.parse({
      stringIdx: 3,
      bpm: 60,
      bars: BARS,
      hitRate: 1,
      ioiCv: 0,
      passed: false,
      source: 'mic',
      pauses: 2,
    });
    expect(renderToStaticMarkup(<e8Plugin.Summary result={result} params={PARAMS} />)).toContain(
      ko.exercises.common.pausedRun,
    );
    expect(e8Plugin.pausable).toBe(true);
  });
});
