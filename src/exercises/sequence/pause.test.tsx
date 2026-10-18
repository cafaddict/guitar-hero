/** Sequence exercises (E9, E10, E11, E17) pause / resume (D-085): cut cycle replayed under a new id. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { chromaticGroups, positionMidi } from '../../content/scales';
import { chromaticResultSchema, hammerResultSchema, riffResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { e9Plugin } from '../e9/plugin';
import { ChromaticRunner, e9ParamsSchema } from '../e9/runner';
import { e10Plugin } from '../e10/plugin';
import { e10ParamsSchema, ScaleRunner } from '../e10/runner';
import { e11Plugin } from '../e11/plugin';
import { e11ParamsSchema, HammerRunner } from '../e11/runner';
import { e17Plugin } from '../e17/plugin';
import { RiffRunner } from '../e17/runner';
import { testContext } from '../testing/fakes';
import type { ExerciseRunner } from '../types';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** Runs the fake clock up to an absolute audio time in 25 ms steps, letting the fake worker answer. */
async function runTo(
  t: ReturnType<typeof testContext>,
  runner: ExerciseRunner<unknown, unknown>,
  time: number,
) {
  while (t.clock.t < time) {
    t.output.run(t.clock, 0.025);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
  }
}

const grid = (t: ReturnType<typeof testContext>) => t.output.metronome.gridStartTime()!;

describe('E9 pause and resume (D-085)', () => {
  /** 60 BPM eighths: a slot = 0.5 s, a four-note group (cycle) = 2 s. */
  const params = e9ParamsSchema.parse({ startFret: 5, bpm: 60 });
  const groupMidis = (k: number) => {
    const groups = chromaticGroups(5);
    return groups[k % groups.length]!.map((p) => positionMidi(p));
  };

  it('replays the interrupted group under a new id; the first cycle after is `resumed`; the ladder stays', async () => {
    const t = testContext();
    const runner = new ChromaticRunner(t.ctx, params);
    runner.start();
    runner.command('toggle');
    await flush();
    const g1 = grid(t);
    await runTo(t, runner, g1 + 2 * 2 + 1.25);
    expect(runner.snapshot().view).toMatchObject({ cycleNumber: 2, noteIndex: 2 });
    runner.command('pause');
    expect(runner.snapshot()).toMatchObject({ phase: 'paused', view: { cycleNumber: 2, noteIndex: null } });
    await runTo(t, runner, t.clock.t + 3);
    // The groups before the cut are judged while paused; the cut one never completes.
    expect(runner.snapshot().view.cycles).toHaveLength(2);
    runner.command('pause');
    await flush();
    expect(t.output.lastConfig?.countInBars).toBe(1);
    const g2 = grid(t);
    await runTo(t, runner, g2 - 0.5);
    // Groups 3 and 4 were already planned ahead (and dropped): the replay is cycle id 5, group 2's notes.
    const counting = runner.snapshot();
    expect(counting).toMatchObject({ phase: 'countIn', view: { cycleNumber: 5, noteIndex: null } });
    expect(counting.view.cycleNotes.map((n) => n.midi)).toEqual(groupMidis(2));
    await runTo(t, runner, g2 + 0.6);
    expect(runner.snapshot()).toMatchObject({ phase: 'running', view: { cycleNumber: 5, noteIndex: 1 } });
    // Twelve more groups (more than the 10 in a row that would step up), then stop.
    await runTo(t, runner, g2 + 12 * 2 + 0.1);
    runner.command('toggle');
    await runTo(t, runner, t.clock.t + 3);
    expect(runner.snapshot().phase).toBe('done');
    const requested = t.mic.sequenceRequests.flatMap((r) => r.slots);
    const replay = requested.filter((s) => s.time >= g2 && s.time < g2 + 2).map((s) => s.midi);
    expect(replay).toEqual(groupMidis(2));
    const next = requested.filter((s) => s.time >= g2 + 2 && s.time < g2 + 4).map((s) => s.midi);
    expect(next).toEqual(groupMidis(3));
    const result = chromaticResultSchema.parse(runner.finish());
    expect(result.cycles.length).toBeGreaterThanOrEqual(13);
    expect(result.cycles.every((c) => c.flawless)).toBe(true);
    expect(result.cycles.map((c) => c.resumed === true)).toEqual(result.cycles.map((_, i) => i === 2));
    expect(result).toMatchObject({ ladder: 'stay', pauses: 1 });
    // The pause gap is not an interval: as even as an uninterrupted run.
    expect(result.ioiCv!).toBeCloseTo(0, 6);
    expect(renderToStaticMarkup(<e9Plugin.Summary result={result} params={params} />)).toContain(
      ko.exercises.common.pausedRun,
    );
  });

  it('a pause within one beat of a group start replays the group before, unless it was recorded', async () => {
    for (const recordFirst of [false, true]) {
      const t = testContext({ mic: false });
      const runner = new ChromaticRunner(t.ctx, params);
      runner.start();
      runner.command('toggle');
      await flush();
      const g1 = grid(t);
      await runTo(t, runner, g1 + 3.9);
      if (recordFirst) runner.command('manual1'); // group 1 self-reported
      await runTo(t, runner, g1 + 4.5);
      expect(runner.snapshot().view.cycleNumber).toBe(2);
      runner.command('pause');
      expect(runner.snapshot().view.cycleNumber).toBe(recordFirst ? 2 : 1);
    }
  });

  it('a pause in the count-in is not counted: the run can still step up', async () => {
    const t = testContext({ mic: false });
    const runner = new ChromaticRunner(t.ctx, params);
    runner.start();
    runner.command('toggle');
    await flush();
    await runTo(t, runner, grid(t) - 1);
    runner.command('pause');
    runner.command('toggle'); // Space resumes too
    await flush();
    await runTo(t, runner, grid(t) + 0.1);
    for (let i = 0; i < 10; i++) runner.command('manual1');
    runner.command('toggle');
    const result = runner.finish();
    expect(result.ladder).toBe('up');
    expect(result.pauses).toBeUndefined();
    expect(result.cycles.some((c) => c.resumed)).toBe(false);
  });
});

