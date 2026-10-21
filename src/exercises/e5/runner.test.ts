import { describe, expect, it } from 'vitest';
import { patternById } from '../../content/patterns';
import { extractMetrics, strumResultSchema } from '../../domain/exerciseResults';
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
  it('ladder: ≥ 90 % with no miss → up, anything else stays (never down, D-098)', () => {
    expect(ladderDecision(0.95, 0)).toBe('up');
    expect(ladderDecision(0.95, 1)).toBe('stay');
    expect(ladderDecision(0.6, 3)).toBe('stay');
    expect(ladderDecision(0.1, 20)).toBe('stay');
    expect(ladderDecision(0.95, 0, 4)).toBe('stay');
    expect(nextBpmFor(80, 'up')).toBe(85);
    // Results stored before D-098 may still say 'down'.
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
    // v1.1 §10.11: the onsets job also asks for the beta readings (direction, palm mute, level).
    expect(t.mic.job).toMatchObject({ kind: 'onsets', beta: { direction: true } });
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

  it('swing patterns (§6.10): P7 off-beats at 2/3 of the beat are hits, straight eighths miss them', async () => {
    const grid = slotGrid(patternById('P7'), 80, 2, 0);
    expect(grid[1]!.time).toBeCloseTo((60 / 80) * (2 / 3), 9);
    const swung = await setup({ patternId: 'P7', bars: 2 });
    play(
      swung,
      grid.map((s) => s.time),
      0,
      12,
    );
    await flush();
    expect(swung.view().analysis?.hitRate).toBe(1);

    const straight = await setup({ patternId: 'P7', bars: 2 });
    // The highlighted slot follows the swing grid: 0.6 of the first beat is still the down-beat slot.
    const start = straight.output.metronome.gridStartTime()!;
    straight.output.run(straight.clock, start + (60 / 80) * 0.6 - straight.clock.t, () =>
      straight.runner.tick(),
    );
    expect(straight.view().slot).toBe(0);
    play(
      straight,
      grid.map((_, i) => (i * 60) / 80 / 2),
      0,
      12,
    );
    await flush();
    expect(straight.view().analysis?.hitRate).toBe(0.5);
  });

  it('palm-mute option (§11.6, §10.11): asks the beta reading and reports its share as reference only', async () => {
    const t = await setup({ patternId: 'P6', bars: 2, palmMute: true });
    expect(t.mic.job).toMatchObject({ kind: 'onsets', beta: { palmMute: true } });
    const grid = t.output.metronome.gridStartTime()!;
    const readings = [0.9, 0.8, 0.2, 0.7];
    t.output.run(t.clock, 1, () => t.runner.tick());
    readings.forEach((palmMute, i) => {
      t.mic.judged.emit({
        time: grid + i * 0.375,
        result: { beta: { palmMute } },
        jobKind: 'onsets',
        detectorVersion: DETECTOR_VERSION,
        processingMs: 1,
      });
    });
    t.output.run(t.clock, 10, () => t.runner.tick());
    await flush();
    expect(t.runner.betaSummary().palmMuteShare).toBe(0.75);
    const result = t.runner.finish();
    expect(result).toMatchObject({ patternId: 'P6', palmMute: true });
    expect(extractMetrics('E5', result).some((m) => /palm/i.test(m.metric))).toBe(false);
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

  it('a low run never steps down, even after another low one (D-098)', async () => {
    const t = await setup({ bars: 2, previousLow: true });
    play(t, [0, 0.75], 0, 12);
    await flush();
    expect(t.runner.finish()).toMatchObject({ ladder: 'stay', bpm: 80 });
    expect(t.view().nextBpm).toBe(80);
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
    // v1.1 §10.11: the onsets job also asks for the beta readings (direction, palm mute, level).
    expect(t.mic.job).toMatchObject({ kind: 'onsets', beta: { direction: true } });
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

  it('E5 has no history adjustment: the tempo is the one the run was started with (D-098)', async () => {
    const { e5Plugin } = await import('./plugin');
    expect(e5Plugin.withHistory).toBeUndefined();
  });
});

describe('E5 tempo picked on the start screen (D-098)', () => {
  const base: E5Params = {
    patternId: 'P3',
    bpm: 80,
    bars: 2,
    mode: 'single',
    chords: ['C'],
    cuesHidden: false,
    previousLow: false,
  };
  const waiting = (params: Partial<E5Params> = {}, mic = true) => {
    const t = testContext({ mic });
    const runner = new StrumLadderRunner(t.ctx, { ...base, ...params });
    runner.start();
    return { ...t, runner, view: () => runner.snapshot().view };
  };

  it('↑/↓ while armed or ready change the run: metronome, slot grid, result and recorded params', async () => {
    const t = waiting();
    expect(t.runner.snapshot().phase).toBe('armed');
    expect(t.view().tempoPickable).toBe(true);
    t.runner.command('dec');
    t.runner.command('dec');
    t.runner.command('inc');
    expect(t.view().bpm).toBe(75);
    t.runner.command('toggle');
    await flush();
    expect(t.output.lastConfig).toMatchObject({ bpm: 75, stopAfterBars: 2 });
    expect(t.view().tempoPickable).toBe(false);
    // Strums on the 75 BPM grid are all hits (at 80 BPM most would miss).
    const slots = slotGrid(patternById('P3'), 75, 2, 0).filter((x) => x.expected);
    const grid = t.output.metronome.gridStartTime()!;
    const pending = slots.map((x) => grid + x.time);
    t.output.run(t.clock, 14, () => {
      while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
        t.mic.judged.emit({
          time: pending.shift()!,
          result: null,
          jobKind: 'onsets',
          detectorVersion: DETECTOR_VERSION,
          processingMs: 1,
        });
      }
      t.runner.tick();
    });
    await flush();
    expect(t.view().analysis?.hitRate).toBe(1);
    expect(t.runner.finish()).toMatchObject({ bpm: 75, ladder: 'stay' });
    expect(t.runner.effectiveParams().bpm).toBe(75);
    expect(t.view().nextBpm).toBe(75);
  });

  it('without a microphone (ready): the picked tempo is the self-rated run, a pass steps up from it', () => {
    const t = waiting({ bars: 8 }, false);
    expect(t.runner.snapshot().phase).toBe('ready');
    t.runner.command('inc');
    t.runner.command('toggle');
    t.output.run(t.clock, 30, () => t.runner.tick());
    t.runner.command('manual1');
    expect(t.runner.finish()).toMatchObject({ bpm: 85, ladder: 'up', passed: true });
    expect(t.view().nextBpm).toBe(90);
  });

  it('is ignored once the run began, when the tempo is locked, and clamps (6/8 at 80)', async () => {
    const t = waiting();
    t.runner.command('toggle');
    await flush();
    t.runner.command('inc');
    expect(t.view().bpm).toBe(80);
    expect(t.output.lastConfig).toMatchObject({ bpm: 80 });

    const locked = waiting({ tempoLocked: true });
    expect(locked.view().tempoPickable).toBe(false);
    locked.runner.command('dec');
    expect(locked.view().bpm).toBe(80);
    expect(locked.runner.snapshot().phase).toBe('armed');

    const sixEight = waiting({ patternId: 'P5', bpm: 75 });
    sixEight.runner.command('inc');
    sixEight.runner.command('inc');
    expect(sixEight.view().bpm).toBe(80);
    // A 6/8 run linked above the cap: + does nothing, − steps down from where it is.
    const linked = waiting({ patternId: 'P5', bpm: 90 });
    linked.runner.command('inc');
    expect(linked.view().bpm).toBe(90);
    linked.runner.command('dec');
    expect(linked.view().bpm).toBe(80);
    const slow = waiting({ bpm: 35 });
    slow.runner.command('dec');
    slow.runner.command('dec');
    expect(slow.view().bpm).toBe(30);
  });

  it('a strum heard right after a pick does not start the armed run; one after the quiet window does', async () => {
    const t = waiting();
    t.runner.command('inc');
    t.output.run(t.clock, 0.3);
    t.mic.coarse.emit(t.clock.t);
    await flush();
    expect(t.runner.snapshot().phase).toBe('armed');
    t.output.run(t.clock, 0.4);
    t.mic.coarse.emit(t.clock.t);
    await flush();
    expect(t.runner.snapshot().phase).toBe('countIn');
    expect(t.output.lastConfig).toMatchObject({ bpm: 85 });
  });
});

describe('E5 live feedback while playing (D-077)', () => {
  it('bars are judged while the run plays, slot by slot, and agree with the final analysis', async () => {
    const t = await setup({ patternId: 'P3', bpm: 80, bars: 4 }, { rttMs: 20 });
    const grid = t.output.metronome.gridStartTime()!;
    const slots = slotGrid(patternById('P3'), 80, 4, 0);
    // Bar 1 played right; bar 2 misses its first slot; bar 3 adds a strum in a rest slot; bar 4 not played.
    const offsets = slots.flatMap((slot, i) => {
      const bar = Math.floor(i / 8);
      if (bar === 3 || (bar === 1 && i === 8)) return [];
      if (slot.expected) return [slot.time];
      return bar === 2 && i === 17 ? [slot.time] : [];
    });
    const pending = offsets.map((o) => grid + o + 0.02).sort((a, b) => a - b);
    let midRun: string[] | null = null;
    t.output.run(t.clock, grid - t.clock.t + 4 * 3 + 4, () => {
      while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
        t.mic.judged.emit({
          time: pending.shift()!,
          result: null,
          jobKind: 'onsets',
          detectorVersion: DETECTOR_VERSION,
          processingMs: 1.5,
        });
      }
      t.runner.tick();
      // 1.3 s into bar 3: bars 1 and 2 are already on screen.
      if (midRun === null && t.clock.t >= grid + 2 * 3 + 1.3) {
        expect(t.runner.snapshot().phase).toBe('running');
        midRun = t.view().liveBars.map((b) => b.status);
        expect(t.view().liveBars[1]!.judgements[0]).toBe('miss');
      }
    });
    await flush();
    expect(midRun).toEqual(['good', 'off']);
    const live = t.view().liveBars;
    expect(live.map((b) => b.status)).toEqual(['good', 'off', 'off', 'stop']);
    expect(live[2]!.extras).toBe(1);
    const analysis = t.view().analysis!;
    expect(live.reduce((sum, b) => sum + b.hits, 0)).toBe(analysis.hits);
    expect(live.reduce((sum, b) => sum + b.extras, 0)).toBe(analysis.extras);
  });

  it('no live bars without a microphone', async () => {
    const t = await setup({}, { mic: false });
    t.output.run(t.clock, 30, () => t.runner.tick());
    expect(t.view().liveBars).toEqual([]);
  });
});
