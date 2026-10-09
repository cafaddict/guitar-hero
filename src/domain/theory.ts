/**
 * Pitch math and tunings (SPEC §6.1). Pure.
 */
export interface Tuning {
  id: string;
  name: string;
  /** MIDI note of each open string, idx 0 (6th string) → 5 (1st string). */
  openMidi: readonly number[];
}

export const STANDARD_TUNING: Tuning = {
  id: 'standard',
  name: 'E A D G B E',
  openMidi: [40, 45, 50, 55, 59, 64],
};

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

/** Signed distance in cents from `reference` to `hz`. */
export function centsBetween(hz: number, reference: number): number {
  return 1200 * Math.log2(hz / reference);
}

export function applyCents(hz: number, cents: number): number {
  return hz * 2 ** (cents / 1200);
}

export function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function pitchClassName(midi: number): string {
  return PITCH_CLASS_NAMES[pitchClass(midi)]!;
}

const NATURAL_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pitch class of a chord symbol's root ('F#m' → 6, 'Bb7' → 10), or null. */
export function symbolRootPitchClass(symbol: string): number | null {
  const m = /^([A-G])([#b]?)/.exec(symbol);
  if (!m) return null;
  return (NATURAL_PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? 11 : 0)) % 12;
}

/** Scientific pitch name, e.g. 40 → "E2". */
export function midiName(midi: number): string {
  const rounded = Math.round(midi);
  return `${pitchClassName(rounded)}${Math.floor(rounded / 12) - 1}`;
}

/** Parses "E2", "C#4", "Bb3" into MIDI. */
export function nameToMidi(name: string): number {
  const match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
  if (!match) throw new Error(`bad note name ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]!.toUpperCase() as 'C'];
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (Number(match[3]) + 1) * 12 + base + accidental;
}

/**
 * Frequency of partial h of a stiff string: f_h = h · f0 · sqrt(1 + B·h²) (SPEC §6.3, §14.2).
 */
export function partialHz(f0: number, h: number, inharmonicityB: number): number {
  return h * f0 * Math.sqrt(1 + inharmonicityB * h * h);
}
