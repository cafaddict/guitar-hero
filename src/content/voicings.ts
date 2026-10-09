/**
 * Seed voicings (SPEC §6.4; v1.1 §6.4 adds four power chords, 29 in all). frets/fingers run from the 6th string to the 1st string.
 * Fingerings are suggestions from the pedagogy research; physical plausibility is tested.
 */
import type { ChordVoicing, Fret } from '../domain/voicing';

type FingerCell = 1 | 2 | 3 | 4 | 'T' | 0 | null;

function parseFrets(spec: string): Fret[] {
  return spec.split(' ').map((c) => (c === 'x' ? 'x' : Number(c)));
}

function parseFingers(spec: string): FingerCell[] {
  return spec.split(' ').map((c) => (c === '-' ? null : c === 'T' ? 'T' : (Number(c) as FingerCell)));
}

interface SeedRow {
  id: string;
  symbol: string;
  frets: string;
  fingers: string;
  stage: number;
  nameKo?: string;
  barres?: ChordVoicing['barres'];
  tags?: string[];
}

const ROWS: readonly SeedRow[] = [
  { id: 'D', symbol: 'D', frets: 'x x 0 2 3 2', fingers: '- - 0 1 3 2', stage: 1 },
  { id: 'A', symbol: 'A', frets: 'x 0 2 2 2 0', fingers: '- 0 2 1 3 0', stage: 1 },
  { id: 'E', symbol: 'E', frets: '0 2 2 1 0 0', fingers: '0 2 3 1 0 0', stage: 2 },
  { id: 'Em', symbol: 'Em', frets: '0 2 2 0 0 0', fingers: '0 2 3 0 0 0', stage: 3 },
  { id: 'Am', symbol: 'Am', frets: 'x 0 2 2 1 0', fingers: '- 0 2 3 1 0', stage: 3 },
  { id: 'Dm', symbol: 'Dm', frets: 'x x 0 2 3 1', fingers: '- - 0 2 3 1', stage: 4 },
  { id: 'C', symbol: 'C', frets: 'x 3 2 0 1 0', fingers: '- 3 2 0 1 0', stage: 5 },
  {
    id: 'G-2f',
    symbol: 'G',
    nameKo: 'G (두 손가락)',
    frets: '3 x 0 0 0 3',
    fingers: '2 - 0 0 0 3',
    stage: 6,
  },
  {
    id: 'G-3f',
    symbol: 'G',
    nameKo: 'G (세 손가락)',
    frets: '3 2 0 0 0 3',
    fingers: '2 1 0 0 0 3',
    stage: 6,
  },
  {
    id: 'G-4f',
    symbol: 'G',
    nameKo: 'G (네 손가락)',
    frets: '3 2 0 0 3 3',
    fingers: '2 1 0 0 3 4',
    stage: 8,
  },
  { id: 'Cadd9', symbol: 'Cadd9', frets: 'x 3 2 0 3 3', fingers: '- 2 1 0 3 4', stage: 8 },
  { id: 'Dsus4', symbol: 'Dsus4', frets: 'x x 0 2 3 3', fingers: '- - 0 1 3 4', stage: 8 },
  { id: 'A7sus4', symbol: 'A7sus4', frets: 'x 0 2 0 3 3', fingers: '- 0 1 0 3 4', stage: 8 },
  { id: 'Em7', symbol: 'Em7', frets: '0 2 2 0 3 3', fingers: '0 1 2 0 3 4', stage: 8 },
  { id: 'Fmaj7', symbol: 'Fmaj7', frets: 'x x 3 2 1 0', fingers: '- - 3 2 1 0', stage: 9 },
  {
    id: 'F-small',
    symbol: 'F',
    nameKo: 'F (작은 F)',
    frets: 'x x 3 2 1 1',
    fingers: '- - 3 2 1 1',
    stage: 9,
    barres: [{ fret: 1, fromIdx: 4, toIdx: 5, finger: 1 }],
  },
  {
    id: 'F',
    symbol: 'F',
    nameKo: 'F (바레)',
    frets: '1 3 3 2 1 1',
    fingers: '1 3 4 2 1 1',
    stage: 9,
    barres: [{ fret: 1, fromIdx: 0, toIdx: 5, finger: 1 }],
  },
  { id: 'G5', symbol: 'G5', frets: '3 5 5 x x x', fingers: '1 3 4 - - -', stage: 10, tags: ['power'] },
  { id: 'C5', symbol: 'C5', frets: 'x 3 5 5 x x', fingers: '- 1 3 4 - -', stage: 10, tags: ['power'] },
  // v1.1 open/movable power chords (SPEC v1.1 §6.4, D-053): Stage 10 songs need more than G5 and C5.
  { id: 'E5', symbol: 'E5', frets: '0 2 2 x x x', fingers: '0 1 2 - - -', stage: 10, tags: ['power'] },
  { id: 'A5', symbol: 'A5', frets: 'x 0 2 2 x x', fingers: '- 0 1 2 - -', stage: 10, tags: ['power'] },
  { id: 'D5', symbol: 'D5', frets: 'x x 0 2 3 x', fingers: '- - 0 1 3 -', stage: 10, tags: ['power'] },
  { id: 'F5', symbol: 'F5', frets: '1 3 3 x x x', fingers: '1 3 4 - - -', stage: 10, tags: ['power'] },
  { id: 'A7', symbol: 'A7', frets: 'x 0 2 0 2 0', fingers: '- 0 2 0 3 0', stage: 11 },
  { id: 'D7', symbol: 'D7', frets: 'x x 0 2 1 2', fingers: '- - 0 2 1 3', stage: 11 },
  { id: 'E7', symbol: 'E7', frets: '0 2 0 1 0 0', fingers: '0 2 0 1 0 0', stage: 11 },
  { id: 'G7', symbol: 'G7', frets: '3 2 0 0 0 1', fingers: '3 2 0 0 0 1', stage: 11 },
  { id: 'C7', symbol: 'C7', frets: 'x 3 2 3 1 0', fingers: '- 3 2 4 1 0', stage: 11 },
  { id: 'B7', symbol: 'B7', frets: 'x 2 1 2 0 2', fingers: '- 2 1 3 0 4', stage: 11 },
];

