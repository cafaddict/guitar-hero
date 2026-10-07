import { describe, expect, it } from 'vitest';
import { DAY_MS } from './records';
import { dueReviews, enqueueReview, recordReview, weeklyStreak } from './srs';

const NOW = new Date(2026, 9, 7, 19).getTime(); // Wednesday

describe('AC-R3 review queue', () => {
  it('intervals 1 → 3 → 7 → 14 → 30 → 90 days, capped at 90', () => {
    let item = enqueueReview('chord:D', 'chord', NOW);
    expect(item.due).toBe(NOW + DAY_MS);
    const seen: number[] = [];
    let t = NOW;
    for (let i = 0; i < 6; i++) {
      t = item.due;
      item = recordReview(item, true, t);
      seen.push((item.due - t) / DAY_MS);
    }
    expect(seen).toEqual([3, 7, 14, 30, 90, 90]);
  });

  it('failure steps back one interval and counts a lapse', () => {
    let item = enqueueReview('pair:A|D', 'pair', NOW);
    item = recordReview(item, true, NOW); // step 1 (3 d)
    item = recordReview(item, true, NOW); // step 2 (7 d)
    const failed = recordReview(item, false, NOW);
    expect(failed.step).toBe(1);
    expect(failed.due - NOW).toBe(3 * DAY_MS);
    expect(failed.lapses).toBe(1);
    const atStart = recordReview(enqueueReview('chord:A', 'chord', NOW), false, NOW);
    expect(atStart.step).toBe(0);
    expect(atStart.due - NOW).toBe(DAY_MS);
  });

  it('songs use 1 week → 2 weeks → 1 month → 3 months → 6 months → 1 year', () => {
    let item = enqueueReview('song:s01', 'song', NOW);
    const days = [(item.due - NOW) / DAY_MS];
    for (let i = 0; i < 5; i++) {
      item = recordReview(item, true, NOW);
      days.push((item.due - NOW) / DAY_MS);
    }
    expect(days).toEqual([7, 14, 30, 90, 180, 365]);
  });

  it('lists due items, oldest due first', () => {
    const a = { ...enqueueReview('chord:D', 'chord', NOW - 5 * DAY_MS) };
    const b = { ...enqueueReview('chord:A', 'chord', NOW - 3 * DAY_MS) };
    const c = { ...enqueueReview('chord:E', 'chord', NOW) };
    expect(dueReviews([c, b, a], NOW).map((x) => x.subjectKey)).toEqual(['chord:D', 'chord:A']);
  });
});

describe('AC-R3 weekly streak', () => {
  const day = (offset: number) => new Date(2026, 9, 7 + offset, 20).getTime();
  // 2026-10-05 is a Monday.
  const week = (mondayOffset: number, days: number) =>
    Array.from({ length: days }, (_, i) => day(mondayOffset - 2 + i));

  it('counts consecutive weeks with ≥ 4 practice days', () => {
    const times = [...week(-14, 4), ...week(-7, 5)];
    expect(weeklyStreak(times, NOW)).toBe(2); // current week not yet qualifying does not break it
    expect(weeklyStreak([...times, ...week(0, 3)], NOW)).toBe(2);
    expect(weeklyStreak([...times, day(-2), day(-1), day(0), day(1)], day(1))).toBe(3);
  });

  it('breaks on a week with fewer than 4 days', () => {
    expect(weeklyStreak([...week(-21, 4), ...week(-14, 3), ...week(-7, 4)], NOW)).toBe(1);
    expect(weeklyStreak([], NOW)).toBe(0);
  });

  it('multiple sessions on one day count once', () => {
    const sameDay = [day(-9), day(-9) + 1000, day(-9) + 2000, day(-8)];
    expect(weeklyStreak(sameDay, NOW)).toBe(0);
  });
});
