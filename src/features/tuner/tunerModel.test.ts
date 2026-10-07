import { describe, expect, it } from 'vitest';
import { midiToHz } from '../../domain/theory';
import { displayFor, expectedF0For, InTuneTracker } from './tunerModel';

describe('tuner display', () => {
  it('string mode measures against the open string; auto mode against the nearest note', () => {
    expect(expectedF0For({ kind: 'auto' })).toBeNull();
    expect(expectedF0For({ kind: 'string', idx: 1 })).toBeCloseTo(110, 9);
    expect(expectedF0For({ kind: 'string', idx: 1 }, [0, 12])).toBeCloseTo(110 * 2 ** (12 / 1200), 9);
    const d = displayFor({ kind: 'string', idx: 1 }, 110 * 2 ** (-30 / 1200));
    expect(d.note).toBe('A2');
    expect(d.cents).toBeCloseTo(-30, 6);
    const auto = displayFor({ kind: 'auto' }, midiToHz(55) * 2 ** (8 / 1200));
    expect(auto.note).toBe('G3');
    expect(auto.cents).toBeCloseTo(8, 6);
  });

  it('"in tune" needs 5 consecutive readings within ±3 cents', () => {
    const t = new InTuneTracker();
    expect([1, -2, 2.9, 0, 0.5].map((c) => t.push(c))).toEqual([false, false, false, false, true]);
    expect(t.push(3.5)).toBe(false);
    t.push(null);
    expect([0, 0, 0, 0].map((c) => t.push(c)).at(-1)).toBe(false);
    expect(t.push(0)).toBe(true);
  });
});
