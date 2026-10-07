import { describe, expect, it } from 'vitest';
import { DAY_MS } from './records';
import { breakReminderDue, decideSessionLength, nextStretchStartFret, painAdvice } from './safety';

const NOW = new Date(2026, 9, 7, 19).getTime();

describe('AC-R4 safety rules', () => {
  it('first 4 weeks: sessions capped at 20 minutes with confirmation', () => {
    expect(decideSessionLength(20, NOW - 3 * DAY_MS, NOW, false)).toEqual({
      minutes: 20,
      needsConfirmation: false,
      capped: false,
    });
    expect(decideSessionLength(30, NOW - 3 * DAY_MS, NOW, false)).toEqual({
      minutes: 20,
      needsConfirmation: true,
      capped: true,
    });
    expect(decideSessionLength(30, null, NOW, false).capped).toBe(true);
    expect(decideSessionLength(30, NOW - 3 * DAY_MS, NOW, true)).toEqual({
      minutes: 30,
      needsConfirmation: false,
      capped: false,
    });
    expect(decideSessionLength(30, NOW - 28 * DAY_MS, NOW, false)).toEqual({
      minutes: 30,
      needsConfirmation: false,
      capped: false,
    });
  });

  it('30 minutes of continuous practice → break reminder', () => {
    expect(breakReminderDue(29 * 60_000)).toBe(false);
    expect(breakReminderDue(30 * 60_000)).toBe(true);
  });

  it('pain ≥ 5 → reduce fingertip load; danger symptoms → rest day', () => {
    expect(painAdvice(null)).toBe('none');
    expect(painAdvice({ pain: 4, dangerFlags: [], difficulty: 3, note: '' })).toBe('none');
    expect(painAdvice({ pain: 5, dangerFlags: [], difficulty: 3, note: '' })).toBe('reduceFingertipLoad');
    expect(painAdvice({ pain: 1, dangerFlags: ['sharp'], difficulty: 3, note: '' })).toBe('restDay');
    expect(painAdvice({ pain: 9, dangerFlags: ['joint'], difficulty: 3, note: '' })).toBe('restDay');
  });

  it('E7 stretch: three sessions with pain ≤ 2 → one fret lower, never below 1', () => {
    expect(nextStretchStartFret(5, [2, 1, 0])).toBe(4);
    expect(nextStretchStartFret(5, [3, 1, 0])).toBe(5);
    expect(nextStretchStartFret(5, [1, 0])).toBe(5);
    expect(nextStretchStartFret(1, [0, 0, 0])).toBe(1);
  });
});
