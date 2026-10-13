/**
 * E9 chromatic 1-2-3-4 (SPEC v1.1 §11.14): fingers 1-2-3-4 one fret each from the start fret, string 6 → 1 and
 * back (4-3-2-1 on the way down), eighth notes with alternate picking. Each four-note group is a cycle.
 * Ladder ("10회 무실수 후 가속", 01:154·333): 10 flawless groups in a row → +5 BPM; a run with fewer than half
 * of its groups flawless, twice in a row → −5 (minimum 50). Goal 100 BPM (design value).
 */
import { z } from 'zod';
import { chromaticGroups, positionMidi } from '../../content/scales';
import {
  CHROMATIC_START_FRET,
  CHROMATIC_STREAK,
  type ChromaticResult,
  longestFlawlessRun,
  type SequenceCycle,
  sequenceRates,
} from '../../domain/exerciseResults';
import { ioiCv } from '../../dsp/timing';
import { type PlannedNote, SequenceRunner, type SequenceView } from '../sequence/runner';
import type { ExerciseContext } from '../types';

export const e9ParamsSchema = z.object({
  startFret: z.number().int().min(1).max(12).default(CHROMATIC_START_FRET),
  bpm: z.number().int().min(30).max(240).default(60),
  tabHidden: z.boolean().default(false),
  /** The previous run had fewer than half of its groups flawless (two in a row → −5). */
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

export function chromaticLadder(
  cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain'>[],
  previousLow: boolean,
): 'up' | 'down' | 'stay' {
  if (longestFlawlessRun(cycles) >= CHROMATIC_STREAK) return 'up';
  if (cycles.length > 0 && flawlessShare(cycles) < 0.5 && previousLow) return 'down';
  return 'stay';
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

  protected view(): E9View {
    return { ...this.baseView(), startFret: this.params.startFret };
  }

  effectiveParams(): E9Params {
    return { ...this.params, tabHidden: this.tabHidden };
  }

  finish(): ChromaticResult {
    const rates = sequenceRates(this.cycleRecords);
    const onsets = [...this.onsetTimes].sort((a, b) => a - b);
    return {
      startFret: this.params.startFret,
      bpm: this.params.bpm,
      cycles: [...this.cycleRecords],
      ladder: chromaticLadder(this.cycleRecords, this.params.previousLow),
      source: this.source,
      hitRate: rates.hitRate,
      okRatio: rates.okRatio,
      ioiCv: onsets.length >= 3 ? ioiCv(onsets) : null,
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
    };
  }
}
