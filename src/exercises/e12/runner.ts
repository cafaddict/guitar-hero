/**
 * E12 pinky exercise (SPEC v1.1 §11.17, 01:345–347): string 6, fret 7 with finger 3 + fret 8 with finger 4, across
 * to string 1 and back (4 → 3), then the 2-4 and 1-4 combinations — a two-minute block. No speed score ("NOT a
 * speed drill"): the run records completion, a clarity self-report (1–3) and pain 0–10 like E7. The safety notes
 * stay on screen.
 */
import { z } from 'zod';
import type { PinkyResult } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const PINKY_BLOCK_MS = 120_000;

export const e12ParamsSchema = z.object({
  durationMs: z.number().int().min(30_000).max(300_000).default(PINKY_BLOCK_MS),
});
export type E12Params = z.infer<typeof e12ParamsSchema>;

export interface E12View {
  /** 'clarity' then 'pain' after the block. */
  question: 'clarity' | 'pain' | null;
  clarity: number | null;
  pain: number;
}

export class PinkyRunner extends BaseRunner<PinkyResult, E12View> {
  private clarity: number | null = null;
  private pain = 0;
  private painReported = false;
  private started = false;
  private completed = false;
  private question: E12View['question'] = null;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E12Params,
  ) {
    super(ctx);
  }

  protected view(): E12View {
    return { question: this.question, clarity: this.clarity, pain: this.pain };
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
      this.endBlock(false);
      return;
    }
    if (this.phase !== 'review') return;
    if (cmd === 'prev') {
      if (this.canStepBack()) this.back();
      return;
    }
    if (this.question === 'clarity') {
      const value = cmd === 'manual1' ? 1 : cmd === 'manual2' ? 2 : cmd === 'manual3' ? 3 : null;
      if (value === null) return;
      this.clarity = value;
      this.question = 'pain';
      this.publish();
      return;
    }
    if (cmd === 'inc' || cmd === 'dec') {
      this.pain = Math.min(10, Math.max(0, this.pain + (cmd === 'inc' ? 1 : -1)));
      this.publish();
    } else if (cmd === 'next' || cmd === 'toggle') {
      this.painReported = true;
      this.setPhase('done');
    }
  }

  private endBlock(completed: boolean): void {
    this.pauseTimer();
    this.completed = completed;
    this.question = 'clarity';
    this.setPhase('review');
  }

  protected override onTimeUp(): void {
    this.endBlock(true);
  }

  /** The pain question goes back to clarity; the clarity question, after an early end, back to the block (D-096). */
  canStepBack(): boolean {
    if (this.phase !== 'review') return false;
    return this.question === 'pain' || (!this.completed && (this.remainingMs() ?? 0) > 0);
  }

  private back(): void {
    if (this.question === 'pain') {
      this.question = 'clarity';
      this.publish();
      return;
    }
    this.question = null;
    this.clarity = null;
    this.resumeTimer();
    this.setPhase('running');
  }

  hasResult(): boolean {
    return this.started;
  }

  finish(): PinkyResult {
    return {
      completed: this.completed,
      clarity: this.clarity,
      pain: this.painReported ? this.pain : null,
      durationMs: Math.round(Math.min(this.elapsedMs(), this.params.durationMs)),
    };
  }
}
