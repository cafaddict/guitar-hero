/**
 * E0 tuning at the start of a session (SPEC §11.2, §9.2): strings 6 → 1 with the string-mode tuner; a string
 * is done once the last 5 readings are within ±3 cents of standard pitch ("맞음"). Next skips a string. Without
 * a microphone the user tunes with any tuner and confirms each string (Enter).
 */
import { z } from 'zod';
import type { TuningResult } from '../../domain/exerciseResults';
import { STRING_COUNT } from '../../domain/strings';
import { centsBetween, midiToHz, STANDARD_TUNING } from '../../domain/theory';
import { InTuneTracker } from '../../features/tuner/tunerModel';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e0ParamsSchema = z.object({});
export type E0Params = z.infer<typeof e0ParamsSchema>;

export interface E0View {
  idx: number;
  cents: number | null;
  inTune: boolean[];
  skipped: boolean[];
  finalCents: (number | null)[];
  manual: boolean;
}

const ADVANCE_MS = 700;

export class TuningRunner extends BaseRunner<TuningResult, E0View> {
  private idx = 0;
  private cents: number | null = null;
  private readonly inTune: boolean[] = Array(STRING_COUNT).fill(false);
  private readonly skipped: boolean[] = Array(STRING_COUNT).fill(false);
  private readonly finalCents: (number | null)[] = Array(STRING_COUNT).fill(null);
  private readonly tracker = new InTuneTracker();
  private advanceAt: number | null = null;
  private startedMs = 0;

  constructor(ctx: ExerciseContext) {
    super(ctx);
  }

  private expected(idx: number): number {
    return midiToHz(STANDARD_TUNING.openMidi[idx]!);
  }

  protected view(): E0View {
    return {
      idx: this.idx,
      cents: this.cents,
      inTune: [...this.inTune],
      skipped: [...this.skipped],
      finalCents: [...this.finalCents],
      manual: this.ctx.audio === null,
    };
  }

  start(): void {
    this.startedMs = this.ctx.clock.now();
    const mic = this.ctx.audio;
    if (mic) {
      this.own(mic.onTuner((r) => this.onReading(r.f0)));
      this.own(() => mic.setTuner(false, null));
      mic.setJob(null);
      mic.setTuner(true, this.expected(0));
    }
    this.setPhase('running');
  }

  private onReading(f0: number | null): void {
    if (this.phase !== 'running' || this.advanceAt !== null) return;
    this.cents = f0 === null ? this.cents : centsBetween(f0, this.expected(this.idx));
    const tuned = this.tracker.push(f0 === null ? null : this.cents);
    if (tuned) {
      this.inTune[this.idx] = true;
      this.finalCents[this.idx] = this.cents;
      this.advanceAt = this.ctx.clock.now() + ADVANCE_MS;
    }
    this.publish();
  }

  private advance(): void {
    this.advanceAt = null;
    this.tracker.reset();
    this.cents = null;
    this.idx++;
    if (this.idx >= STRING_COUNT) {
      this.ctx.audio?.setTuner(false, null);
      this.setPhase('done');
      return;
    }
    this.ctx.audio?.setTuner(true, this.expected(this.idx));
    this.publish();
  }

  command(cmd: RunnerCommand): void {
    if (this.phase !== 'running') return;
    if (cmd === 'abort') {
      this.setPhase('done');
      return;
    }
    if (cmd === 'next' || cmd === 'toggle') {
      if (this.ctx.audio === null) this.inTune[this.idx] = true;
      else if (!this.inTune[this.idx]) this.skipped[this.idx] = true;
      this.advance();
    }
  }

  override tick(): void {
    super.tick();
    if (this.advanceAt !== null && this.ctx.clock.now() >= this.advanceAt) this.advance();
  }

  /** Nothing to record until at least one string was tuned or skipped. */
  hasResult(): boolean {
    return this.idx > 0;
  }

  finish(): TuningResult {
    return {
      strings: this.inTune.map((ok, idx) => ({ idx, cents: this.finalCents[idx] ?? null, inTune: ok })),
      complete: this.inTune.every(Boolean),
      durationMs: this.ctx.clock.now() - this.startedMs,
    };
  }
}
