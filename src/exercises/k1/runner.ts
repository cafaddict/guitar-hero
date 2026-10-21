/**
 * K1 self-check cards (SPEC v1.1 §11.12): one card per basic the microphone cannot judge (posture, pick grip,
 * counting aloud, foot tapping, deliberate mute, palm mute). Each card is answered "됐어요" (1) or "아직" (2);
 * nothing is scored. Answered cards are recorded even when the run stops early.
 */
import { z } from 'zod';
import type { SelfCheckResult } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const k1ParamsSchema = z.object({ items: z.array(z.string().min(1)).min(1) });
export type K1Params = z.infer<typeof k1ParamsSchema>;

export interface K1View {
  index: number;
  total: number;
  itemId: string | null;
  answers: readonly { id: string; status: 'done' | 'notYet' }[];
}

export class SelfCheckRunner extends BaseRunner<SelfCheckResult, K1View> {
  private index = 0;
  private readonly answers: { id: string; status: 'done' | 'notYet' }[] = [];

  constructor(
    ctx: ExerciseContext,
    private readonly params: K1Params,
  ) {
    super(ctx);
  }

  protected view(): K1View {
    return {
      index: this.index,
      total: this.params.items.length,
      itemId: this.params.items[this.index] ?? null,
      answers: [...this.answers],
    };
  }

  start(): void {
    this.setPhase('running');
  }

  command(cmd: RunnerCommand): void {
    if (this.phase === 'done') return;
    if (cmd === 'abort') {
      this.setPhase('done');
      return;
    }
    if (cmd === 'manual1' || cmd === 'manual2') this.answer(cmd === 'manual1' ? 'done' : 'notYet');
    else if (cmd === 'prev' && this.index > 0) {
      this.index -= 1;
      this.answers.pop();
      this.publish();
    }
  }

  canStepBack(): boolean {
    return this.phase === 'running' && this.index > 0;
  }

  private answer(status: 'done' | 'notYet'): void {
    const id = this.params.items[this.index];
    if (id === undefined) return;
    this.answers.push({ id, status });
    this.index += 1;
    if (this.index >= this.params.items.length) this.setPhase('done');
    else this.publish();
  }

  hasResult(): boolean {
    return this.answers.length > 0;
  }

  finish(): SelfCheckResult {
    return { items: [...this.answers] };
  }
}
