/**
 * E9 chromatic 1-2-3-4 (SPEC v1.1 §11.14): fingers 1-2-3-4 one fret each from the start fret, string 6 → 1 and
 * back (4-3-2-1 on the way down), eighth notes with alternate picking. Each four-note group is a cycle.
 * Ladder ("10회 무실수 후 가속", 01:154·333): 10 flawless groups in a row → +5 BPM; otherwise it stays — a failed
 * run never lowers the tempo, the learner picks it (D-098). Goal 100 BPM (design value).
 */
import { z } from 'zod';
import { chromaticGroups, positionMidi } from '../../content/scales';
import {
  CHROMATIC_START_FRET,
  CHROMATIC_STREAK,
  type ChromaticResult,
  countsForCriteria,
  longestFlawlessRun,
  type SequenceCycle,
  sequenceRates,
} from '../../domain/exerciseResults';
import { pooledIoiCv } from '../../dsp/timing';
import { type PlannedNote, SequenceRunner, type SequenceView } from '../sequence/runner';
import type { ExerciseContext } from '../types';

export const e9ParamsSchema = z.object({
  startFret: z.number().int().min(1).max(12).default(CHROMATIC_START_FRET),
  bpm: z.number().int().min(30).max(240).default(60),
  tabHidden: z.boolean().default(false),
  /** Unused since D-098 (runs never step down); kept so stored params still parse. */
  previousLow: z.boolean().default(false),
  ladderBase: z.number().int().optional(),
});
export type E9Params = z.infer<typeof e9ParamsSchema>;

export interface E9View extends SequenceView {
  startFret: number;
}

export function flawlessShare(cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain'>[]): number {
  const judged = cycles.filter((c) => !c.uncertain);
  return judged.length ? judged.filter((c) => c.flawless).length / judged.length : 0;
}

/**
 * E9 ladder, up or stay (D-098): the flawless run restarts at a cycle after a pause (longestFlawlessRun, D-085).
 */
export function chromaticLadder(
  cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain' | 'resumed'>[],
): 'up' | 'stay' {
  return longestFlawlessRun(cycles) >= CHROMATIC_STREAK ? 'up' : 'stay';
}

export class ChromaticRunner extends SequenceRunner<ChromaticResult, E9View> {
  private readonly groups: { string: number; fret: number }[][];

  constructor(
    ctx: ExerciseContext,
    private readonly params: E9Params,
  ) {
    super(ctx, params.bpm, params.tabHidden, 2);
    this.groups = chromaticGroups(params.startFret);
  }

  protected planCycle(k: number): PlannedNote[] {
    // One finger per fret from the start fret: 1-2-3-4 up, 4-3-2-1 back.
    return this.groups[k % this.groups.length]!.map((p) => ({
      ...p,
      finger: p.fret - this.params.startFret + 1,
      midi: positionMidi(p),
    }));
  }

  protected override tempoPickable(): boolean {
    return true;
  }

  protected view(): E9View {
    return { ...this.baseView(), startFret: this.params.startFret };
  }

  /** TAB and tempo as recorded for this run (H, ↑/↓ before the start, D-098). */
  effectiveParams(): E9Params {
    return { ...this.params, bpm: this.bpm, tabHidden: this.tabHidden };
  }

  finish(): ChromaticResult {
    const rates = sequenceRates(this.cycleRecords);
    const pauses = this.pauses > 0 ? { pauses: this.pauses } : {};
    return {
      startFret: this.params.startFret,
      bpm: this.bpm,
      cycles: [...this.cycleRecords],
      // A paused run is recorded but keeps the ladder where it is (D-085).
      ladder: countsForCriteria(pauses) ? chromaticLadder(this.cycleRecords) : 'stay',
      source: this.source,
      hitRate: rates.hitRate,
      okRatio: rates.okRatio,
      // Intervals inside each stretch played, not across a pause (D-085).
      ioiCv: this.onsetTimes.length >= 3 ? pooledIoiCv(this.onsetGroups()) : null,
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
      ...pauses,
    };
  }
}
