/**
 * Deterministic coaching hints from per-string judgements (SPEC §6.7). Returns hint codes with parameters;
 * wording lives in i18n/ko.ts (D-016).
 */
import { stringNumber } from './strings';
import { type ChordVoicing, type FingerId, lowestPlayedString } from './voicing';

export type JudgedStatus =
  | 'OK'
  | 'MUTED'
  | 'WRONG_NOTE'
  | 'UNEXPECTED'
  | 'WEAK'
  | 'UNVERIFIABLE'
  | 'NOT_PLAYED';

export interface StringJudgement {
  idx: number;
  status: JudgedStatus;
  /** Measured minus expected, in semitones (WRONG_NOTE only). */
  semitones?: number | null;
}

export type CoachingHint =
  | { code: 'mutedOpenAdjacentFinger'; stringNo: number; finger: FingerId }
  | { code: 'mutedOpenGeneric'; stringNo: number }
  | { code: 'mutedFretted'; stringNo: number; finger: FingerId }
  | { code: 'wrongFret'; stringNo: number; semitones: number }
  | { code: 'openStringPressed'; stringNo: number }
  | { code: 'openStringFlat'; stringNo: number }
  | { code: 'unexpectedXString'; stringNo: number; lowestStringNo: number }
  | { code: 'weak'; stringNo: number }
  | { code: 'generalTip'; tipIndex: number }
  // v1.1 (§6.7)
  | { code: 'mutedBarre'; stringNo: number }
  | { code: 'sequenceWrongNote'; position: number; semitones: number; stringNo: number; fret: number }
  | { code: 'sequenceStopped' }
  | { code: 'buzzSuspect' };

export const REPEATED_FAILURE_THRESHOLD = 3;

function fingerAt(voicing: ChordVoicing, idx: number): FingerId | null {
  const fret = voicing.frets[idx];
  const finger = voicing.fingers[idx];
  if (typeof fret !== 'number' || fret === 0) return null;
  if (finger === null || finger === 0 || finger === undefined) return null;
  return finger;
}

/** Hint for one judged string, or null when it needs none (OK / unverifiable / not played). */
export function hintForString(voicing: ChordVoicing, judgement: StringJudgement): CoachingHint | null {
  const { idx, status } = judgement;
  const stringNo = stringNumber(idx);
  const fret = voicing.frets[idx];
  switch (status) {
    case 'MUTED': {
      if (fret === 0) {
        // The finger on the lower neighbour (idx − 1) leans onto this string most often; then the upper one.
        for (const neighbour of [idx - 1, idx + 1]) {
          if (neighbour < 0 || neighbour > 5) continue;
          const finger = fingerAt(voicing, neighbour);
          if (finger !== null) return { code: 'mutedOpenAdjacentFinger', stringNo, finger };
        }
        return { code: 'mutedOpenGeneric', stringNo };
      }
      // A string under the barre finger (F, F-small): roll the index finger toward its bony edge (v1.1 §6.7).
      const barre = voicing.barres?.find((b) => idx >= b.fromIdx && idx <= b.toIdx && fret === b.fret);
      if (barre) return { code: 'mutedBarre', stringNo };
      const finger = fingerAt(voicing, idx);
      return finger !== null
        ? { code: 'mutedFretted', stringNo, finger }
        : { code: 'mutedOpenGeneric', stringNo };
    }
    case 'WRONG_NOTE': {
      const semitones = Math.round(judgement.semitones ?? 0);
      if (fret === 0)
        return semitones > 0 ? { code: 'openStringPressed', stringNo } : { code: 'openStringFlat', stringNo };
      return { code: 'wrongFret', stringNo, semitones };
    }
    case 'UNEXPECTED':
      return {
        code: 'unexpectedXString',
        stringNo,
        lowestStringNo: stringNumber(lowestPlayedString(voicing)),
      };
    case 'WEAK':
      return { code: 'weak', stringNo };
    default:
      return null;
  }
}

/**
 * Hints for a whole attempt. After every 3rd consecutive failed attempt a general tip is appended,
 * rotating through `tipCount` tips.
 */
export function coachingHints(
  voicing: ChordVoicing,
  judgements: readonly StringJudgement[],
  consecutiveFailures: number,
  tipCount: number,
): CoachingHint[] {
  const hints = judgements.map((j) => hintForString(voicing, j)).filter((h): h is CoachingHint => h !== null);
  if (
    consecutiveFailures >= REPEATED_FAILURE_THRESHOLD &&
    consecutiveFailures % REPEATED_FAILURE_THRESHOLD === 0 &&
    tipCount > 0
  ) {
    hints.push({
      code: 'generalTip',
      tipIndex: (consecutiveFailures / REPEATED_FAILURE_THRESHOLD - 1) % tipCount,
    });
  }
  return hints;
}

/** A sequence note (TAB position) and its verdict, for the sequence hints. */
export interface SequenceNoteJudgement {
  string: number;
  fret: number;
  status: 'OK' | 'WRONG_NOTE' | 'UNCLEAR' | 'MISSED' | 'HAMMER_OK';
  semitones?: number;
}

/**
 * Sequence hints (v1.1 §6.7, §10.10): the first wrong note of the cycle ("n번째 음이 반음 d개 높아요/낮아요"
 * with its TAB position) and a stop (two or more MISSED in a row → "손은 계속 박에 맞춰").
 */
export function sequenceHints(notes: readonly SequenceNoteJudgement[]): CoachingHint[] {
  const hints: CoachingHint[] = [];
  const wrong = notes.findIndex((n) => n.status === 'WRONG_NOTE');
  if (wrong >= 0) {
    const n = notes[wrong]!;
    hints.push({
      code: 'sequenceWrongNote',
      position: wrong + 1,
      semitones: Math.round(n.semitones ?? 0),
      stringNo: n.string,
      fret: n.fret,
    });
  }
  if (notes.some((n, i) => n.status === 'MISSED' && notes[i + 1]?.status === 'MISSED'))
    hints.push({ code: 'sequenceStopped' });
  return hints;
}
