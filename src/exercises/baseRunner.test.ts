import { describe, expect, it } from 'vitest';
import { BaseRunner } from './baseRunner';
import { testContext } from './testing/fakes';
import type { RunnerCommand } from './types';

class TimedRunner extends BaseRunner<number, null> {
  protected view(): null {
    return null;
  }
  start(): void {
    this.startTimer(10_000);
    this.setPhase('running');
  }
  command(_cmd: RunnerCommand): void {}
  finish(): number {
    return 0;
  }
  hasResult(): boolean {
    return true;
  }
}

describe('BaseRunner', () => {
  it('publishes the countdown once per displayed second and ends at zero', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new TimedRunner(ctx);
    const remaining: (number | null)[] = [];
    runner.subscribe((s) => remaining.push(s.remainingMs));
    runner.start();
    for (let k = 0; k < 120; k++) {
      clock.advance(0.1);
      runner.tick();
    }
    const seconds = remaining.filter((r): r is number => r !== null).map((r) => Math.ceil(r / 1000));
    // Every second from 10 down to 0 was shown, each once (plus the initial snapshots).
    expect([...new Set(seconds)]).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
    expect(remaining.length).toBeLessThanOrEqual(14);
    expect(runner.snapshot().phase).toBe('done');
  });
});
