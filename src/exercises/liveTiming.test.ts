import { describe, expect, it } from 'vitest';
import { patternById } from '../content/patterns';
import { mulberry32 } from '../domain/prng';
import { analyzeTiming, timingWindowMs } from '../dsp/timing';
import { slotGrid } from './e5/runner';
import { barReadyAt, barsOf, judgeBeatOne, LIVE_LAG_S, settleBars } from './liveTiming';

describe('live per-bar timing (D-077)', () => {
  it('bar by bar gives exactly the final analysis: same slot verdicts, hits, misses and extras', () => {
    for (const patternId of ['P0', 'P3', 'P5', 'P6', 'P7', 'P8'] as const) {
      for (const bpm of [60, 90, 120]) {
        const pattern = patternById(patternId);
        const rttS = 0.031;
        const slots = slotGrid(pattern, bpm, 8, 10);
        const windowS = timingWindowMs(bpm) / 1000;
        const rng = mulberry32(bpm * 7 + patternId.charCodeAt(1));
        const strums: number[] = [];
        slots.forEach((slot, i) => {
          const at = slot.time + rttS;
          if (slot.expected && rng() < 0.85) strums.push(at + (rng() * 2 - 1) * 1.6 * windowS);
          // Extras between this slot and the next one (never past the last slot's half gap).
          const next = slots[i + 1];
          if (next && rng() < 0.15) strums.push(at + (next.time - slot.time) * (0.3 + 0.4 * rng()));
        });
        strums.sort((a, b) => a - b);
        const bars = barsOf(slots, pattern.slots.length);
        const live = settleBars(bars, strums, rttS, bpm, Number.POSITIVE_INFINITY, []);
        const full = analyzeTiming(slots, strums, rttS, bpm, null);
        expect(live.flatMap((b) => b.judgements)).toEqual(full.judgements);
        expect(live.reduce((s, b) => s + b.hits, 0)).toBe(full.hits);
        expect(live.reduce((s, b) => s + b.misses, 0)).toBe(full.misses);
        expect(live.reduce((s, b) => s + b.extras, 0)).toBe(full.extras);
      }
    }
  });

  it('a bar is judged only once its strums can all have been heard, then never changes', () => {
    const bpm = 80;
    const slots = slotGrid(patternById('P4'), bpm, 4, 0);
    const bars = barsOf(slots, 8);
    const strums = slots.map((s) => s.time + 0.02);
    const ready0 = barReadyAt(bars[0]!, 0.02, bpm);
    expect(ready0).toBeCloseTo(slots[7]!.time + 0.02 + 0.05 + LIVE_LAG_S, 9);
    // Not before the region's end (half way to bar 2's first slot) plus the arrival lag either.
    const before = settleBars(bars, strums, 0.02, bpm, ready0 - 0.01, []);
    expect(before).toHaveLength(0);
    const one = settleBars(bars, strums, 0.02, bpm, 3.6, []);
    expect(one).toHaveLength(1);
    expect(one[0]).toMatchObject({ bar: 0, status: 'good', hits: 8, misses: 0, extras: 0 });
    // Already judged bars are kept as they were.
    expect(settleBars(bars, [], 0.02, bpm, 3.6, one)[0]).toBe(one[0]);
  });

  it('statuses: all right → good, a few wrong → off, half missed → miss, nothing played → stop', () => {
    const bpm = 60;
    const slots = slotGrid(patternById('P4'), bpm, 4, 0);
    const bars = barsOf(slots, 8);
    const at = (i: number) => slots[i]!.time;
    const strums = [
      ...[0, 1, 2, 3, 4, 5, 6, 7].map(at), // bar 1: every slot
      ...[8, 9, 10, 11, 12, 13, 14].map(at), // bar 2: one missed
      ...[16, 17, 18].map(at), // bar 3: five missed
    ];
    const live = settleBars(bars, strums, 0, bpm, Number.POSITIVE_INFINITY, []);
    expect(live.map((b) => b.status)).toEqual(['good', 'off', 'miss', 'stop']);
  });

  it('E6 beat 1: on time, late (with the offset) as soon as heard, a stop only after the bar', () => {
    const base = { gridStart: 10, barS: 3, rttS: 0.03, bpm: 80 };
    const beat1 = (bar: number) => 10 + bar * 3 + 0.03;
    const good = judgeBeatOne({ ...base, bar: 0, strums: [beat1(0) + 0.02], now: beat1(0) + 1 });
    expect(good).toMatchObject({ status: 'good', hits: 1 });
    expect(good!.offsetMs).toBeCloseTo(20, 6);
    expect(judgeBeatOne({ ...base, bar: 1, strums: [beat1(1) + 0.12], now: beat1(1) + 0.5 })).toBeNull();
    const late = judgeBeatOne({ ...base, bar: 1, strums: [beat1(1) + 0.12], now: beat1(1) + 0.9 });
    expect(late).toMatchObject({ status: 'off', hits: 0 });
    expect(late!.offsetMs).toBeCloseTo(120, 6);
    expect(judgeBeatOne({ ...base, bar: 2, strums: [], now: beat1(2) + 2 })).toBeNull();
    expect(judgeBeatOne({ ...base, bar: 2, strums: [], now: beat1(2) + 3.7 })).toMatchObject({
      status: 'stop',
    });
  });
});
