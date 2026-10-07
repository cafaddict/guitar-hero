/**
 * E7 finger stretching (SPEC §11.8): the start fret (default 5) is shown with a 1–2 minute timer and a
 * permanent "stretch, not pain" notice; afterwards the user reports pain 0–10. Three sessions in a row with
 * pain ≤ 2 move the start fret one fret down (domain/safety.ts nextStretchStartFret, used by the routine).
 */
import { z } from 'zod';
import type { StretchResult } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e7ParamsSchema = z.object({
  startFret: z.number().int().min(1).max(12),
  durationMs: z.number().int().min(60_000).max(120_000),
});
export type E7Params = z.infer<typeof e7ParamsSchema>;

export interface E7View {
  startFret: number;
  pain: number;
}

export class StretchRunner extends BaseRunner<StretchResult, E7View> {
  private pain = 0;
  private reported = false;
  private started = false;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E7Params,
  ) {
    super(ctx);
  }

  protected view(): E7View {
    return { startFret: this.params.startFret, pain: this.pain };
  }

  start(): void {
    this.setPhase('ready');
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.pauseTimer();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next')) {
      this.startTimer(this.params.durationMs);
      this.started = true;
      this.setPhase('running');
      return;
    }
    if (this.phase === 'running' && cmd === 'next') {
      this.onTimeUp();
      return;
    }
    if (this.phase !== 'review') return;
    if (cmd === 'inc' || cmd === 'dec') {
      this.pain = Math.min(10, Math.max(0, this.pain + (cmd === 'inc' ? 1 : -1)));
      this.publish();
    } else if (cmd === 'next' || cmd === 'toggle') {
      this.reported = true;
      this.setPhase('done');
    }
  }

  protected override onTimeUp(): void {
    this.pauseTimer();
    this.setPhase('review');
  }

  /** Stopped before the timer ever started → nothing to record. */
  hasResult(): boolean {
    return this.started;
  }

  finish(): StretchResult {
    return {
      startFret: this.params.startFret,
      durationMs: Math.round(Math.min(this.elapsedMs(), this.params.durationMs)),
      pain: this.reported ? this.pain : null,
    };
  }
}
