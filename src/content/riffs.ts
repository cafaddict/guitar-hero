/**
 * App-authored single-note riffs (SPEC v1.1 §6.9) — no copyrighted riffs. Notes are `string:fret(finger)` with the
 * string numbered 6 (low E) … 1 (high E) and the fretting finger 1 (index) … 4 (pinky), as in the scale tables;
 * an open string has no finger. `q` = quarter notes, `e` = eighth notes. Fingering (D-080): one finger per fret
 * from the riff's position — R1–R3 in the first position (fret = finger), R4 in the third (3rd fret = 1, 5th = 3).
 */
export interface RiffNote {
  /** Guitar string number, 6 = low E … 1 = high E. */
  string: number;
  fret: number;
  /** Fretting finger 1–4; 0 = open string. */
  finger: number;
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

/** "6:3(3)" → string 6, fret 3, finger 3; "6:0" → an open string. */
function bar(spec: string): RiffNote[] {
  return spec.split(' ').map((cell) => {
    const match = /^(\d):(\d+)(?:\((\d)\))?$/.exec(cell);
    if (!match) throw new Error(`bad riff cell ${cell}`);
    return { string: Number(match[1]), fret: Number(match[2]), finger: match[3] ? Number(match[3]) : 0 };
  });
}

export const RIFFS: readonly Riff[] = [
  {
    id: 'R1',
    stage: 2,
    bpm: 60,
    value: 'q',
    palmMute: false,
    bars: [
      bar('6:0 6:0 6:3(3) 6:3(3)'),
      bar('5:0 5:0 5:2(2) 5:2(2)'),
      bar('6:0 6:0 6:3(3) 6:3(3)'),
      bar('5:2(2) 5:0 6:3(3) 6:0'),
    ],
  },
  {
    id: 'R2',
    stage: 4,
    bpm: 60,
    value: 'e',
    palmMute: false,
    bars: [bar('5:0 5:0 5:3(3) 5:0 4:0 4:0 4:2(2) 4:0'), bar('5:0 5:0 5:3(3) 5:0 4:2(2) 4:0 5:3(3) 5:0')],
  },
  {
    id: 'R3',
    stage: 8,
    bpm: 70,
    value: 'e',
    palmMute: false,
    bars: [
      bar('6:0 6:3(3) 5:0 5:2(2) 4:0 4:2(2) 5:2(2) 5:0'),
      bar('6:0 6:3(3) 5:0 5:2(2) 4:2(2) 4:0 6:3(3) 6:0'),
    ],
  },
  {
    id: 'R4',
    stage: 10,
    bpm: 80,
    value: 'e',
    palmMute: true,
    bars: [bar('6:0 6:0 6:3(1) 6:0 6:5(3) 6:0 6:3(1) 6:0'), bar('5:0 5:0 5:3(1) 5:0 5:5(3) 5:0 5:3(1) 5:0')],
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
