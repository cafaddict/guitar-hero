import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../domain/prng';
import { ElapsedTimer, formatClock } from './timer';

/**
 * Simulates a UI tick loop whose callbacks arrive late irregularly; background-tab throttling stretches the
 * tick period to 1 s for stretches of time. Returns when the timer was first observed done.
 */
function runWithIrregularTicks(
  seed: number,
  rate = 1,
): { doneObservedAt: number; trueEnd: number; maxPeriod: number } {
  let now = 1000;
  const timer = new ElapsedTimer({ now: () => now }, 60_000, rate);
  timer.start();
  const trueEnd = 1000 + 60_000 / rate;
  const rng = mulberry32(seed);
  let throttled = false;
  let maxPeriod = 0;
  for (;;) {
    if (rng() < 0.01) throttled = !throttled;
    const period = throttled ? 1000 : 100;
    const lateness = rng() * period * 0.5;
    const step = period + lateness;
    maxPeriod = Math.max(maxPeriod, step);
    now += step;
    // A tick-counting timer would add `period` here and drift by the accumulated lateness.
    if (timer.isDone()) return { doneObservedAt: now, trueEnd, maxPeriod };
  }
}

describe('ElapsedTimer', () => {
  it.each([1, 2, 3, 4, 5])('60 s timer ends within one tick period of the true end (seed %i)', (seed) => {
    const { doneObservedAt, trueEnd, maxPeriod } = runWithIrregularTicks(seed);
    expect(doneObservedAt).toBeGreaterThanOrEqual(trueEnd);
    expect(doneObservedAt - trueEnd).toBeLessThanOrEqual(maxPeriod);
  });

  it('rate scales simulated time (E2E time compression)', () => {
    const { doneObservedAt, trueEnd } = runWithIrregularTicks(9, 4);
    expect(trueEnd).toBe(1000 + 15_000);
    expect(doneObservedAt - trueEnd).toBeLessThanOrEqual(1500);
  });

  it('elapsed is a clock difference: pauses are excluded, ticks are irrelevant', () => {
    let now = 0;
    const timer = new ElapsedTimer({ now: () => now }, 10_000);
    expect(timer.elapsedMs()).toBe(0);
    timer.start();
    now = 3000;
    expect(timer.elapsedMs()).toBe(3000);
    timer.pause();
    now = 8000;
    expect(timer.elapsedMs()).toBe(3000);
    expect(timer.endsAt()).toBeNull();
    timer.resume();
    expect(timer.endsAt()).toBe(15_000);
    now = 14_999;
    expect(timer.isDone()).toBe(false);
    expect(timer.remainingMs()).toBe(1);
    now = 15_000;
    expect(timer.isDone()).toBe(true);
    expect(timer.remainingMs()).toBe(0);
  });

  it('open-ended timers never finish', () => {
    let now = 0;
    const timer = new ElapsedTimer({ now: () => now }, null);
    timer.start();
    now = 1e9;
    expect(timer.isDone()).toBe(false);
    expect(timer.remainingMs()).toBeNull();
  });
});

describe('formatClock', () => {
  it('rounds up to whole seconds', () => {
    expect(formatClock(60_000)).toBe('1:00');
    expect(formatClock(59_001)).toBe('1:00');
    expect(formatClock(9_000)).toBe('0:09');
    expect(formatClock(-5)).toBe('0:00');
  });
});
