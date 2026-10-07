/**
 * E4 anchor / air change drill (SPEC §11.5). `anchors(a, b)` decides the kind: with anchor fingers the user
 * keeps them down and moves only the others, slowly and without strumming; without anchors the shape is
 * formed above the strings and lands at once. A 1–2 minute timer, then a self-report "landed together n/10".
 */
import { z } from 'zod';
import { voicingForClass } from '../../content/voicings';
import type { AnchorDrillResult } from '../../domain/exerciseResults';
import { pairId } from '../../domain/pairs';
import { type AnchorAnalysis, anchors, type ChordVoicing } from '../../domain/voicing';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e4ParamsSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  durationMs: z.number().int().min(60_000).max(120_000),
});
export type E4Params = z.infer<typeof e4ParamsSchema>;

export interface E4View {
  kind: 'anchor' | 'air';
  from: ChordVoicing;
  to: ChordVoicing;
  analysis: AnchorAnalysis;
  /** Self-report 0..10 (review phase). */
  success: number;
}

export class AnchorDrillRunner extends BaseRunner<AnchorDrillResult, E4View> {
  private readonly from: ChordVoicing;
  private readonly to: ChordVoicing;
  private readonly analysis: AnchorAnalysis;
  private success = 5;
  private reported = false;
  private started = false;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E4Params,
    voicingOf: (id: string) => ChordVoicing,
  ) {
    super(ctx);
    this.from = voicingOf(voicingForClass(params.from, ctx.content.gVoicing));
    this.to = voicingOf(voicingForClass(params.to, ctx.content.gVoicing));
    this.analysis = anchors(this.from, this.to);
  }

  get kind(): 'anchor' | 'air' {
    return this.analysis.anchors.length > 0 ? 'anchor' : 'air';
  }

  protected view(): E4View {
    return { kind: this.kind, from: this.from, to: this.to, analysis: this.analysis, success: this.success };
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
      this.success = Math.min(10, Math.max(0, this.success + (cmd === 'inc' ? 1 : -1)));
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

  finish(): AnchorDrillResult {
    return {
      pair: pairId(this.params.from, this.params.to),
      kind: this.kind,
      durationMs: Math.round(Math.min(this.elapsedMs(), this.params.durationMs)),
      selfReportSuccess: this.reported ? this.success : null,
    };
  }
}
