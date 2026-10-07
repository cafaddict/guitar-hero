import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../domain/prng';
import {
  DEFAULT_METRONOME_CONFIG,
  latestPassedClick,
  type MetronomeConfig,
  MetronomeScheduler,
  nextLadderBpm,
  type ScheduledClick,
  TapTempo,
} from './metronome';

/** Fake audio clock driven by a simulated timer whose callbacks arrive late (0–150 ms, sometimes 1 s). */
function simulate(
  config: MetronomeConfig,
  durationS: number,
  seed: number,
  events: { at: number; run: (s: MetronomeScheduler) => void }[] = [],
): { clicks: ScheduledClick[]; scheduler: MetronomeScheduler; ends: number[]; lateness: number[] } {
  let now = 0;
  const clicks: ScheduledClick[] = [];
  const lateness: number[] = [];
  const ends: number[] = [];
  const scheduler = new MetronomeScheduler(
    { now: () => now },
    (c) => {
      clicks.push(c);
      lateness.push(now - c.time);
    },
    { lookaheadS: 0.1, onEnd: (t) => ends.push(t) },
  );
  const rng = mulberry32(seed);
  scheduler.start(config, 0.1);
  const pending = [...events].sort((a, b) => a.at - b.at);
  let nominal = 0;
  while (now < durationS) {
    nominal += 0.025;
    const jitter = rng() < 0.002 ? 1 : rng() * 0.15;
    now = Math.max(now, nominal + jitter);
    while (pending.length > 0 && pending[0]!.at <= now) pending.shift()!.run(scheduler);
    scheduler.tick();
  }
  return { clicks, scheduler, ends, lateness };
}

