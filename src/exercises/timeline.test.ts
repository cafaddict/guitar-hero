import { describe, expect, it } from 'vitest';
import { Timeline } from './timeline';

describe('Timeline (D-085)', () => {
  it('one open segment: units from its grid on, nothing before the downbeat', () => {
    const tl = new Timeline(2);
    expect(tl.open).toBeNull();
    expect(tl.nextUnit).toBe(0);
    expect(tl.start(0)).toBeNull();
    tl.begin(10, 0);
    expect(tl.open).toEqual({ grid: 10, first: 0, end: null });
    expect(tl.nextUnit).toBe(0);
    expect(tl.start(0)).toBe(10);
    expect(tl.start(5)).toBe(20);
    expect(tl.position(9.9)).toBeNull();
    expect(tl.position(10)).toBe(0);
    expect(tl.position(15)).toBe(2.5);
    expect(tl.starts(3)).toEqual([10, 12, 14]);
  });

  it('a pause closes the segment, the resume continues the unit numbers on a new grid', () => {
    const tl = new Timeline(2);
    tl.begin(10, 0);
    tl.close(3);
    expect(tl.open).toBeNull();
    expect(tl.nextUnit).toBe(3);
    // The cut unit's start is the closed segment's end time until a segment plays it.
    expect(tl.start(3)).toBe(16);
    expect(tl.start(4)).toBeNull();
    expect(tl.position(15.9)).toBeCloseTo(2.95, 9);
    expect(tl.position(16)).toBeNull();
    tl.begin(40, 3);
    expect(tl.start(3)).toBe(40);
    expect(tl.start(5)).toBe(44);
    expect(tl.position(30)).toBeNull();
    expect(tl.position(41)).toBe(3.5);
    expect(tl.starts(6)).toEqual([10, 12, 14, 40, 42, 44]);
    expect(tl.segments).toHaveLength(2);
  });

  it('an empty segment is removed on close; a count-in segment can be discarded', () => {
    const tl = new Timeline(1);
    tl.begin(10, 0);
    tl.close(2);
    tl.begin(20, 2);
    tl.close(2);
    expect(tl.segments).toHaveLength(1);
    expect(tl.nextUnit).toBe(2);
    tl.begin(30, 2);
    tl.discardOpen();
    expect(tl.segments).toEqual([{ grid: 10, first: 0, end: 2 }]);
    expect(tl.nextUnit).toBe(2);
    expect(tl.starts(4)).toEqual([10, 11]);
    // Nothing open: both are no-ops.
    tl.close(5);
    tl.discardOpen();
    expect(tl.segments).toHaveLength(1);
  });

  it('bumps the version on every change and refuses overlapping or nested segments', () => {
    const tl = new Timeline(1);
    const v0 = tl.version;
    tl.begin(10, 0);
    expect(() => tl.begin(11, 1)).toThrow();
    tl.close(4);
    expect(() => tl.begin(20, 3)).toThrow();
    tl.begin(20, 4);
    tl.discardOpen();
    expect(tl.version).toBe(v0 + 4);
  });
});
