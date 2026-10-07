/**
 * Elapsed-time timer (SPEC §8.5). Elapsed time is always a clock difference; timer ticks only refresh the
 * screen, so late or throttled ticks (background tabs) can delay the *display* by one tick at most and never
 * accumulate error. `rate` > 1 runs faster (E2E builds only; production always passes 1).
 */

export interface MsClock {
  /** Milliseconds, monotonic (performance.now()). */
  now(): number;
}

export const performanceClock: MsClock = { now: () => performance.now() };

export class ElapsedTimer {
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private pausedTotal = 0;

  constructor(
    private readonly clock: MsClock,
    readonly durationMs: number | null,
    private readonly rate = 1,
  ) {}

  get started(): boolean {
    return this.startedAt !== null;
  }

  get paused(): boolean {
    return this.pausedAt !== null;
  }

  start(): void {
    this.startedAt = this.clock.now();
    this.pausedAt = null;
    this.pausedTotal = 0;
  }

  pause(): void {
    if (this.startedAt !== null && this.pausedAt === null) this.pausedAt = this.clock.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedTotal += this.clock.now() - this.pausedAt;
    this.pausedAt = null;
  }

  /** Simulated (rate-scaled) elapsed milliseconds. */
  elapsedMs(): number {
    if (this.startedAt === null) return 0;
    const reference = this.pausedAt ?? this.clock.now();
    return Math.max(0, (reference - this.startedAt - this.pausedTotal) * this.rate);
  }

  remainingMs(): number | null {
    return this.durationMs === null ? null : Math.max(0, this.durationMs - this.elapsedMs());
  }

  isDone(): boolean {
    return this.durationMs !== null && this.elapsedMs() >= this.durationMs;
  }

  /** Real-clock time (ms) at which the timer ends if it keeps running; lets callers arm a precise timeout. */
  endsAt(): number | null {
    if (this.durationMs === null || this.startedAt === null || this.pausedAt !== null) return null;
    return this.startedAt + this.pausedTotal + this.durationMs / this.rate;
  }
}

/** mm:ss for the countdown display. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
