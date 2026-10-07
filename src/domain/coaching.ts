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
  | { code: 'generalTip'; tipIndex: number };

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
