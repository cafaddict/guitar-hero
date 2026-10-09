/**
 * App-authored practice songs (SPEC §6.6): chord-progression etudes, no copyrighted material.
 * Bars hold voicing ids; G uses the class id 'G' and resolves to the user's current G voicing.
 */
import type { PracticeSong } from './schemas';

export const PRACTICE_SONGS: readonly PracticeSong[] = [
  {
    id: 's01',
    title: '첫걸음 행진',
    stage: 1,
    timeSignature: '4/4',
    bpmDefault: 60,
    bpmMin: 40,
    patternId: 'P0',
    sections: [{ name: 'A', bars: ['D', 'D', 'A', 'A'], repeat: 4 }],
  },
  {
    id: 's02',
    title: '두 코드 산책',
    stage: 1,
    timeSignature: '4/4',
    bpmDefault: 60,
    bpmMin: 40,
    patternId: 'P0',
    sections: [
      { name: 'A', bars: ['A', 'A', 'D', 'D'], repeat: 2 },
      { name: 'B', bars: ['D', 'A', 'D', 'A'], repeat: 2 },
    ],
  },
  {
    id: 's03',
    title: '세 코드 블루스',
    stage: 2,
    timeSignature: '4/4',
    bpmDefault: 65,
    bpmMin: 45,
    patternId: 'P0',
    sections: [{ name: 'A', bars: ['A', 'A', 'A', 'A', 'D', 'D', 'A', 'A', 'E', 'D', 'A', 'E'], repeat: 2 }],
  },
  {
    id: 's04',
    title: '비 오는 저녁',
    stage: 3,
    timeSignature: '4/4',
    bpmDefault: 65,
    bpmMin: 45,
    patternId: 'P1',
    sections: [
      { name: 'A', bars: ['Em', 'Em', 'Am', 'Am'], repeat: 2 },
      { name: 'B', bars: ['D', 'D', 'Em', 'Em'], repeat: 2 },
    ],
  },
  {
    id: 's05',
    title: '메트로놈 친구',
    stage: 4,
    timeSignature: '4/4',
    bpmDefault: 70,
    bpmMin: 50,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['Dm', 'Dm', 'A', 'A'], repeat: 2 },
      { name: 'B', bars: ['Dm', 'Am', 'E', 'Am'], repeat: 2 },
    ],
  },
  {
    id: 's06',
    title: '처음 만난 C',
    stage: 5,
    timeSignature: '4/4',
    bpmDefault: 70,
    bpmMin: 50,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['C', 'C', 'Am', 'Am'], repeat: 2 },
      { name: 'B', bars: ['Dm', 'Dm', 'E', 'E'], repeat: 1 },
      { name: 'C', bars: ['C', 'Em', 'Am', 'Am'], repeat: 1 },
    ],
  },
  {
    id: 's07',
    title: '들판의 G',
    stage: 6,
    timeSignature: '4/4',
    bpmDefault: 70,
    bpmMin: 50,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['G', 'C', 'D', 'G'], repeat: 2 },
      { name: 'B', bars: ['C', 'C', 'G', 'G', 'D', 'D', 'G', 'G'], repeat: 1 },
    ],
  },
  {
    id: 's08',
    title: '느린 6/8 자장가',
    stage: 6,
    timeSignature: '6/8',
    bpmDefault: 50,
    bpmMin: 40,
    patternId: 'P5',
    sections: [{ name: 'A', bars: ['G', 'Em', 'C', 'D'], repeat: 4 }],
  },
  {
    id: 's09',
    title: '여덟 코드 여행',
    stage: 7,
    timeSignature: '4/4',
    bpmDefault: 75,
    bpmMin: 55,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['G', 'Em', 'C', 'D'], repeat: 2 },
      { name: 'B', bars: ['Am', 'Dm', 'E', 'A'], repeat: 2 },
    ],
  },
  {
    id: 's10',
    title: '졸업 행진',
    stage: 7,
    timeSignature: '4/4',
    bpmDefault: 80,
    bpmMin: 60,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['C', 'G', 'Am', 'Em'], repeat: 2 },
      { name: 'B', bars: ['Dm', 'G', 'C', 'C'], repeat: 1 },
      { name: 'C', bars: ['D', 'A', 'E', 'E'], repeat: 1 },
    ],
  },
  // --- Beginner 2 (SPEC v1.1 §6.6): two or more songs per stage, only chords learned by the stage ---------
  {
    id: 's11',
    title: '물결 드론',
    stage: 8,
    timeSignature: '4/4',
    bpmDefault: 75,
    bpmMin: 55,
    patternId: 'P4',
    sections: [
      { name: 'A', bars: ['G-4f', 'G-4f', 'Cadd9', 'Cadd9'], repeat: 2 },
      { name: 'B', bars: ['Em7', 'Em7', 'Dsus4', 'Dsus4'], repeat: 2 },
    ],
  },
  {
    id: 's12',
    title: '창가의 아침',
    stage: 8,
    timeSignature: '4/4',
    bpmDefault: 75,
    bpmMin: 55,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['G-4f', 'Dsus4', 'Em7', 'Cadd9'], repeat: 2 },
      { name: 'B', bars: ['Cadd9', 'Dsus4', 'A7sus4', 'A7sus4'], repeat: 1 },
      { name: 'C', bars: ['G-4f', 'Cadd9', 'Dsus4', 'G-4f'], repeat: 1 },
    ],
  },
  {
    id: 's13',
    title: '첫 F, 가볍게',
    stage: 9,
    timeSignature: '4/4',
    bpmDefault: 70,
    bpmMin: 50,
    patternId: 'P1',
    // Playable without the full barre: Fmaj7 and the small F only (§6.6).
    sections: [
      { name: 'A', bars: ['C', 'C', 'Fmaj7', 'Fmaj7'], repeat: 2 },
      { name: 'B', bars: ['Am', 'F-small', 'C', 'G'], repeat: 2 },
    ],
  },
  {
    id: 's14',
    title: '해질녘 언덕',
    stage: 9,
    timeSignature: '4/4',
    bpmDefault: 75,
    bpmMin: 55,
    patternId: 'P3',
    sections: [
      { name: 'A', bars: ['Am', 'F', 'C', 'G'], repeat: 2 },
      { name: 'B', bars: ['F', 'G', 'C', 'Am'], repeat: 1 },
      { name: 'C', bars: ['Dm', 'F', 'G', 'C'], repeat: 1 },
    ],
  },
  {
    id: 's15',
    title: '차고 리허설',
    stage: 10,
    timeSignature: '4/4',
    bpmDefault: 85,
    bpmMin: 60,
    patternId: 'P4',
    palmMute: true,
    sections: [
      { name: 'A', bars: ['E5', 'E5', 'A5', 'A5'], repeat: 2 },
      { name: 'B', bars: ['D5', 'A5', 'E5', 'E5'], repeat: 2 },
    ],
  },
  {
    id: 's16',
    title: '지하철 라이더',
    stage: 10,
    timeSignature: '4/4',
    bpmDefault: 85,
    bpmMin: 60,
    patternId: 'P6',
    sections: [
      { name: 'A', bars: ['G5', 'G5', 'C5', 'C5'], repeat: 2 },
      { name: 'B', bars: ['F5', 'G5', 'E5', 'G5'], repeat: 2 },
    ],
  },
  // Stage 11: 12-bar blues | I | I | I | I | IV | IV | I | I | V | IV | I | V | in shuffle, I–IV–V as 7th chords.
  {
    id: 's17',
    title: 'G 셔플 블루스',
    stage: 11,
    timeSignature: '4/4',
    bpmDefault: 80,
    bpmMin: 60,
    patternId: 'P7',
    feel: 'shuffle',
    sections: [
      {
        name: '12',
        bars: ['G7', 'G7', 'G7', 'G7', 'C7', 'C7', 'G7', 'G7', 'D7', 'C7', 'G7', 'D7'],
        repeat: 2,
      },
    ],
  },
  {
    id: 's18',
    title: 'A 셔플 블루스',
    stage: 11,
    timeSignature: '4/4',
    bpmDefault: 80,
    bpmMin: 60,
    patternId: 'P8',
    feel: 'shuffle',
    sections: [
      {
        name: '12',
        bars: ['A7', 'A7', 'A7', 'A7', 'D7', 'D7', 'A7', 'A7', 'E7', 'D7', 'A7', 'E7'],
        repeat: 2,
      },
    ],
  },
  {
    id: 's19',
    title: 'E 셔플 블루스',
    stage: 11,
    timeSignature: '4/4',
    bpmDefault: 80,
    bpmMin: 60,
    patternId: 'P7',
    feel: 'shuffle',
    sections: [
      {
        name: '12',
        bars: ['E7', 'E7', 'E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'A7', 'E7', 'B7'],
        repeat: 2,
      },
    ],
  },
];

/** The 12-bar blues form of SPEC v1.1 §6.6 (degrees per bar; quick change none). */
export const BLUES_FORM = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'] as const;

export function songById(id: string): PracticeSong {
  const song = PRACTICE_SONGS.find((s) => s.id === id);
  if (!song) throw new Error(`unknown song ${id}`);
  return song;
}

/** Chord classes used by a song ('G' stays 'G'). */
export function songChordClasses(song: PracticeSong): string[] {
  return [...new Set(song.sections.flatMap((s) => s.bars))];
}

/** Total bars including repeats. */
export function songBarCount(song: PracticeSong): number {
  return song.sections.reduce((sum, s) => sum + s.bars.length * s.repeat, 0);
}
