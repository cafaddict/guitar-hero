/**
 * String numbering convention (SPEC §6.1) — the only place that converts between them.
 * Internal index i = 0..5 runs from the 6th string (low E) to the 1st string (high E).
 * The UI uses guitarists' numbering "6번 줄 … 1번 줄".
 */
export const STRING_COUNT = 6;
export type StringIdx = 0 | 1 | 2 | 3 | 4 | 5;
export const STRING_INDICES: readonly StringIdx[] = [0, 1, 2, 3, 4, 5];

/** idx 0 → string 6, idx 5 → string 1. */
export function stringNumber(idx: number): number {
  if (!Number.isInteger(idx) || idx < 0 || idx >= STRING_COUNT) throw new RangeError(`bad string idx ${idx}`);
  return STRING_COUNT - idx;
}

/** string 6 → idx 0, string 1 → idx 5. */
export function stringIdx(stringNo: number): StringIdx {
  if (!Number.isInteger(stringNo) || stringNo < 1 || stringNo > STRING_COUNT) {
    throw new RangeError(`bad string number ${stringNo}`);
  }
  return (STRING_COUNT - stringNo) as StringIdx;
}
