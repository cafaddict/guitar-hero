/**
 * E17 single-note riff (SPEC v1.1 §11.19): the riff's TAB with the metronome; one pass through the riff is a
 * cycle. Ladder: 4 flawless cycles in a row → +5 BPM (goal = the riff's tempo + 20); otherwise it stays — a failed
 * run never lowers the tempo, the learner picks it (D-098). With a microphone each pass is judged by §10.10
 * (SequenceRunner); without one it is self-reported: 1 = flawless, 2 = a mistake.
 */
import { z } from 'zod';
import { type Riff, riffById, riffNotes } from '../../content/riffs';
import { positionMidi } from '../../content/scales';
import { countsForCriteria, type RiffResult, type SequenceCycle } from '../../domain/exerciseResults';
import { type PlannedNote, SequenceRunner, type SequenceView } from '../sequence/runner';
import type { ExerciseContext, RunnerCommand } from '../types';
import { renderRiffDemo } from './listen';

export const e17ParamsSchema = z.object({
  riffId: z.string().min(1),
  bpm: z.number().int().min(30).max(240),
  tabHidden: z.boolean().default(false),
  /** Unused since D-098 (runs never step down); kept so stored params still parse. */
  previousLow: z.boolean().default(false),
  /**
   * The ladder's tempo when a "−10 BPM" prescription started (SPEC v1.1 §7.4): a slowed run never lowers the
   * stored ladder below it ("사다리 상태는 보존").
   */
  ladderBase: z.number().int().optional(),
});
export type E17Params = z.infer<typeof e17ParamsSchema>;

export const FLAWLESS_STREAK_UP = 4;

export interface E17View extends SequenceView {
  riff: Riff;
  /** The "들어 보기" demo is playing (ready phase only; starting the run stops it). */
  listening: boolean;
}

/**
 * Ladder decision of a run of cycles (shared by sequence exercises: E10, E17), up or stay: a failed run never
 * lowers the tempo (D-098); a pause restarts the streak.
 */
export function sequenceLadder(
  cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain' | 'resumed'>[],
  streakForUp = FLAWLESS_STREAK_UP,
): 'up' | 'stay' {
  let streak = 0;
  for (const c of cycles) {
    if (c.resumed) streak = 0;
    if (c.flawless) streak += 1;
    else if (!c.uncertain) streak = 0;
    if (streak >= streakForUp) return 'up';
  }
  return 'stay';
}

export function mistakeRatio(cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain'>[]): number {
  const judged = cycles.filter((c) => !c.uncertain);
  return judged.length === 0 ? 0 : judged.filter((c) => !c.flawless).length / judged.length;
}

export class RiffRunner extends SequenceRunner<RiffResult, E17View> {
  private readonly riff: Riff;
  /** Stops the demo; null when none is playing. */
  private stopDemo: (() => void) | null = null;
  private demoEndsAt = 0;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E17Params,
  ) {
    const riff = riffById(params.riffId);
    super(ctx, params.bpm, params.tabHidden, riff.value === 'e' ? 2 : 1);
    this.riff = riff;
  }

  protected planCycle(): PlannedNote[] {
    return riffNotes(this.riff).map((n) => ({ ...n, midi: positionMidi(n) }));
  }

  /** ↑/↓ before the start pick the tempo (D-098); like any command it stops the demo first. */
  protected override tempoPickable(): boolean {
    return true;
  }

  protected view(): E17View {
    return { ...this.baseView(), riff: this.riff, listening: this.stopDemo !== null };
  }

  /**
   * M = "들어 보기" before the run (D-080). Starting the run, finishing or leaving stops the demo first, so the
   * microphone never judges the synthesizer.
   */
  override command(cmd: RunnerCommand): void {
    if (cmd === 'mark' && this.phase === 'ready') {
      this.listen();
      return;
    }
    this.endDemo();
    super.command(cmd);
  }

  override tick(): void {
    if (this.stopDemo && this.ctx.output.now() >= this.demoEndsAt) this.endDemo();
    super.tick();
  }

  override dispose(): void {
    this.endDemo();
    super.dispose();
  }

  private listen(): void {
    this.endDemo();
    const rate = this.ctx.output.sampleRate();
    const demo = renderRiffDemo(this.riff, this.bpm, rate);
    try {
      this.stopDemo = this.ctx.output.playSamples(demo);
    } catch {
      // Synth playback is refused while the microphone judges; there is nothing to stop then.
      return;
    }
    this.demoEndsAt = this.ctx.output.now() + demo.length / rate;
    this.publish();
  }

  private endDemo(): void {
    if (!this.stopDemo) return;
    this.stopDemo();
    this.stopDemo = null;
    this.publish();
  }

  /** TAB shown or hidden as it is now and the tempo picked (H key, ↑/↓, SPEC v1.1 §12.3, D-098). */
  effectiveParams(): E17Params {
    return { ...this.params, bpm: this.bpm, tabHidden: this.tabHidden };
  }

  notes() {
    return riffNotes(this.riff);
  }

  finish(): RiffResult {
    const pauses = this.pauses > 0 ? { pauses: this.pauses } : {};
    return {
      riffId: this.riff.id,
      bpm: this.bpm,
      tabHidden: this.tabHidden,
      cycles: [...this.cycleRecords],
      // A paused run is recorded but keeps the ladder where it is (D-085).
      ladder: countsForCriteria(pauses) ? sequenceLadder(this.cycleRecords) : 'stay',
      source: this.source,
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
      ...pauses,
    };
  }
}
