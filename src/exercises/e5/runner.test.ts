import { describe, expect, it } from 'vitest';
import { patternById } from '../../content/patterns';
import { strumResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import {
  type E5Params,
  ladderDecision,
  metronomeFor,
  nextBpmFor,
  StrumLadderRunner,
  slotGrid,
} from './runner';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

async function setup(params: Partial<E5Params> = {}, options: { mic?: boolean; rttMs?: number } = {}) {
  const t = testContext({ mic: options.mic ?? true });
  if (options.rttMs !== undefined) {
    t.ctx.calibration = { rttMs: options.rttMs } as NonNullable<typeof t.ctx.calibration>;
  }
  const full: E5Params = {
    patternId: 'P3',
    bpm: 80,
    bars: 8,
    mode: 'single',
    chords: ['C'],
    cuesHidden: false,
    previousLow: false,
    ...params,
  };
  const runner = new StrumLadderRunner(t.ctx, full);
  runner.start();
  runner.command('toggle'); // Space while armed (the first-strum start is tested separately)
  await flush();
  return { ...t, runner, params: full, view: () => runner.snapshot().view };
}

/** Plays strums at the given grid offsets (+ RTT + jitter) while the fake clock runs. */
function play(t: Awaited<ReturnType<typeof setup>>, offsets: number[], rttS: number, seconds: number) {
  const grid = t.output.metronome.gridStartTime()!;
  const pending = offsets.map((o) => grid + o + rttS).sort((a, b) => a - b);
  t.output.run(t.clock, seconds, () => {
    while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
      const time = pending.shift()!;
      t.mic.judged.emit({
        time,
        result: null,
        jobKind: 'onsets',
        detectorVersion: DETECTOR_VERSION,
        processingMs: 1.5,
      });
    }
    t.runner.tick();
  });
}

describe('E5 helpers', () => {
  it('ladder: ≥ 90 % with no miss → up, a second run below 70 % → down', () => {
    expect(ladderDecision(0.95, 0, false)).toBe('up');
    expect(ladderDecision(0.95, 1, false)).toBe('stay');
    expect(ladderDecision(0.6, 3, false)).toBe('stay');
    expect(ladderDecision(0.6, 3, true)).toBe('down');
    expect(nextBpmFor(80, 'up')).toBe(85);
    expect(nextBpmFor(30, 'down')).toBe(30);
  });

  it('slot grid: eighth notes, rests not expected; 6/8 clicks on eighths', () => {
    const p3 = patternById('P3');
    const slots = slotGrid(p3, 80, 2, 10);
    expect(slots).toHaveLength(16);
    expect(slots[1]!.time - slots[0]!.time).toBeCloseTo(0.375, 9);
    expect(slots.slice(0, 8).map((s) => s.expected)).toEqual([
      true,
      false,
      true,
      true,
      false,
      true,
      true,
      true,
    ]);
    const p5 = patternById('P5');
    expect(metronomeFor(p5, 40, 4, false)).toMatchObject({
      meter: '6/8',
      bpm: 120,
      stopAfterBars: 4,
      countInBars: 1,
    });
    expect(slotGrid(p5, 40, 1, 0)[1]!.time).toBeCloseTo(0.5, 9);
  });
});

