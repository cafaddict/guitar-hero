/**
 * App-authored single-note riffs (SPEC v1.1 §6.9) — no copyrighted riffs. Notes are `string:fret` with the
 * string numbered 6 (low E) … 1 (high E); `q` = quarter notes, `e` = eighth notes.
 */
export interface RiffNote {
  /** Guitar string number, 6 = low E … 1 = high E. */
  string: number;
  fret: number;
}

export interface Riff {
  id: string;
  stage: number;
  bpm: number;
  value: 'q' | 'e';
  palmMute: boolean;
  /** One array per bar. */
  bars: readonly (readonly RiffNote[])[];
}

function bar(spec: string): RiffNote[] {
  return spec.split(' ').map((cell) => {
    const [s, f] = cell.split(':');
    return { string: Number(s), fret: Number(f) };
  });
}

export const RIFFS: readonly Riff[] = [
  {
    id: 'R1',
    stage: 2,
    bpm: 60,
    value: 'q',
    palmMute: false,
    bars: [bar('6:0 6:0 6:3 6:3'), bar('5:0 5:0 5:2 5:2'), bar('6:0 6:0 6:3 6:3'), bar('5:2 5:0 6:3 6:0')],
  },
  {
    id: 'R2',
    stage: 4,
    bpm: 60,
    value: 'e',
    palmMute: false,
    bars: [bar('5:0 5:0 5:3 5:0 4:0 4:0 4:2 4:0'), bar('5:0 5:0 5:3 5:0 4:2 4:0 5:3 5:0')],
  },
  {
    id: 'R3',
    stage: 8,
    bpm: 70,
    value: 'e',
    palmMute: false,
    bars: [bar('6:0 6:3 5:0 5:2 4:0 4:2 5:2 5:0'), bar('6:0 6:3 5:0 5:2 4:2 4:0 6:3 6:0')],
  },
  {
    id: 'R4',
    stage: 10,
    bpm: 80,
    value: 'e',
    palmMute: true,
    bars: [bar('6:0 6:0 6:3 6:0 6:5 6:0 6:3 6:0'), bar('5:0 5:0 5:3 5:0 5:5 5:0 5:3 5:0')],
  },
];

/** E17 ladder goal: the riff's own tempo + 20 (SPEC v1.1 §11.19, design value). */
export const RIFF_TARGET_EXTRA_BPM = 20;

export function riffById(id: string): Riff {
  const riff = RIFFS.find((r) => r.id === id);
  if (!riff) throw new Error(`unknown riff ${id}`);
  return riff;
}

export function riffNotes(riff: Riff): RiffNote[] {
  return riff.bars.flat();
}
