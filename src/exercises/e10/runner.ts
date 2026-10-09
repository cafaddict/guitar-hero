/**
 * E10 scale ladder (SPEC v1.1 §11.13): one cycle of a step (§6.8) per pass, one note per click. Four flawless
 * cycles in a row → +5 BPM; four in a row at ≥ 80 BPM graduate the step (the next step opens at 60); a run with
 * mistakes in half or more of its cycles, twice in a row → −5 BPM (minimum 50). Memorization = step 1 with the
 * TAB hidden throughout, four flawless cycles in a row at ≥ 60 BPM.
 */
import { z } from 'zod';
import {
  positionMidi,
  type ScaleShape,
  type ScaleStep,
  scaleById,
  scaleStepSequence,
} from '../../content/scales';
import {
  longestFlawlessRun,
  SCALE_GRADUATION_BPM,
  SCALE_MEMORIZE_MIN_BPM,
  SCALE_START_BPM,
  type ScaleResult,
  SEQUENCE_STREAK,
} from '../../domain/exerciseResults';
import type { RenderedBacking } from '../../dsp/synth/backing';
import { sequenceLadder } from '../e17/runner';
import { type PlannedNote, SequenceRunner, type SequenceView } from '../sequence/runner';
import type { BackingRenderer } from '../song/runner';
import type { ExerciseContext } from '../types';

export const e10ParamsSchema = z.object({
  scaleId: z.enum(['em-pent-open', 'c-major-open', 'am-pent-pos1']),
  step: z.number().int().min(1).max(5).default(1),
  bpm: z.number().int().min(30).max(240).default(SCALE_START_BPM),
  tabHidden: z.boolean().default(false),
  /** "반주와 함께 1단계" (§11.13 step 6): same scoring as step 1. */
  withBacking: z.boolean().default(false),
  /** Earphone confirmation of the backing run (§8.6-1); on speakers the run is reference only. */
  earphones: z.boolean().default(false),
  /** Previous run of this step had mistakes in half or more of its cycles (two in a row → −5). */
  previousLow: z.boolean().default(false),
  ladderBase: z.number().int().optional(),
  /** Seed of the random steps (2 and 3); each cycle derives its own. */
  seed: z.number().int().default(0),
  /** A review run of a graduated step (§7.5). */
  review: z.boolean().optional(),
});
export type E10Params = z.infer<typeof e10ParamsSchema>;

export interface E10View extends SequenceView {
  scale: ScaleShape;
  step: number;
  withBacking: boolean;
  earphones: boolean;
  backingAudible: boolean;
}

/** Backing chord of "반주와 함께 1단계": the scale's tonic chord (§11.13 step 6). */
export const SCALE_BACKING_CHORD: Record<E10Params['scaleId'], string> = {
  'em-pent-open': 'Em',
  'c-major-open': 'C',
  'am-pent-pos1': 'Am',
};

export class ScaleRunner extends SequenceRunner<ScaleResult, E10View> {
  private readonly scale: ScaleShape;
  private stopBacking: (() => void) | null = null;
  private backing: RenderedBacking | null = null;
  private earphones: boolean;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E10Params,
    /** The song play-along renderer (chords per bar, pattern, bpm), reused for step 6. */
    private readonly renderBacking: BackingRenderer | null = null,
  ) {
    super(ctx, params.bpm, params.tabHidden, 1);
    this.scale = scaleById(params.scaleId);
    this.earphones = params.earphones;
  }

  /** Backing on speakers while the microphone judges: the notes may be the backing's (§8.6-3). */
  private get backingAudible(): boolean {
    return this.params.withBacking && this.source === 'mic' && !this.earphones;
  }

  /** Step 6: the backing starts with the count-in bar and loops the tonic chord for a long while. */
  protected override onGrid(gridStart: number): void {
    if (!this.backing) return;
    const barS = (4 * 60) / this.params.bpm;
    this.stopBacking = this.ctx.output.playBacking(this.backing.signal, gridStart - barS);
    this.own(() => this.stopBacking?.());
  }

  override command(cmd: Parameters<SequenceRunner<ScaleResult, E10View>['command']>[0]): void {
    // E confirms earphones before the backing run starts (§8.6-1).
    if (cmd === 'ear' && this.phase === 'ready' && this.params.withBacking) {
      this.earphones = !this.earphones;
      this.publish();
      return;
    }
    // Rendered before the count-in is scheduled, so the backing cannot start late (≈ 0.3 s to render).
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next') && this.params.withBacking)
      this.backing ??=
        this.renderBacking?.(
          Array(1 + 32).fill(SCALE_BACKING_CHORD[this.params.scaleId]),
          'P0',
          this.params.bpm,
        ) ?? null;
    super.command(cmd);
    if (this.phase === 'review' || this.phase === 'done') this.stopBacking?.();
  }

  protected planCycle(k: number): PlannedNote[] {
    const order = scaleStepSequence(this.scale, this.params.step as ScaleStep, this.params.seed * 1009 + k);
    return order.map((i) => {
      const n = this.scale.notes[i]!;
      return { string: n.string, fret: n.fret, midi: positionMidi(n) };
    });
  }

  protected view(): E10View {
    return {
      ...this.baseView(),
      scale: this.scale,
      step: this.params.step,
      withBacking: this.params.withBacking,
      earphones: this.earphones,
      backingAudible: this.backingAudible,
    };
  }

  effectiveParams(): E10Params {
    return { ...this.params, tabHidden: this.tabHidden, earphones: this.earphones };
  }

  finish(): ScaleResult {
    // A reference run (backing on speakers) neither graduates nor proves memorization.
    const run = this.backingAudible ? 0 : longestFlawlessRun(this.cycleRecords);
    return {
      scaleId: this.scale.id,
      step: this.params.step,
      bpm: this.params.bpm,
      tabHidden: this.tabHidden,
      hiddenThroughout: this.hiddenThroughout,
      withBacking: this.params.withBacking,
      ...(this.params.withBacking ? { backingAudible: this.backingAudible } : {}),
      cycles: [...this.cycleRecords],
      ladder: this.backingAudible ? 'stay' : sequenceLadder(this.cycleRecords, this.params.previousLow),
      graduated: run >= SEQUENCE_STREAK && this.params.bpm >= SCALE_GRADUATION_BPM,
      memorized:
        this.params.step === 1 &&
        this.hiddenThroughout &&
        run >= SEQUENCE_STREAK &&
        this.params.bpm >= SCALE_MEMORIZE_MIN_BPM,
      source: this.source,
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
    };
  }
}
