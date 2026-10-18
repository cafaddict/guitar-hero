import { describe, expect, it } from 'vitest';
import { DEFAULT_METRONOME_CONFIG } from './metronome';
import { type MetronomeOutput, MetronomeRuntime } from './metronomeRuntime';
import type { Ticker } from './ticker/ticker';

function setup() {
  const clock = { currentTime: 10 };
  const played: number[] = [];
  const masks: (readonly number[])[] = [];
  const output: MetronomeOutput = {
    ensureContext: async () => clock,
    scheduleClick: (t) => played.push(t),
    setClickTimes: (times) => masks.push(times),
  };
  let onTick: (() => void) | null = null;
  const ticker: Ticker = {
    intervalMs: 25,
    lookaheadS: 0.1,
    start: (cb) => {
      onTick = cb;
    },
    stop: () => {
      onTick = null;
    },
  };
  const runtime = new MetronomeRuntime(output, () => ticker);
  const advance = (to: number, step = 0.025) => {
    while (clock.currentTime < to) {
      clock.currentTime += step;
      onTick?.();
    }
  };
  return { runtime, clock, played, masks, advance };
}

describe('MetronomeRuntime', () => {
  it('plays audible clicks at grid times and masks their expected arrival (time + RTT)', async () => {
    const { runtime, played, masks, advance } = setup();
    await runtime.start(
      { ...DEFAULT_METRONOME_CONFIG, bpm: 120, countInBars: 0 },
      { rttMs: 40, startDelayS: 0.2 },
    );
    advance(12);
    expect(played.slice(0, 4)).toEqual([10.2, 10.7, 11.2, 11.7]);
    expect(masks.at(-1)!.at(-1)).toBeCloseTo(played.at(-1)! + 0.04, 9);
    expect(runtime.gridStartTime).toBeCloseTo(10.2, 9);
    runtime.stop();
    expect(masks.at(-1)).toEqual([]);
  });

  it('visual-only mode plays nothing but still emits the grid', async () => {
    const { runtime, played, advance } = setup();
    const seen: number[] = [];
    runtime.click.on((c) => seen.push(c.time));
    await runtime.start({ ...DEFAULT_METRONOME_CONFIG, bpm: 60, visualOnly: true, countInBars: 0 });
    advance(15);
    expect(played).toEqual([]);
    expect(seen.length).toBeGreaterThanOrEqual(4);
  });

  it('skips the sound of clicks that are already late after a stall, keeps them in the grid', async () => {
    const { runtime, played, clock, advance } = setup();
    await runtime.start({ ...DEFAULT_METRONOME_CONFIG, bpm: 240, countInBars: 0 }, { startDelayS: 0.1 });
    advance(10.5);
    const before = played.length;
    clock.currentTime += 1; // main thread stalled for a second
    advance(11.6);
    const grid = runtime.recentClicks().map((c) => c.time);
    expect(grid.length).toBeGreaterThan(played.length);
    expect(played.length - before).toBeLessThan(grid.length - before);
    for (const [i, t] of grid.entries()) expect(t).toBeCloseTo(10.1 + i * 0.25, 9);
  });

  it('emits end and stops after the bar limit', async () => {
    const { runtime, advance } = setup();
    const ends: number[] = [];
    runtime.end.on((t) => ends.push(t));
    await runtime.start(
      { ...DEFAULT_METRONOME_CONFIG, bpm: 120, countInBars: 1, stopAfterBars: 2 },
      { startDelayS: 0.1 },
    );
    advance(20);
    expect(ends).toEqual([10.1 + 2 + 4]);
    expect(runtime.isRunning).toBe(false);
  });

  it('a stop while the audio context is still starting cancels that start (D-085)', async () => {
    const clock = { currentTime: 10 };
    let resolveContext: (c: typeof clock) => void = () => {};
    const output: MetronomeOutput = {
      ensureContext: () => new Promise((resolve) => (resolveContext = resolve)),
      scheduleClick: () => {},
      setClickTimes: () => {},
    };
    let tickers = 0;
    const runtime = new MetronomeRuntime(output, () => {
      tickers++;
      return { intervalMs: 25, lookaheadS: 0.1, start: () => {}, stop: () => {} };
    });
    const running: boolean[] = [];
    runtime.running.on((r) => running.push(r));
    const started = runtime.start({ ...DEFAULT_METRONOME_CONFIG, countInBars: 0 });
    runtime.stop();
    resolveContext(clock);
    await started;
    expect(tickers).toBe(0);
    expect(runtime.isRunning).toBe(false);
    expect(running).toEqual([]);
  });
});
