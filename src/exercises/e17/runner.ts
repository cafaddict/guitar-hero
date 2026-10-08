/**
 * E17 single-note riff (SPEC v1.1 §11.19): the riff's TAB with the metronome; one pass through the riff is a
 * cycle. Ladder: 4 flawless cycles in a row → +5 BPM (goal = the riff's tempo + 20); a run with mistakes in half
 * or more of its cycles, twice in a row → −5 BPM (minimum 50). Microphone judging (§10.10) joins in M12; until
 * then — and without a microphone — each cycle is self-reported: 1 = flawless, 2 = a mistake.
 */
import { z } from 'zod';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import { type Riff, riffById, riffNotes } from '../../content/riffs';
import type { RiffResult, SequenceCycle } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e17ParamsSchema = z.object({
  riffId: z.string().min(1),
  bpm: z.number().int().min(30).max(240),
  tabHidden: z.boolean().default(false),
  /** The previous run of this riff had mistakes in half or more of its cycles (two in a row → −5). */
  previousLow: z.boolean().default(false),
  /**
   * The ladder's tempo when a "−10 BPM" prescription started (SPEC v1.1 §7.4): a slowed run never lowers the
   * stored ladder below it ("사다리 상태는 보존").
   */
  ladderBase: z.number().int().optional(),
});
export type E17Params = z.infer<typeof e17ParamsSchema>;

export const FLAWLESS_STREAK_UP = 4;
export const LOW_MISTAKE_RATIO = 0.5;
export const SEQUENCE_MIN_BPM = 50;

export interface E17View {
  riff: Riff;
  bpm: number;
  tabHidden: boolean;
  cycles: readonly SequenceCycle[];
  streak: number;
}

/** Ladder decision of a run of cycles (shared by sequence exercises: E9, E10, E17). */
export function sequenceLadder(
  cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain'>[],
  previousLow: boolean,
  streakForUp = FLAWLESS_STREAK_UP,
): 'up' | 'down' | 'stay' {
  let streak = 0;
  for (const c of cycles) {
    if (c.flawless) streak += 1;
    else if (!c.uncertain) streak = 0;
    if (streak >= streakForUp) return 'up';
  }
  const judged = cycles.filter((c) => !c.uncertain);
  const mistakes = judged.filter((c) => !c.flawless).length;
  if (judged.length > 0 && mistakes / judged.length >= LOW_MISTAKE_RATIO && previousLow) return 'down';
  return 'stay';
}

export function mistakeRatio(cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain'>[]): number {
  const judged = cycles.filter((c) => !c.uncertain);
  return judged.length === 0 ? 0 : judged.filter((c) => !c.flawless).length / judged.length;
}

export class RiffRunner extends BaseRunner<RiffResult, E17View> {
  private readonly riff: Riff;
  private readonly cycles: SequenceCycle[] = [];
  private tabHidden: boolean;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E17Params,
  ) {
    super(ctx);
    this.riff = riffById(params.riffId);
    this.tabHidden = params.tabHidden;
  }

  private streak(): number {
    let n = 0;
    for (let i = this.cycles.length - 1; i >= 0; i--) {
      const c = this.cycles[i]!;
      if (c.flawless) n += 1;
      else if (!c.uncertain) break;
    }
    return n;
  }

  protected view(): E17View {
    return {
      riff: this.riff,
      bpm: this.params.bpm,
      tabHidden: this.tabHidden,
      cycles: [...this.cycles],
      streak: this.streak(),
    };
  }

  start(): void {
    this.setPhase('ready');
  }

  command(cmd: RunnerCommand): void {
    if (this.phase === 'done') return;
    if (cmd === 'abort') {
      this.stop();
      return;
    }
    if (cmd === 'hide') {
      this.tabHidden = !this.tabHidden;
      this.publish();
      return;
    }
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next')) {
      void this.ctx.output.metronome.start({
        ...DEFAULT_METRONOME_CONFIG,
        bpm: this.params.bpm,
        visualOnly: this.ctx.settings.visualOnlyMetronome,
      });
      this.setPhase('running');
      return;
    }
    if (this.phase !== 'running') return;
    if (cmd === 'manual1' || cmd === 'manual2') {
      this.cycles.push({ flawless: cmd === 'manual1', uncertain: false, stops: 0, okRatio: null });
      this.publish();
    } else if (cmd === 'toggle' || (cmd === 'next' && this.cycles.length > 0)) this.stop();
  }

  private stop(): void {
    this.ctx.output.metronome.stop();
    this.setPhase('done');
  }

  hasResult(): boolean {
    return this.cycles.length > 0;
  }

  /** TAB shown or hidden as it is now (H key, SPEC v1.1 §12.3). */
  effectiveParams(): E17Params {
    return { ...this.params, tabHidden: this.tabHidden };
  }

  notes() {
    return riffNotes(this.riff);
  }

  finish(): RiffResult {
    return {
      riffId: this.riff.id,
      bpm: this.params.bpm,
      tabHidden: this.tabHidden,
      cycles: [...this.cycles],
      ladder: sequenceLadder(this.cycles, this.params.previousLow),
      source: 'self',
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
    };
  }

  override dispose(): void {
    this.ctx.output.metronome.stop();
    super.dispose();
  }
}