describe('E5 strumming ladder', () => {
  it('scores grid-aligned strums (RTT-corrected): hit rate 1, mean/sd, ladder +5', async () => {
    const t = await setup({}, { rttMs: 40 });
    expect(t.runner.snapshot().phase).toBe('countIn');
    expect(t.mic.job).toEqual({ kind: 'onsets' });
    expect(t.output.lastRttMs).toBe(40);
    const slots = slotGrid(patternById('P3'), 80, 8, 0).filter((s) => s.expected);
    // Strums at the slots ±8 ms of human jitter (deterministic), captured RTT later.
    play(
      t,
      slots.map((s, i) => s.time + ((i % 5) - 2) * 0.004),
      0.04,
      30,
    );
    await flush();
    expect(t.runner.snapshot().phase).toBe('done');
    const view = t.view();
    expect(view.analysis?.hitRate).toBe(1);
    expect(view.analysis?.misses).toBe(0);
    expect(Math.abs(view.analysis!.meanOffsetMs!)).toBeLessThan(2);
    expect(view.analysis?.sdOffsetMs).toBeGreaterThan(0);
    expect(view.ladder).toBe('up');
    expect(view.nextBpm).toBe(85);
    const result = t.runner.finish();
    expect(strumResultSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      patternId: 'P3',
      bpm: 80,
      hits: 48,
      misses: 0,
      passed: true,
      ladder: 'up',
      source: 'mic',
    });
    expect(t.runner.dspStats().detectorVersion).toBe(DETECTOR_VERSION);
  });

  it('missing strums and strums in rest slots → stay, extras counted', async () => {
    const t = await setup({ bars: 2 });
    const slots = slotGrid(patternById('P3'), 80, 2, 0);
    const offsets = slots.filter((s, i) => s.expected && i !== 3).map((s) => s.time);
    offsets.push(slots[1]!.time); // a strum in a rest slot
    play(t, offsets, 0, 12);
    await flush();
    const r = t.runner.finish();
    expect(r.misses).toBe(1);
    expect(r.extras).toBe(1);
    expect(r.ladder).toBe('stay');
    expect(r.passed).toBe(false);
  });

  it('two low runs in a row step down', async () => {
    const t = await setup({ bars: 2, previousLow: true });
    play(t, [0, 0.75], 0, 12);
    await flush();
    expect(t.runner.finish()).toMatchObject({ ladder: 'down' });
    expect(t.view().nextBpm).toBe(75);
  });

  it('shows the current bar/slot while playing (visual cue) and hides nothing in the data', async () => {
    const t = await setup({ bars: 2, cuesHidden: true });
    t.output.run(t.clock, 3.2, () => t.runner.tick());
    expect(t.runner.snapshot().phase).toBe('running');
    expect(t.view().bar).toBe(0);
    expect(t.view().cuesHidden).toBe(true);
  });

  it('without a microphone the user rates the run', async () => {
    const t = await setup({ bars: 8 }, { mic: false });
    t.output.run(t.clock, 30, () => t.runner.tick());
    expect(t.runner.snapshot().phase).toBe('review');
    expect(t.view().awaitingSelf).toBe(true);
    t.runner.command('manual1');
    expect(t.runner.snapshot().phase).toBe('done');
    expect(t.runner.finish()).toMatchObject({
      source: 'self',
      hitRate: 1,
      misses: 0,
      ladder: 'up',
      passed: true,
    });
  });

  it('waits armed and starts the count-in on the first strum (SPEC §12.3)', async () => {
    const t = testContext();
    const runner = new StrumLadderRunner(t.ctx, {
      patternId: 'P0',
      bpm: 60,
      bars: 8,
      mode: 'mute',
      chords: [],
      cuesHidden: false,
      previousLow: false,
    });
    runner.start();
    expect(runner.snapshot().phase).toBe('armed');
    expect(t.output.lastConfig).toBeNull();
    t.mic.coarse.emit(t.clock.t);
    await flush();
    expect(runner.snapshot().phase).toBe('countIn');
    expect(t.output.lastConfig).toMatchObject({ bpm: 60, countInBars: 1, stopAfterBars: 8 });
    expect(t.mic.job).toEqual({ kind: 'onsets' });
  });

  it('a perfect run shorter than 8 bars does not step the ladder up', async () => {
    const t = await setup({ bars: 4 });
    const slots = slotGrid(patternById('P3'), 80, 4, 0).filter((s) => s.expected);
    play(
      t,
      slots.map((s) => s.time),
      0,
      18,
    );
    await flush();
    expect(t.runner.finish()).toMatchObject({ hitRate: 1, ladder: 'stay', passed: false });
  });

  it('scoring failure ends the run without a result; abort before scoring records nothing', async () => {
    const t = await setup({ bars: 2 });
    t.mic.analyzeTiming = () => Promise.reject(new Error('worker timeout'));
    t.output.run(t.clock, 12, () => t.runner.tick());
    await flush();
    expect(t.runner.snapshot().phase).toBe('done');
    expect(t.view().analysisFailed).toBe(true);
    expect(t.runner.hasResult()).toBe(false);
    const aborted = await setup();
    aborted.runner.command('abort');
    expect(aborted.runner.hasResult()).toBe(false);
  });

  it('the plugin derives "previous run below 70 %" from the latest run of the same pattern', async () => {
    const { e5Plugin } = await import('./plugin');
    const params = {
      patternId: 'P3' as const,
      bpm: 80,
      bars: 8,
      mode: 'single' as const,
      chords: [],
      cuesHidden: false,
      previousLow: false,
    };
    const run = (patternId: string, hitRate: number) => ({
      ...strumResultSchema.parse({
        patternId,
        bpm: 80,
        bars: 8,
        mode: 'single',
        hits: 0,
        misses: 0,
        extras: 0,
        meanOffsetMs: null,
        sdOffsetMs: null,
        hitRate,
        hitRateCorrected: hitRate,
        cuesHidden: false,
        ladder: 'stay',
        passed: false,
        source: 'mic',
      }),
    });
    expect(e5Plugin.withHistory!(params, [run('P1', 0.2), run('P3', 0.6)]).previousLow).toBe(true);
    expect(e5Plugin.withHistory!(params, [run('P3', 0.75), run('P3', 0.5)]).previousLow).toBe(false);
    expect(e5Plugin.withHistory!(params, []).previousLow).toBe(false);
  });
});