function baseFretOf(frets: readonly Fret[]): number {
  const fretted = frets.filter((f): f is number => typeof f === 'number' && f > 0);
  const max = Math.max(0, ...fretted);
  return max <= 4 ? 1 : Math.min(...fretted);
}

export const SEED_VOICINGS: readonly ChordVoicing[] = ROWS.map((row) => {
  const frets = parseFrets(row.frets);
  const voicing: ChordVoicing = {
    id: row.id,
    symbol: row.symbol,
    frets,
    fingers: parseFingers(row.fingers),
    baseFret: baseFretOf(frets),
    stage: row.stage,
    tags: [...(row.tags ?? []), ...(row.stage <= 7 ? ['open', 'beginner1'] : ['beginner2'])],
    ...(row.nameKo ? { nameKo: row.nameKo } : {}),
    ...(row.barres ? { barres: row.barres } : {}),
  };
  return voicing;
});

const BY_ID = new Map(SEED_VOICINGS.map((v) => [v.id, v]));

export function voicingById(id: string): ChordVoicing {
  const voicing = BY_ID.get(id);
  if (!voicing) throw new Error(`unknown voicing ${id}`);
  return voicing;
}

export function hasVoicing(id: string): boolean {
  return BY_ID.has(id);
}

/** The eight Stage 0–7 chord classes (both G voicings belong to class 'G'). */
export const BEGINNER_CHORD_CLASSES = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G'] as const;
export type BeginnerChordClass = (typeof BEGINNER_CHORD_CLASSES)[number];

/** The user's current G voicing (SPEC v1.1 §6.4): two-finger → three-finger → four-finger. */
export type GVoicing = 'G-2f' | 'G-3f' | 'G-4f';
export const G_VOICINGS: readonly GVoicing[] = ['G-2f', 'G-3f', 'G-4f'];

/**
 * Chord class → voicing id, resolving class G to the user's current G voicing (SPEC v1.1 §6.4–6.5). The
 * four-finger G is also its own class ('G-4f', Stage 8 pairs), which always resolves to itself.
 */
export function voicingForClass(chordClass: string, gVoicing: GVoicing): string {
  return chordClass === 'G' ? gVoicing : chordClass;
}

/**
 * Voicing id → chord class used in pair and recall keys (SPEC v1.1 §6.5): the two- and three-finger G share
 * class 'G' so records continue across the switch; every other voicing (G-4f and F-small included) is its own
 * class.
 */
export function classOfVoicing(id: string): string {
  return id === 'G-2f' || id === 'G-3f' ? 'G' : id;
}
