/**
 * Scale shapes and the E10 step sequences (SPEC v1.1 §6.8). Notes run low → high; strings are numbered
 * 6 (low E) … 1 (high E) like the riffs (§6.9). The step sequences are deterministic per seed so a run, its
 * replay and the benchmark all see the same notes.
 */
import { mulberry32 } from '../domain/prng';
import { STANDARD_TUNING } from '../domain/theory';

export interface ScaleNote {
  /** Guitar string number, 6 = low E … 1 = high E. */
  string: number;
  fret: number;
  /** Fretting finger (0 = open string). */
  finger: number;
}

export interface ScaleShape {
  id: 'em-pent-open' | 'c-major-open' | 'am-pent-pos1';
  name: string;
  stage: number;
  /** Pitch classes of the scale (0 = C). */
  pitchClasses: readonly number[];
  notes: readonly ScaleNote[];
}

/** "6: 0, 3(3) · 5: 0, 2(2)" → notes in table order (low string first, frets ascending). */
function shape(spec: string): ScaleNote[] {
  return spec.split(' · ').flatMap((part) => {
    const [stringPart, fretsPart] = part.split(': ');
    return fretsPart!.split(', ').map((cell) => {
      const match = /^(\d+)(?:\((\d)\))?$/.exec(cell);
      if (!match) throw new Error(`bad scale cell ${cell}`);
      const fret = Number(match[1]);
      return { string: Number(stringPart), fret, finger: match[2] ? Number(match[2]) : 0 };
    });
  });
}

export const SCALES: readonly ScaleShape[] = [
  {
    id: 'em-pent-open',
    name: 'E 마이너 펜타토닉(개방)',
    stage: 8,
    pitchClasses: [4, 7, 9, 11, 2],
    notes: shape('6: 0, 3(3) · 5: 0, 2(2) · 4: 0, 2(2) · 3: 0, 2(2) · 2: 0, 3(3) · 1: 0, 3(3)'),
  },
  {
    id: 'c-major-open',
    name: 'C 메이저(개방, 1옥타브)',
    stage: 9,
    pitchClasses: [0, 2, 4, 5, 7, 9, 11],
    notes: shape('5: 3(3) · 4: 0, 2(2), 3(3) · 3: 0, 2(2) · 2: 0, 1(1)'),
  },
  {
    id: 'am-pent-pos1',
    name: 'A 마이너 펜타토닉 1포지션',
    stage: 10,
    pitchClasses: [9, 0, 2, 4, 7],
    notes: shape(
      '6: 5(1), 8(4) · 5: 5(1), 7(3) · 4: 5(1), 7(3) · 3: 5(1), 7(3) · 2: 5(1), 8(4) · 1: 5(1), 8(4)',
    ),
  },
];

export type ScaleId = ScaleShape['id'];

export function scaleById(id: string): ScaleShape {
  const scale = SCALES.find((s) => s.id === id);
  if (!scale) throw new Error(`unknown scale ${id}`);
  return scale;
}

/** MIDI note of a string/fret position in standard tuning. */
export function positionMidi(position: { string: number; fret: number }): number {
  return STANDARD_TUNING.openMidi[6 - position.string]! + position.fret;
}

/** E10 steps 1–5 (§6.8). */
export const SCALE_STEPS = [1, 2, 3, 4, 5] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];

/** Notes in step 3 ("무작위 음") per cycle. */
export const RANDOM_STEP_NOTES = 16;
/** Step 2 turns around after each note with this probability (always at either end). */
export const TURN_PROBABILITY = 1 / 4;

function upDown(n: number): number[] {
  const up = Array.from({ length: n }, (_, i) => i);
  return [...up, ...up.slice(0, -1).reverse()];
}

function turning(n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out = [0];
  let direction = 1;
  while (out.length < 2 * n - 1) {
    const last = out.at(-1)!;
    if (last + direction < 0 || last + direction >= n) direction = -direction;
    else if (out.length > 1 && rng() < TURN_PROBABILITY) direction = -direction;
    out.push(last + direction);
  }
  return out;
}

function randomNotes(n: number, seed: number): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  while (out.length < RANDOM_STEP_NOTES) {
    const next = Math.floor(rng() * n);
    if (next !== out.at(-1)) out.push(next);
  }
  return out;
}

/** Overlapping groups of `size` (stride 1) going up, then the mirror image coming down. */
function groupsUpAndDown(n: number, size: number, intervalOnly: boolean): number[] {
  const up: number[] = [];
  for (let i = 0; i + size - 1 < n; i++) {
    if (intervalOnly) up.push(i, i + size - 1);
    else for (let k = 0; k < size; k++) up.push(i + k);
  }
  const down = up.map((i) => n - 1 - i);
  return [...up, ...down];
}

/**
 * One cycle of an E10 step as indices into `scale.notes`: 1 up-and-down, 2 turning walk, 3 random notes,
 * 4 thirds (1-3, 2-4 … then mirrored down), 5 groups of four (1-2-3-4, 2-3-4-5 … then mirrored down).
 */
export function scaleStepSequence(scale: ScaleShape, step: ScaleStep, seed = 0): number[] {
  const n = scale.notes.length;
  switch (step) {
    case 1:
      return upDown(n);
    case 2:
      return turning(n, seed);
    case 3:
      return randomNotes(n, seed);
    case 4:
      return groupsUpAndDown(n, 3, true);
    case 5:
      return groupsUpAndDown(n, 4, false);
  }
}

/** E9 chromatic 1-2-3-4 (§11.14): one four-note group per string, 6 → 1 then back (4-3-2-1 on the way down). */
export function chromaticGroups(startFret: number): { string: number; fret: number }[][] {
  const groups: { string: number; fret: number }[][] = [];
  for (let string = 6; string >= 1; string--)
    groups.push([0, 1, 2, 3].map((k) => ({ string, fret: startFret + k })));
  for (let string = 1; string <= 6; string++)
    groups.push([3, 2, 1, 0].map((k) => ({ string, fret: startFret + k })));
  return groups;
}
