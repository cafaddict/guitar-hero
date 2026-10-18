/** GridRecorder pause/resume (D-085): segments, pruning, count-in pauses, the end race and held starts. */
import { describe, expect, it } from 'vitest';
import { DEFAULT_METRONOME_CONFIG } from '../audio/metronome';
import { GridRecorder } from './gridRecorder';
import { testContext } from './testing/fakes';

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

/** 60 BPM 4/4: one bar = 4 s, window ±60 ms, grace one beat (1 s); 4 bars after a 1-bar count-in. */
const BAR_S = 4;

async function setup() {
  const t = testContext();
  let barsDone = 0;
  let grids = 0;
  const recorder = new GridRecorder(
    t.ctx,
    { ...DEFAULT_METRONOME_CONFIG, bpm: 60, countInBars: 1, stopAfterBars: 4 },
    () => barsDone++,
  );
  const onGrid = () => grids++;
  recorder.start(onGrid);
  await flush();
  const grid = recorder.gridStart!;
  /** Runs the fake clock (and the metronome) up to an absolute audio time. */
  const runTo = (time: number) => t.output.run(t.clock, time - t.clock.t);
  return { t, recorder, grid, onGrid, runTo, done: () => barsDone, grids: () => grids };
}

describe('GridRecorder pause/resume (D-085)', () => {
  it('a mid-bar pause replays that bar: its events are pruned, earlier bars stay', async () => {
    const { t, recorder, grid, runTo } = await setup();
    runTo(grid + 2 * BAR_S + 1.5);
    for (const at of [0.01, BAR_S + 0.02, 2 * BAR_S - 0.1, 2 * BAR_S - 0.05, 2 * BAR_S, 2 * BAR_S + 1])
      t.mic.strike(grid + at, null);
    expect(recorder.strums).toHaveLength(6);
    const kept = recorder.strums;
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'paused', resumeBar: 2, counted: true });
    // Bar 2's beat-1 window starts at its downbeat − 60 ms: from there on the events are bar 2's.
    expect(recorder.strums).toEqual([0.01, BAR_S + 0.02, 2 * BAR_S - 0.1].map((x) => grid + x));
    expect(recorder.events.map((e) => e.time)).toEqual(recorder.strums);
    expect(recorder.strums).toBe(kept);
    expect(t.output.metronomeRunning).toBe(false);
    expect(recorder.timeline.segments).toEqual([{ grid, first: 0, end: 2 }]);
    expect(recorder.currentGrid).toBeNull();
  });

  it('late judgements of the bars before the cut still arrive (job kept on); gap and replayed-bar ones do not', async () => {
    const { t, recorder, grid, runTo } = await setup();
    runTo(grid + BAR_S + 2);
    recorder.pause(t.clock.t);
    expect(t.mic.job).toEqual({ kind: 'onsets' });
    t.clock.advance(0.5);
    t.mic.strike(grid + BAR_S - 0.5, null); // bar 0, judged after the pause
    t.mic.strike(grid + BAR_S + 0.5, null); // bar 1 (replayed)
    t.mic.strike(t.clock.t, null); // in the gap
    expect(recorder.strums).toEqual([grid + BAR_S - 0.5]);
  });

  it('the resume counts in one bar and plays the bars left from the replayed one on a new grid', async () => {
    const { t, recorder, grid, runTo, done, onGrid, grids } = await setup();
    runTo(grid + 2 * BAR_S + 1.5);
    recorder.pause(t.clock.t);
    t.clock.advance(5);
    recorder.resume(onGrid);
    await flush();
    expect(t.output.lastConfig).toMatchObject({ countInBars: 1, stopAfterBars: 2 });
    const grid2 = recorder.currentGrid!;
    expect(grid2).toBeCloseTo(t.clock.t + 0.1 + BAR_S, 9);
    expect(grids()).toBe(2);
    expect(recorder.gridStart).toBe(grid);
    t.mic.strike(grid2 - 1, null); // count-in, outside the pre-pad
    t.mic.strike(grid2 - 0.1, null); // early beat 1 of bar 2
    expect(recorder.strums).toEqual([grid2 - 0.1]);
    runTo(grid2 + 2 * BAR_S + 0.2);
    expect(done()).toBe(1);
    expect(recorder.endTime).toBeCloseTo(grid2 + 2 * BAR_S, 9);
    expect(recorder.timeline.segments.map((s) => [s.first, s.end])).toEqual([
      [0, 2],
      [2, 4],
    ]);
    expect(recorder.timeline.starts(4)).toEqual([grid, grid + BAR_S, grid2, grid2 + BAR_S]);
    expect(recorder.settled(t.clock.t)).toBe(false);
    expect(recorder.settled(recorder.endTime! + 0.7)).toBe(true);
  });

  it('a pause within one beat after a downbeat also replays the bar before', async () => {
    const { t, recorder, grid, runTo } = await setup();
    runTo(grid + 2 * BAR_S + 0.5);
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'paused', resumeBar: 1, counted: true });
    expect(recorder.timeline.segments).toEqual([{ grid, first: 0, end: 1 }]);
  });

  it('a pause in the count-in is not counted and drops its segment', async () => {
    const { t, recorder, grid, runTo, onGrid } = await setup();
    runTo(grid - 2);
    t.mic.strike(grid - 0.2, null);
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'paused', resumeBar: 0, counted: false });
    expect(recorder.timeline.segments).toEqual([]);
    expect(recorder.strums).toEqual([]);
    expect(recorder.gridStart).toBeNull();
    expect(t.output.metronomeRunning).toBe(false);
    recorder.resume(onGrid);
    await flush();
    expect(t.output.lastConfig).toMatchObject({ countInBars: 1, stopAfterBars: 4 });
    expect(recorder.timeline.open?.first).toBe(0);
  });

  it('a pause after the scheduled end (before onEnd) is ignored and the end still comes', async () => {
    const { t, recorder, grid, runTo, done } = await setup();
    runTo(grid + 4 * BAR_S - 0.2);
    t.clock.t = grid + 4 * BAR_S + 0.01; // past the last bar, the end not reported yet
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'ignored' });
    expect(t.output.metronomeRunning).toBe(true);
    t.output.run(t.clock, 0.05);
    expect(done()).toBe(1);
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'ignored' });
    expect(recorder.timeline.segments).toEqual([{ grid, first: 0, end: 4 }]);
  });

  it('pausing again before the resume or twice is ignored', async () => {
    const { t, recorder, grid, runTo, onGrid } = await setup();
    runTo(grid + 1.5);
    expect(recorder.pause(t.clock.t).kind).toBe('paused');
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'ignored' });
    recorder.resume(onGrid);
    recorder.resume(onGrid);
    await flush();
    expect(recorder.timeline.segments).toHaveLength(1);
  });

  it('resume → pause while the metronome start is held leaves no segment and the metronome stopped', async () => {
    const { t, recorder, grid, runTo, onGrid, grids } = await setup();
    runTo(grid + BAR_S + 2);
    recorder.pause(t.clock.t);
    t.output.holdStarts();
    recorder.resume(onGrid);
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'paused', resumeBar: 1, counted: false });
    t.output.releaseStarts();
    await flush();
    expect(grids()).toBe(1);
    expect(recorder.timeline.segments).toEqual([{ grid, first: 0, end: 1 }]);
    expect(t.output.metronomeRunning).toBe(false);
    // A later resume works as usual.
    recorder.resume(onGrid);
    await flush();
    expect(recorder.timeline.open?.first).toBe(1);
    expect(t.output.metronomeRunning).toBe(true);
  });

  it('dispose while the first start is held: no grid, no metronome, job released', async () => {
    const t = testContext();
    t.output.holdStarts();
    let grids = 0;
    const recorder = new GridRecorder(t.ctx, DEFAULT_METRONOME_CONFIG, () => {});
    recorder.start(() => grids++);
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'paused', resumeBar: 0, counted: false });
    recorder.resume(() => grids++);
    recorder.dispose();
    t.output.releaseStarts();
    await flush();
    t.output.run(t.clock, 2);
    expect(grids).toBe(0);
    expect(t.output.clicks).toEqual([]);
    expect(t.mic.job).toBeNull();
    expect(recorder.timeline.segments).toEqual([]);
  });

  it('options: pads and window', async () => {
    const t = testContext();
    const recorder = new GridRecorder(
      t.ctx,
      { ...DEFAULT_METRONOME_CONFIG, bpm: 60, stopAfterBars: 2 },
      () => {},
      undefined,
      undefined,
      { prePadS: 1, postPadS: 0.5, windowS: 0.5, graceS: 0 },
    );
    recorder.start(() => {});
    await flush();
    const grid = recorder.gridStart!;
    t.mic.strike(grid - 0.9, null);
    t.output.run(t.clock, grid + BAR_S + 0.1 - t.clock.t);
    expect(recorder.pause(t.clock.t)).toEqual({ kind: 'paused', resumeBar: 1, counted: true });
    t.mic.strike(grid + BAR_S - 0.6, null);
    t.mic.strike(grid + BAR_S - 0.4, null);
    expect(recorder.strums).toEqual([grid - 0.9, grid + BAR_S - 0.6]);
  });
});
