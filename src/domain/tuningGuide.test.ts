import { describe, expect, it } from 'vitest';
import { pegTurn, tuningAction } from './tuningGuide';

describe('tuning direction guide (SPEC v1.1 §9.3)', () => {
  it('flat → tighten (raise), sharp → loosen (lower), within ±3 cents → in tune', () => {
    expect(tuningAction(-12)).toBe('tighten');
    expect(tuningAction(9)).toBe('loosen');
    expect(tuningAction(-3)).toBe('inTune');
  });

  it('peg direction depends on the head shape and the side of the string', () => {
    // 3+3: 6th string (idx 0) bass side tightens counter-clockwise; 1st string (idx 5) clockwise.
    expect(pegTurn(0, '3+3', 'tighten')).toBe('ccw');
    expect(pegTurn(5, '3+3', 'tighten')).toBe('cw');
    expect(pegTurn(5, '3+3', 'loosen')).toBe('ccw');
    // Six in line: every peg tightens counter-clockwise.
    expect(pegTurn(5, 'inline6', 'tighten')).toBe('ccw');
    expect(pegTurn(0, 'inline6', 'loosen')).toBe('cw');
  });
});
