/**
 * Tuner display rules (SPEC §9.2): the target is either the selected string or the nearest note; "맞음"
 * (in tune) = the last 5 readings all within ±3 cents of the target.
 */
import { centsBetween, midiName, midiToHz, STANDARD_TUNING } from '../../domain/theory';

export const IN_TUNE_FRAMES = 5;
export const IN_TUNE_CENTS = 3;

export type TunerTarget = { kind: 'auto' } | { kind: 'string'; idx: number };

export interface TunerDisplay {
  note: string;
  cents: number;
  targetHz: number;
}

export function expectedF0For(target: TunerTarget, deltaCents: readonly number[] = []): number | null {
  if (target.kind === 'auto') return null;
  const midi = STANDARD_TUNING.openMidi[target.idx]!;
  return midiToHz(midi) * 2 ** ((deltaCents[target.idx] ?? 0) / 1200);
}

export function displayFor(target: TunerTarget, f0: number): TunerDisplay {
  if (target.kind === 'string') {
    const midi = STANDARD_TUNING.openMidi[target.idx]!;
    const targetHz = midiToHz(midi);
    return { note: midiName(midi), cents: centsBetween(f0, targetHz), targetHz };
  }
  const midi = Math.round(69 + 12 * Math.log2(f0 / 440));
  const targetHz = midiToHz(midi);
  return { note: midiName(midi), cents: centsBetween(f0, targetHz), targetHz };
}

/** Rolling window of cents readings; a missing reading breaks the run. */
export class InTuneTracker {
  private recent: number[] = [];

  push(cents: number | null): boolean {
    if (cents === null) {
      this.recent = [];
      return false;
    }
    this.recent.push(cents);
    if (this.recent.length > IN_TUNE_FRAMES) this.recent.shift();
    return this.recent.length === IN_TUNE_FRAMES && this.recent.every((c) => Math.abs(c) <= IN_TUNE_CENTS);
  }

  reset(): void {
    this.recent = [];
  }
}
