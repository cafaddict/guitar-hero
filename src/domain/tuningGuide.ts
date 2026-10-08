/**
 * Tuning direction guide (SPEC v1.1 §9.3, research 01:238 "튜닝 가이드"): whether to tighten or loosen, and which
 * way to turn the tuning peg, seen from the front of the headstock. Pure.
 *
 * 3+3 headstock: the bass-side pegs (strings 6·5·4) tighten counter-clockwise, the treble side (3·2·1) clockwise.
 * Six in line: every peg tightens counter-clockwise.
 */
export type HeadStyle = '3+3' | 'inline6';
export type TuningAction = 'inTune' | 'tighten' | 'loosen';
export type PegTurn = 'cw' | 'ccw';

/** Within this many cents the guide says "맞아요" instead of a direction. */
export const GUIDE_IN_TUNE_CENTS = 3;

export function tuningAction(cents: number): TuningAction {
  if (Math.abs(cents) <= GUIDE_IN_TUNE_CENTS) return 'inTune';
  return cents < 0 ? 'tighten' : 'loosen';
}

/** Peg rotation for a string index (0 = 6th string) that raises (tighten) or lowers (loosen) the pitch. */
export function pegTurn(stringIdx: number, head: HeadStyle, action: 'tighten' | 'loosen'): PegTurn {
  const tightenTurn: PegTurn = head === 'inline6' || stringIdx <= 2 ? 'ccw' : 'cw';
  if (action === 'tighten') return tightenTurn;
  return tightenTurn === 'cw' ? 'ccw' : 'cw';
}
