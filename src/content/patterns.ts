/**
 * Strum patterns (SPEC §11.6, v1.1 §6.10). Slots are eighth notes; 'D'/'U' = strum, '-' = rest (hand keeps
 * moving), 'X' = chop (left hand damps the strings; timed like any strum), 'd' = light down (judged as 'D').
 */
export type StrumSlot = 'D' | 'U' | 'X' | 'd' | '-';

export interface StrumPattern {
  id: string;
  label: string;
  timeSignature: '4/4' | '6/8';
  slots: readonly StrumSlot[];
  /** Shuffle feel: the off-beat eighth sits at r/(1+r) of the beat (§6.10 스윙 그리드). */
  swing?: boolean;
  /** Slot indices with an accent (P4 beats 2 and 4, P5 beats 1 and 4). */
  accents: readonly number[];
  /** Graduation tempo, when defined (SPEC §11.6). */
  targetBpm?: number;
}

function slots(spec: string): StrumSlot[] {
  return spec.split(' ') as StrumSlot[];
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
  // v1.1 (§6.10): chop, shuffle downs, shuffle down-up.
  { id: 'P6', label: 'D D X D', timeSignature: '4/4', slots: slots('D - D - X - D -'), accents: [0] },
  {
    id: 'P7',
    label: 'D d D d (셔플)',
    timeSignature: '4/4',
    slots: slots('D d D d D d D d'),
    accents: [0, 4],
    swing: true,
  },
  {
    id: 'P8',
    label: 'D U D U (셔플)',
    timeSignature: '4/4',
    slots: slots('D U D U D U D U'),
    accents: [0, 4],
    swing: true,
  },
];

/** The six v1 patterns: the v1 timing benchmark (Mode D) keeps exactly this set (SPEC v1.1 §14.0). */
export const V1_PATTERN_IDS = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5'] as const;

/** Default shuffle ratio (front eighth : back eighth = 2 : 1). */
export const DEFAULT_SWING_RATIO = 2;

/** Whether a slot symbol is played (a strum the timing judgement expects). */
export function isPlayedSlot(slot: StrumSlot): boolean {
  return slot !== '-';
}

/**
 * Grid times (s) of every slot over `bars` bars. Straight patterns split each beat evenly; swing patterns put
 * the off-beat eighth at t + T·r/(1+r) (§6.10).
 */
export function patternSlotTimes(
  pattern: StrumPattern,
  gridStart: number,
  bpm: number,
  bars: number,
  swingRatio = DEFAULT_SWING_RATIO,
): { time: number; expected: boolean }[] {
  const perBeat = slotsPerBeat(pattern);
  const beatS = 60 / bpm;
  const out: { time: number; expected: boolean }[] = [];
  for (let bar = 0; bar < bars; bar++) {
    pattern.slots.forEach((symbol, j) => {
      const k = bar * pattern.slots.length + j;
      const beat = Math.floor(k / perBeat);
      const within = k % perBeat;
      const offset =
        pattern.swing && perBeat === 2 && within === 1 ? swingRatio / (1 + swingRatio) : within / perBeat;
      out.push({ time: gridStart + (beat + offset) * beatS, expected: isPlayedSlot(symbol) });
    });
  }
  return out;
}

export function patternById(id: string): StrumPattern {
  const pattern = STRUM_PATTERNS.find((p) => p.id === id);
  if (!pattern) throw new Error(`unknown pattern ${id}`);
  return pattern;
}

/** Number of eighth-note slots per beat: 2 in 4/4 (quarter beat), 3 in 6/8 (dotted-quarter beat). */
export function slotsPerBeat(pattern: StrumPattern): number {
  return pattern.timeSignature === '6/8' ? 3 : 2;
}

/** Pattern practice modes, opened in this order (SPEC v1.1 §6.10 "뮤트 → 단일 코드 → 진행"). */
export const STRUM_MODES = ['mute', 'single', 'progression'] as const;
export type StrumMode = (typeof STRUM_MODES)[number];

/** A mode graduates at this tempo (P3·P4 80, the others 70 — SPEC v1.1 §6.10, design value). */
export function modeOpenBpm(patternId: string): number {
  return patternId === 'P3' || patternId === 'P4' ? 80 : 70;
}

/** A newly opened mode (and every pattern ladder) starts here (SPEC §11.6). */
export const STRUM_START_BPM = 60;
