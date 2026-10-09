/**
 * Shared runner plumbing: snapshot publication, a simulated-clock timer (clock differences only, SPEC §8.5),
 * owned subscriptions and DSP statistics. Concrete runners keep their own state machine and call `publish()`
 * after every change.
 */
import type {
  DspStats,
  ExerciseContext,
  ExerciseRunner,
  JudgedEvent,
  RunnerCommand,
  RunnerPhase,
  RunnerSnapshot,
} from './types';

export abstract class BaseRunner<R, V> implements ExerciseRunner<R, V> {
  protected phase: RunnerPhase = 'ready';
  private readonly listeners = new Set<(s: RunnerSnapshot<V>) => void>();
  private readonly disposers: (() => void)[] = [];
  private processingTotal = 0;
  private processingEvents = 0;
  private version: string | null = null;
  private timerStart: number | null = null;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private durationMs: number | null = null;
  private disposed = false;
  private shownSecond: number | null = null;

  constructor(protected readonly ctx: ExerciseContext) {}

  protected abstract view(): V;
  abstract start(): void;
  abstract command(cmd: RunnerCommand): void;
  abstract finish(): R;
  abstract hasResult(): boolean;

  snapshot(): RunnerSnapshot<V> {
    return { phase: this.phase, remainingMs: this.remainingMs(), view: this.view() };
  }

  subscribe(listener: (s: RunnerSnapshot<V>) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  protected publish(): void {
    if (this.disposed) return;
    const s = this.snapshot();
    for (const l of this.listeners) l(s);
  }

  protected setPhase(phase: RunnerPhase): void {
    this.phase = phase;
    this.publish();
  }

  /** Registers cleanup (event subscriptions, jobs) released by dispose(). */
  protected own(dispose: () => void): void {
    // Registered by a late async callback after dispose(): released at once instead of leaking.
    if (this.disposed) dispose();
    else this.disposers.push(dispose);
  }

  protected get isDisposed(): boolean {
    return this.disposed;
  }

  protected recordDsp(event: Pick<JudgedEvent, 'detectorVersion' | 'processingMs'>): void {
    this.version = event.detectorVersion;
    this.processingTotal += event.processingMs;
    this.processingEvents++;
  }

  dspStats(): DspStats {
    return {
      detectorVersion: this.version,
      meanProcessingMs: this.processingEvents ? this.processingTotal / this.processingEvents : 0,
      events: this.processingEvents,
    };
  }

  // --- timer (simulated ms from ctx.clock) ----------------------------------------------------

  protected startTimer(durationMs: number | null): void {
    this.durationMs = durationMs;
    this.timerStart = this.ctx.clock.now();
    this.pausedAt = null;
    this.pausedTotal = 0;
  }

  protected pauseTimer(): void {
    if (this.timerStart !== null && this.pausedAt === null) this.pausedAt = this.ctx.clock.now();
  }

  protected resumeTimer(): void {
    if (this.pausedAt === null) return;
    this.pausedTotal += this.ctx.clock.now() - this.pausedAt;
    this.pausedAt = null;
  }

  protected get timerRunning(): boolean {
    return this.timerStart !== null && this.pausedAt === null;
  }

  /** Simulated ms since startTimer() minus pauses. */
  protected elapsedMs(): number {
    if (this.timerStart === null) return 0;
    return Math.max(0, (this.pausedAt ?? this.ctx.clock.now()) - this.timerStart - this.pausedTotal);
  }

  protected remainingMs(): number | null {
    if (this.durationMs === null) return null;
    if (this.timerStart === null) return this.durationMs;
    return Math.max(0, this.durationMs - this.elapsedMs());
  }

  /**
   * Default tick: publishes whenever the displayed whole second of a running timer changes (views derive the
   * countdown from snapshots, so a silent timer would look frozen) and calls onTimeUp() once at zero.
   */
  tick(): void {
    if (this.phase !== 'running' || !this.timerRunning) return;
    const remaining = this.remainingMs();
    if (remaining === 0) {
      this.onTimeUp();
      return;
    }
    const second = remaining === null ? null : Math.ceil(remaining / 1000);
    if (second !== this.shownSecond) {
      this.shownSecond = second;
      this.publish();
    }
  }

  /** Timed part over; default goes straight to done. */
  protected onTimeUp(): void {
    this.setPhase('done');
  }

  dispose(): void {
    for (const d of this.disposers.splice(0)) d();
    this.listeners.clear();
    this.disposed = true;
  }
}
