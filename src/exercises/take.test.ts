import { describe, expect, it } from 'vitest';
import { TakeTracker } from './take';

const judged = (time: number) => ({
  time,
  result: null,
  jobKind: null,
  detectorVersion: 'v',
  processingMs: 1,
});

describe('TakeTracker', () => {
  it('takes the first event after arming and ignores earlier ones', () => {
    let now = 10;
    const take = new TakeTracker(() => now);
    expect(take.decide(judged(10.5))).toBe('ignore');
    take.arm();
    expect(take.decide(judged(9.5))).toBe('ignore');
    take.noteCoarse(10.33);
    now = 11;
    expect(take.decide(judged(10.3))).toBe('take');
  });

  it('flags a second onset within 400 ms as MULTIPLE', () => {
    let now = 10;
    const take = new TakeTracker(() => now);
    take.arm();
    take.noteCoarse(10.53);
    take.noteCoarse(10.8);
    now = 11;
    expect(take.decide(judged(10.5))).toBe('multiple');
    take.arm();
    take.noteCoarse(11.53);
    take.noteCoarse(12.1);
    expect(take.decide(judged(11.5))).toBe('take');
  });

  it('asks for the energy fallback once after a silent wait', () => {
    let now = 10;
    const take = new TakeTracker(() => now);
    take.arm();
    now = 12;
    expect(take.shouldFallback(4)).toBe(false);
    now = 14.1;
    expect(take.shouldFallback(4)).toBe(true);
    expect(take.shouldFallback(4)).toBe(false);
    // An onset that never became a judged take blocks the fallback only for a moment.
    take.arm(); // armed at 14.1
    take.noteCoarse(17.5);
    now = 18.2; // 4.1 s armed, but the onset is only 0.7 s old: its judged take may still come
    expect(take.shouldFallback(4)).toBe(false);
    now = 18.6;
    expect(take.shouldFallback(4)).toBe(true);
  });
});
