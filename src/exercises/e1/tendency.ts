/**
 * E1 result summary, per-string tendencies (SPEC v1.1 §11.3, research 03:95): a string that came out muted or
 * wrong in two or more attempts is reported with its count and the coaching hint for that string
 * ("2번 줄이 3번 중 2번 막힘 → 검지가 2번 줄에 닿는 경향").
 */
import { type CoachingHint, hintForString } from '../../domain/coaching';
import type { ChordCheckResult } from '../../domain/exerciseResults';
import { stringNumber } from '../../domain/strings';
import type { ChordVoicing } from '../../domain/voicing';

export interface StringTendency {
  stringNo: number;
  kind: 'muted' | 'wrong';
  count: number;
  attempts: number;
  hint: CoachingHint | null;
}

export const TENDENCY_MIN_COUNT = 2;

export function stringTendencies(result: ChordCheckResult, voicing: ChordVoicing): StringTendency[] {
  const out: StringTendency[] = [];
  for (let idx = 0; idx < 6; idx++) {
    const judged = result.attempts.flatMap((a) => a.perString.filter((s) => s.idx === idx));
    if (judged.length === 0) continue;
    const muted = judged.filter(
      (s) => s.status === 'MUTED' || s.selfStatus === 'muted' || s.selfStatus === 'buzz',
    );
    const wrong = judged.filter((s) => s.status === 'WRONG_NOTE');
    if (muted.length >= TENDENCY_MIN_COUNT)
      out.push({
        stringNo: stringNumber(idx),
        kind: 'muted',
        count: muted.length,
        attempts: judged.length,
        hint: hintForString(voicing, { idx, status: 'MUTED' }),
      });
    if (wrong.length >= TENDENCY_MIN_COUNT)
      out.push({
        stringNo: stringNumber(idx),
        kind: 'wrong',
        count: wrong.length,
        attempts: judged.length,
        hint: hintForString(voicing, {
          idx,
          status: 'WRONG_NOTE',
          semitones: wrong.at(-1)?.semitones ?? null,
        }),
      });
  }
  return out.sort((a, b) => b.count - a.count || a.stringNo - b.stringNo);
}
