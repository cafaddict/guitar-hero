/**
 * Beta judgements (SPEC v1.1 §10.11): measured and reported, never a PASS/FAIL/RETRY, never a metric or a
 * progression input. The UI shows them with a "참고(베타)" label.
 */
export interface BetaResult<T> {
  value: T;
  /** 0..1 */
  confidence: number;
  beta: true;
}

export function beta<T>(value: T, confidence: number): BetaResult<T> {
  return { value, confidence: Math.max(0, Math.min(1, confidence)), beta: true };
}
