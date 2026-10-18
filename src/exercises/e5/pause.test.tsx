/** E5 pause / resume (D-085): slots per segment, live bars, dynamics by absolute bar, beta without the gap. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { patternById } from '../../content/patterns';
import { strumResultSchema } from '../../domain/exerciseResults';
import type { TimingSlot } from '../../dsp/timing';
import { DETECTOR_VERSION } from '../../dsp/version';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { e5Plugin } from './plugin';
import { type E5Params, StrumLadderRunner, slotGrid } from './runner';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** P3 (D DU UDU, 6 strums a bar) at 80 BPM: one bar = 3 s, one beat 0.75 s. */
const BAR_S = 3;
const BARS = 8;
const P3 = patternById('P3');
const PARAMS: E5Params = {
  patternId: 'P3',
  bpm: 80,
  bars: BARS,
  mode: 'single',
  chords: ['C'],
  cuesHidden: false,
  previousLow: false,
};

function take(params: Partial<E5Params> = {}) {
  const t = testContext();
  const full = { ...PARAMS, ...params };
  const runner = new StrumLadderRunner(t.ctx, full);
  const slots: (readonly TimingSlot[])[] = [];
  const analyze = t.mic.analyzeTiming.bind(t.mic);
  t.mic.analyzeTiming = (request) => {
    slots.push(request.slots);
    return analyze(request);
  };
  const pending: { time: number; beta: { direction: string; levelDb: number } }[] = [];
  const at = (time: number, direction = 'down', levelDb = 0) => {
    pending.push({ time, beta: { direction, levelDb } });
    pending.sort((a, b) => a.time - b.time);
  };
  /** The pattern's strums of bars `from…to−1` on a grid starting with bar `first` (up to `until`). */
  const strumBars = (
    grid: number,
    first: number,
    from: number,
    to: number,
    options: { until?: number; direction?: string; levelDb?: (bar: number) => number } = {},
  ) => {
    for (let b = from; b < to; b++)
      for (const s of slotGrid(P3, 80, 1, grid + (b - first) * BAR_S))
        if (s.expected && s.time <= (options.until ?? Number.POSITIVE_INFINITY))
          at(s.time, options.direction, options.levelDb?.(b) ?? 0);
  };
  const seen: { phase: string; bar: number | null; soft: boolean | null; beat: number | null }[] = [];
  const runTo = (time: number) =>
    t.output.run(t.clock, time - t.clock.t, () => {
      while (pending.length > 0 && pending[0]!.time <= t.clock.t - 0.45) {
        const e = pending.shift()!;
        t.mic.judged.emit({
          time: e.time,
          result: { beta: e.beta },
          jobKind: 'onsets',
          detectorVersion: DETECTOR_VERSION,
          processingMs: 1,
        });
      }
      runner.tick();
      const { phase, view } = runner.snapshot();
      seen.push({ phase, bar: view.bar, soft: view.soft, beat: view.beat });
    });
  const grid = () => t.output.metronome.gridStartTime()!;
  return { t, runner, slots, at, strumBars, runTo, grid, seen };
}

describe('E5 pause and resume (D-085)', () => {
  it('replays the interrupted bar on a new grid; scored but the ladder stays, even with perfect strums', async () => {
    const { t, runner, slots, at, strumBars, runTo, grid, seen } = take({ dynamics: true });
    runner.start();
    runner.command('toggle');
    await flush();
    const g1 = grid();
    const pauseAt = g1 + 4 * BAR_S + 1.5;
    // Bars 1–4 soft, 5–8 loud; bar 5's strums before the pause (loud, "up") are dropped with the cut.
    strumBars(g1, 0, 0, 4, { levelDb: () => -10 });
    strumBars(g1, 0, 4, 5, { until: pauseAt, direction: 'up' });
    runTo(pauseAt);
    runner.command('pause');
    expect(runner.snapshot()).toMatchObject({ phase: 'paused', view: { bar: 4, slot: null, soft: null } });
    at(t.clock.t + 0.2, 'up'); // a strum in the gap
    runTo(t.clock.t + 2);
    expect(runner.snapshot().view.liveBars.map((b) => b.bar)).toEqual([0, 1, 2, 3]);
    runner.command('pause');
    await flush();
    expect(t.output.lastConfig).toMatchObject({ countInBars: 1, stopAfterBars: BARS - 4 });
    const g2 = grid();
    runTo(g2 - 0.1);
    // The resume's count-in: beats counted, the replayed bar shown, not running yet.
    expect(runner.snapshot()).toMatchObject({ phase: 'countIn', view: { bar: 4, beat: 4 } });
    strumBars(g2, 4, 4, BARS);
    runTo(g2 + 4 * BAR_S + 3);
    await flush();
    expect(runner.snapshot().phase).toBe('review');
    // Bar 5 (absolute bar 4) is loud: the soft/loud halves follow the absolute bar, not the segment's.
    expect(seen.find((s) => s.phase === 'running' && s.bar === 4)?.soft).toBe(false);
    expect(slots[0]).toEqual([...slotGrid(P3, 80, 4, g1), ...slotGrid(P3, 80, 4, g2)]);
    const live = runner.snapshot().view.liveBars;
    expect(live.map((b) => b.bar)).toEqual(Array.from({ length: BARS }, (_, b) => b));
    expect(live.every((b) => b.status === 'good')).toBe(true);
    expect(runner.snapshot().view).toMatchObject({ ladder: 'stay', nextBpm: 80 });
    runner.command('manual1'); // the dynamics self rating
    const result = strumResultSchema.parse(runner.finish());
    expect(result).toMatchObject({
      hits: 48,
      misses: 0,
      hitRate: 1,
      ladder: 'stay',
      passed: false,
      pauses: 1,
    });
    // Beta readings: the replayed bar's first try and the gap are not there.
    expect(result.beta).toEqual({
      direction: { down: 48, up: 0, unknown: 0 },
      dynamics: ['soft', 'soft', 'soft', 'soft', 'loud', 'loud', 'loud', 'loud'],
    });
    const html = renderToStaticMarkup(<e5Plugin.Summary result={result} params={PARAMS} />);
    expect(html).toContain(ko.exercises.common.pausedRun);
    expect(html).toContain('data-ladder="stay"');
  });

  it('a pause in the count-in is not counted: the run can still step up', async () => {
    const { t, runner, strumBars, runTo, grid } = take();
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() - 1);
    runner.command('pause');
    expect(runner.snapshot().view.bar).toBeNull();
    runTo(t.clock.t + 1);
    runner.command('toggle'); // Space resumes too
    await flush();
    const g = grid();
    strumBars(g, 0, 0, BARS);
    runTo(g + BARS * BAR_S + 3);
    await flush();
    const result = runner.finish();
    expect(result).toMatchObject({ hitRate: 1, ladder: 'up', passed: true });
    expect(result.pauses).toBeUndefined();
  });

  it('cues shown while paused count as shown while playing; E5 is pausable', async () => {
    const { runner, runTo, grid } = take({ cuesHidden: true });
    runner.start();
    runner.command('toggle');
    await flush();
    runTo(grid() + BAR_S + 1.5);
    runner.command('pause');
    runner.command('cues');
    expect(runner.effectiveParams().cuesHidden).toBe(false);
    expect(e5Plugin.pausable).toBe(true);
  });
});
