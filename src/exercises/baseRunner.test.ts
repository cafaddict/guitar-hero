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
  handled: boolean | null = null;
  command(cmd: RunnerCommand): void {
    this.handled = this.handlePause(cmd);
  }
  finish(): number {
    return 0;
  }
  hasResult(): boolean {
    return true;
  }
}

/** A take that pauses like a metronome run: counted unless still in its count-in, refused when `canPause` is off. */
class PausableRunner extends BaseRunner<number, null> {
  canPause = true;
  readonly takes: string[] = [];
  protected view(): null {
    return null;
  }
  start(): void {
    this.startTimer(null);
    this.setPhase('countIn');
  }
  play(): void {
    this.setPhase('running');
  }
  command(cmd: RunnerCommand): void {
    if (this.handlePause(cmd)) return;
    this.takes.push(`other:${cmd}`);
  }
  protected override pauseTake(): { counted: boolean } | null {
    if (!this.canPause) return null;
    this.takes.push('pause');
    return { counted: this.phase === 'running' };
  }
  protected override resumeTake(): void {
    this.takes.push('resume');
  }
  get counted(): number {
    return this.pauses;
  }
  get elapsed(): number {
    return this.elapsedMs();
  }
  reset(): void {
    this.resetPauses();
  }
  finish(): number {
    return this.pauses;
  }
  hasResult(): boolean {
    return true;
  }
}

describe('BaseRunner', () => {
  it('pause plumbing (D-085): counted pauses, the timer stops meanwhile, Space or P resumes into a count-in', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new PausableRunner(ctx);
    const phases: string[] = [];
    runner.subscribe((s) => phases.push(s.phase));
    runner.start();
    // A pause in the count-in is not counted.
    runner.command('pause');
    expect(runner.snapshot().phase).toBe('paused');
    expect(runner.counted).toBe(0);
    runner.command('toggle');
    expect(runner.snapshot().phase).toBe('countIn');
    runner.play();
    clock.advance(2);
    runner.command('pause');
    expect(runner.counted).toBe(1);
    clock.advance(30);
    runner.command('next'); // not a pause command: left to the runner
    expect(runner.snapshot().phase).toBe('paused');
    runner.command('pause');
    expect(runner.snapshot().phase).toBe('countIn');
    expect(runner.elapsed).toBe(2000);
    expect(runner.takes).toEqual(['pause', 'resume', 'pause', 'other:next', 'resume']);
    expect(phases.slice(1)).toEqual(['countIn', 'paused', 'countIn', 'running', 'paused', 'countIn']);
    // Refused by the take (e.g. its end is due): stays as it was, the command is still consumed.
    runner.play();
    runner.canPause = false;
    runner.command('pause');
    expect(runner.snapshot().phase).toBe('running');
    expect(runner.takes.at(-1)).toBe('resume');
    // Space while running is the runner's own.
    runner.command('toggle');
    expect(runner.takes.at(-1)).toBe('other:toggle');
    runner.reset();
    expect(runner.counted).toBe(0);
  });

  it('a runner without pauseTake/resumeTake ignores pause commands', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new TimedRunner(ctx);
    runner.start();
    runner.command('pause');
    expect(runner.handled).toBe(false);
    expect(runner.snapshot().phase).toBe('running');
  });

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
