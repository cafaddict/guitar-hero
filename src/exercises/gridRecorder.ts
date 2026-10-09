/**
 * Metronome-grid recording used by the Mode D exercises (E6, E8): starts the metronome with the calibrated
 * RTT (click masking), collects judged strum/pick onsets around the grid, and reports when the last bar has
 * ended and late judgements (~0.4 s after each onset) have settled.
 */
import type { MetronomeConfig } from '../audio/metronome';
import type { Job } from '../audio/worker/protocol';
import type { ExerciseContext, JudgedEvent } from './types';

/** Judged onsets arrive ~0.4 s after the strum; wait this long after the last bar before scoring. */
export const SETTLE_S = 0.7;

export class GridRecorder {
  readonly strums: number[] = [];
  /** The judged events behind `strums` (same order), e.g. Mode C classifications for a chord check. */
  readonly events: JudgedEvent[] = [];
  gridStart: number | null = null;
  endTime: number | null = null;
  private readonly disposers: (() => void)[] = [];

  constructor(
    private readonly ctx: ExerciseContext,
    private readonly config: MetronomeConfig,
    private readonly onBarsDone: () => void,
    private readonly onEvent: (event: JudgedEvent) => void = () => {},
    /** Worker job for the strums: plain onsets, or a closed-set classification that also yields onsets. */
    private job: Job = { kind: 'onsets' },
  ) {}

  private disposed = false;

  /** Replaces the job mid-take (same kind, e.g. the song backing mask once its bleed gain is known). */
  updateJob(job: Job): void {
    if (job.kind !== this.job.kind) throw new Error('updateJob keeps the job kind');
    // A late async update (e.g. the bleed gain) must not re-arm the job after the take was left.
    if (this.disposed) return;
    this.job = job;
    this.ctx.audio?.setJob(job);
  }

  get rttS(): number {
    return (this.ctx.calibration?.rttMs ?? 0) / 1000;
  }

  start(onGrid: () => void): void {
    const mic = this.ctx.audio;
    if (mic) {
      mic.setJob(this.job);
      this.disposers.push(
        () => mic.setJob(null),
        mic.onJudged((e) => this.collect(e)),
      );
    }
    const metronome = this.ctx.output.metronome;
    this.disposers.push(
      metronome.onEnd((t) => {
        this.endTime = t;
        this.onBarsDone();
      }),
      () => metronome.stop(),
    );
    void metronome.start(this.config, { rttMs: this.ctx.calibration?.rttMs ?? 0 }).then(() => {
      if (this.disposed) return;
      this.gridStart = metronome.gridStartTime();
      onGrid();
    });
  }

  private collect(event: JudgedEvent): void {
    if (event.jobKind !== this.job.kind || this.gridStart === null) return;
    if (event.time < this.gridStart - 0.3) return;
    if (this.endTime !== null && event.time > this.endTime + 0.3) return;
    this.strums.push(event.time);
    this.events.push(event);
    this.onEvent(event);
  }

  /** True once the bars are over and late judgements had time to arrive. */
  settled(now: number): boolean {
    return this.endTime !== null && now >= this.endTime + SETTLE_S;
  }

  stop(): void {
    this.ctx.output.metronome.stop();
  }

  dispose(): void {
    this.disposed = true;
    for (const d of this.disposers.splice(0)) d();
  }
}
