import { describe, expect, it } from 'vitest';
import { paramsFromQuery } from './practiceParams';

describe('paramsFromQuery', () => {
  it('coerces values and merges over defaults', () => {
    const q = new URLSearchParams('voicingId=C&blockMs=60000&earFirst=true&pair=A,D&timeScale=0.25&id=007');
    expect(paramsFromQuery({ voicingId: 'Em', mode: 'pluck' }, q)).toEqual({
      voicingId: 'C',
      mode: 'pluck',
      blockMs: 60000,
      earFirst: true,
      pair: ['A', 'D'],
      timeScale: 0.25,
      id: 7,
    });
  });

  it('keeps one-element lists for list-typed params', () => {
    expect(paramsFromQuery({ chords: ['Em'] }, new URLSearchParams('chords=C'))).toEqual({ chords: ['C'] });
    expect(paramsFromQuery({ chords: ['Em'] }, new URLSearchParams('chords=C,G'))).toEqual({
      chords: ['C', 'G'],
    });
  });

  it('accepts JSON arrays and objects', () => {
    const q = new URLSearchParams(`chords=${encodeURIComponent('["C"]')}&bad=[oops`);
    expect(paramsFromQuery({}, q)).toEqual({ chords: ['C'], bad: '[oops' });
  });
});