describe('E17 pause (D-085)', () => {
  it('Enter while paused ends the run; the cycles judged before the pause are kept', async () => {
    const t = testContext();
    const runner = new RiffRunner(t.ctx, { riffId: 'R1', bpm: 60, tabHidden: true, previousLow: false });
    runner.start();
    runner.command('toggle');
    await flush();
    const pass = runner.snapshot().view.cycleNotes.length; // quarter notes: one second each
    await runTo(t, runner, grid(t) + 2 * pass + 1.5);
    runner.command('pause');
    runner.command('hide');
    runner.command('next');
    expect(runner.snapshot().phase).toBe('review');
    await runTo(t, runner, t.clock.t + 3);
    expect(runner.snapshot().phase).toBe('done');
    const result = riffResultSchema.parse(runner.finish());
    expect(result.cycles).toHaveLength(2);
    expect(result).toMatchObject({ ladder: 'stay', pauses: 1, tabHidden: false });
    expect(runner.effectiveParams().tabHidden).toBe(false);
  });
});

describe('E10 step-6 backing across a pause (D-085)', () => {
  it('stops with the pause and starts again one bar before the new grid', async () => {
    const t = testContext();
    const backing = () => ({ signal: new Float32Array(16), events: [] });
    const runner = new ScaleRunner(
      t.ctx,
      e10ParamsSchema.parse({ scaleId: 'em-pent-open', bpm: 60, withBacking: true, earphones: true }),
      backing,
    );
    runner.start();
    runner.command('toggle');
    await flush();
    const barS = 4;
    expect(t.output.backings[0]!.at).toBeCloseTo(grid(t) - barS, 9);
    await runTo(t, runner, grid(t) + 6);
    runner.command('pause');
    expect(t.output.backings[0]!.stopped).toBe(true);
    await runTo(t, runner, t.clock.t + 2);
    runner.command('pause');
    await flush();
    expect(t.output.backings).toHaveLength(2);
    expect(t.output.backings[1]!.at).toBeCloseTo(grid(t) - barS, 9);
    expect(t.output.backings[1]!.stopped).toBe(false);
    expect(e10Plugin.pausable).toBe(true);
  });

  it('a paused run neither graduates nor memorizes, even with four flawless cycles at 80', async () => {
    const t = testContext({ mic: false });
    const runner = new ScaleRunner(
      t.ctx,
      e10ParamsSchema.parse({ scaleId: 'em-pent-open', bpm: 80, tabHidden: true }),
    );
    runner.start();
    runner.command('toggle');
    await flush();
    await runTo(t, runner, grid(t) + 2);
    runner.command('pause');
    runner.command('pause');
    await flush();
    await runTo(t, runner, grid(t) + 0.1);
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('toggle');
    expect(runner.finish()).toMatchObject({ graduated: false, memorized: false, ladder: 'stay', pauses: 1 });
  });
});

describe('E11 played time across a pause (D-085)', () => {
  it('the daily cap and durationMs leave the pause out; a pause does not ask for the rating', async () => {
    const t = testContext({ mic: false });
    // 9 minutes played today: 60 s left.
    const runner = new HammerRunner(t.ctx, e11ParamsSchema.parse({ minutesToday: 9 }));
    runner.start();
    runner.command('toggle');
    await flush();
    t.output.run(t.clock, 30, () => runner.tick());
    runner.command('pause');
    t.output.run(t.clock, 100, () => runner.tick());
    expect(runner.snapshot().phase).toBe('paused');
    runner.command('pause');
    await flush();
    t.output.run(t.clock, 25, () => runner.tick());
    expect(runner.snapshot().phase).not.toBe('review');
    t.output.run(t.clock, 10, () => runner.tick());
    expect(runner.snapshot()).toMatchObject({ phase: 'review', view: { awaitingRating: true } });
    runner.command('manual3');
    const result = hammerResultSchema.parse(runner.finish());
    expect(result.durationMs).toBeGreaterThanOrEqual(60_000);
    expect(result.durationMs).toBeLessThan(60_100);
    expect(result).toMatchObject({ evenRating: 3, ladder: 'stay', pauses: 1 });
    expect(e11Plugin.pausable && e17Plugin.pausable && e9Plugin.pausable).toBe(true);
  });
});
