/**
 * Strum patterns (SPEC §11.6). Slots are eighth notes; 'D'/'U' = strum, '-' = rest (hand keeps moving).
 */
export interface StrumPattern {
  id: string;
  label: string;
  timeSignature: '4/4' | '6/8';
  slots: readonly ('D' | 'U' | '-')[];
  /** Slot indices with an accent (P4 beats 2 and 4, P5 beats 1 and 4). */
  accents: readonly number[];
  /** Graduation tempo, when defined (SPEC §11.6). */
  targetBpm?: number;
}

function slots(spec: string): ('D' | 'U' | '-')[] {
  return spec.split(' ') as ('D' | 'U' | '-')[];
}

export const STRUM_PATTERNS: readonly StrumPattern[] = [
  { id: 'P0', label: 'D D D D', timeSignature: '4/4', slots: slots('D - D - D - D -'), accents: [0] },
  { id: 'P1', label: 'D DU D D', timeSignature: '4/4', slots: slots('D - D U D - D -'), accents: [0] },
  { id: 'P2', label: 'D DU DU D', timeSignature: '4/4', slots: slots('D - D U D U D -'), accents: [0] },
  {
    id: 'P3',
    label: 'D DU UDU',
    timeSignature: '4/4',
    slots: slots('D - D U - U D U'),
    accents: [0],
    targetBpm: 80,
  },
  {
    id: 'P4',
    label: 'D D D D D D D D',
    timeSignature: '4/4',
    slots: slots('D D D D D D D D'),
    accents: [2, 6],
    targetBpm: 80,
  },
  {
    id: 'P5',
    label: 'D D U D D U (6/8)',
    timeSignature: '6/8',
    slots: slots('D D U D D U'),
    accents: [0, 3],
  },
];

export function patternById(id: string): StrumPattern {
  const pattern = STRUM_PATTERNS.find((p) => p.id === id);
  if (!pattern) throw new Error(`unknown pattern ${id}`);
  return pattern;
}

/** Number of eighth-note slots per beat: 2 in 4/4 (quarter beat), 3 in 6/8 (dotted-quarter beat). */
export function slotsPerBeat(pattern: StrumPattern): number {
  return pattern.timeSignature === '6/8' ? 3 : 2;
}