describe('MetronomeScheduler', () => {
  it('10 minutes with a jittery timer: every click exactly on the grid, none missing or duplicated', () => {
    const config: MetronomeConfig = { ...DEFAULT_METRONOME_CONFIG, bpm: 120, subdivision: 2, countInBars: 1 };
    const { clicks, lateness } = simulate(config, 600, 7);
    const step = 60 / 120 / 2;
    const expected = Math.floor((600 - 0.1) / step);
    expect(clicks.length).toBeGreaterThanOrEqual(expected);
    clicks.forEach((c, i) => {
      expect(c.index).toBe(i);
      expect(Math.abs(c.time - (0.1 + i * step))).toBeLessThan(1e-9);
    });
    // The simulated timer really was hostile: some callbacks arrived after the click time (1 s stalls).
    expect(Math.max(...lateness)).toBeGreaterThan(0.5);
    // Bars, beats and subdivisions follow the sequence.
    expect(clicks.slice(0, 10).map((c) => [c.bar, c.beat, c.sub])).toEqual([
      [-1, 0, 0],
      [-1, 0, 1],
      [-1, 1, 0],
      [-1, 1, 1],
      [-1, 2, 0],
      [-1, 2, 1],
      [-1, 3, 0],
      [-1, 3, 1],
      [0, 0, 0],
      [0, 0, 1],
    ]);
  });

  it.each([30, 61, 97, 240])('stays exact at %i BPM over 10 minutes (3/4, triplets)', (bpm) => {
    const { clicks } = simulate(
      { ...DEFAULT_METRONOME_CONFIG, bpm, meter: '3/4', subdivision: 3, countInBars: 0 },
      600,
      bpm,
    );
    const step = 60 / bpm / 3;
    for (const [i, c] of clicks.entries()) expect(Math.abs(c.time - (0.1 + i * step))).toBeLessThan(1e-9);
    expect(clicks.at(-1)!.time).toBeGreaterThan(599);
  });

  it('a tempo change applies from the next unscheduled beat; scheduled clicks never move', () => {
    const config: MetronomeConfig = { ...DEFAULT_METRONOME_CONFIG, bpm: 60, countInBars: 0 };
    const { clicks } = simulate(config, 30, 3, [{ at: 10.03, run: (s) => s.setBpm(120) }]);
    const times = clicks.map((c) => c.time);
    // Beats 0.1, 1.1, …, 10.1 were scheduled by the time the change arrived (lookahead 0.1 s, jitter ≤ 0.15 s)
    // or are the next beat; from the beat after the change the spacing is 0.5 s.
    const changeIdx = clicks.findIndex((c) => c.bpm === 120);
    expect(changeIdx).toBeGreaterThan(9);
    for (let i = 1; i < changeIdx; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(1, 9);
    for (let i = changeIdx + 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(0.5, 9);
    // The first new-tempo beat sits exactly on the old grid.
    expect(times[changeIdx]! - 0.1).toBeCloseTo(Math.round(times[changeIdx]! - 0.1), 9);
  });

  it('defers a tempo change requested during the count-in so the grid origin does not move', () => {
    const config: MetronomeConfig = { ...DEFAULT_METRONOME_CONFIG, bpm: 60, countInBars: 1 };
    const { clicks, scheduler } = simulate(config, 12, 4, [{ at: 1.5, run: (s) => s.setBpm(90) }]);
    expect(scheduler.gridStartTime).toBeCloseTo(4.1, 9);
    const bar0 = clicks.find((c) => c.bar === 0)!;
    expect(bar0.time).toBeCloseTo(4.1, 9);
    expect(bar0.bpm).toBe(90);
    expect(clicks.filter((c) => c.countIn).every((c) => c.bpm === 60)).toBe(true);
  });

  it('count-in bars are flagged and audible; muted bars follow the play/mute cycle', () => {
    const config: MetronomeConfig = {
      ...DEFAULT_METRONOME_CONFIG,
      bpm: 120,
      countInBars: 2,
      mutedBars: { play: 2, mute: 1 },
    };
    const { clicks } = simulate(config, 20, 5);
    expect(clicks.filter((c) => c.countIn)).toHaveLength(8);
    expect(clicks.filter((c) => c.countIn).every((c) => c.audible && !c.muted)).toBe(true);
    const byBar = new Map<number, ScheduledClick[]>();
    for (const c of clicks.filter((x) => !x.countIn)) byBar.set(c.bar, [...(byBar.get(c.bar) ?? []), c]);
    for (const [bar, list] of byBar) {
      const muted = bar % 3 === 2;
      expect(list.every((c) => c.muted === muted && c.audible === !muted)).toBe(true);
      // The grid continues through muted bars.
      expect(list).toHaveLength(bar === Math.max(...byBar.keys()) ? list.length : 4);
    }
  });

  it('visual-only mode never asks for a sound but keeps the full grid', () => {
    const { clicks } = simulate({ ...DEFAULT_METRONOME_CONFIG, bpm: 100, visualOnly: true }, 30, 6);
    expect(clicks.length).toBeGreaterThan(45);
    expect(clicks.some((c) => c.audible)).toBe(false);
  });

  it('accents: bar downbeat, 6/8 secondary accent on the 4th eighth, quieter subdivisions', () => {
    const { clicks } = simulate(
      { ...DEFAULT_METRONOME_CONFIG, bpm: 120, meter: '6/8', countInBars: 0 },
      4,
      8,
    );
    expect(clicks.slice(0, 6).map((c) => c.level)).toEqual(['accent', 'sub', 'sub', 'beat', 'sub', 'sub']);
    const sub = simulate(
      { ...DEFAULT_METRONOME_CONFIG, bpm: 60, subdivision: 2, countInBars: 0 },
      3,
      9,
    ).clicks;
    expect(sub.slice(0, 4).map((c) => c.level)).toEqual(['accent', 'sub', 'beat', 'sub']);
  });

  it('stops after N bars (count-in excluded) and reports the end time once', () => {
    const config: MetronomeConfig = {
      ...DEFAULT_METRONOME_CONFIG,
      bpm: 120,
      countInBars: 1,
      stopAfterBars: 3,
    };
    const { clicks, ends, scheduler } = simulate(config, 20, 10);
    expect(clicks.filter((c) => !c.countIn)).toHaveLength(12);
    expect(ends).toEqual([0.1 + 2 + 3 * 2]);
    expect(scheduler.isRunning).toBe(false);
  });

  it('stops after a time limit measured from bar 0', () => {
    const config: MetronomeConfig = { ...DEFAULT_METRONOME_CONFIG, bpm: 60, countInBars: 1, stopAfterS: 10 };
    const { clicks, ends } = simulate(config, 30, 11);
    expect(ends).toEqual([4.1 + 10]);
    expect(clicks.filter((c) => !c.countIn)).toHaveLength(10);
    expect(Math.max(...clicks.map((c) => c.time))).toBeLessThan(14.1);
  });

  it('stop() halts scheduling immediately', () => {
    const { clicks } = simulate({ ...DEFAULT_METRONOME_CONFIG, bpm: 120 }, 10, 12, [
      { at: 5, run: (s) => s.stop() },
    ]);
    expect(Math.max(...clicks.map((c) => c.time))).toBeLessThan(5 + 0.1 + 0.15 + 1e-9);
  });

  it('clamps BPM to 30–240', () => {
    const s = new MetronomeScheduler({ now: () => 0 }, () => {}, { lookaheadS: 0.1 });
    s.start({ ...DEFAULT_METRONOME_CONFIG, bpm: 500 }, 0);
    expect(s.currentConfig.bpm).toBe(240);
    s.setBpm(5);
    expect(s.bpm).toBe(30);
  });
});

describe('TapTempo', () => {
  it('averages the last 4 intervals and resets after 2 s of silence', () => {
    const tap = new TapTempo();
    expect(tap.tap(0)).toBeNull();
    expect(tap.tap(500)).toBe(120);
    tap.tap(1000);
    tap.tap(1500);
    // Last four intervals: 500, 500, 500, 1000 → mean 625 ms → 96 BPM.
    expect(tap.tap(2500)).toBe(96);
    // Six taps: only the last four intervals count.
    expect(tap.tap(3000)).toBe(96);
    expect(tap.tap(6000)).toBeNull();
    expect(tap.tap(7000)).toBe(60);
  });
});

describe('nextLadderBpm', () => {
  it('steps up only after a pass and never beyond the target', () => {
    const ladder = { startBpm: 60, targetBpm: 80, stepBpm: 5 };
    expect(nextLadderBpm(ladder, 60, true)).toBe(65);
    expect(nextLadderBpm(ladder, 60, false)).toBe(60);
    expect(nextLadderBpm(ladder, 78, true)).toBe(80);
  });
});

describe('latestPassedClick', () => {
  it('finds the most recent click at or before now', () => {
    const clicks = [0.1, 0.6, 1.1, 1.6].map((time, index) => ({ time, index }) as ScheduledClick);
    expect(latestPassedClick(clicks, 0)).toBeNull();
    expect(latestPassedClick(clicks, 0.6)?.index).toBe(1);
    expect(latestPassedClick(clicks, 1.3)?.index).toBe(2);
    expect(latestPassedClick(clicks, 9)?.index).toBe(3);
  });
});
