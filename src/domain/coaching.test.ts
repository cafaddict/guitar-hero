import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { ko } from '../i18n/ko';
import { coachingHints, hintForString } from './coaching';

const C = voicingById('C');
const D = voicingById('D');

describe('AC-D5 coaching hints (SPEC §6.7)', () => {
  it('MUTED open string with a finger on the neighbouring string → lift that finger', () => {
    // C chord, 3rd string (idx 3) open; idx 2 has finger 2.
    const hint = hintForString(C, { idx: 3, status: 'MUTED' });
    expect(hint).toEqual({ code: 'mutedOpenAdjacentFinger', stringNo: 3, finger: 2 });
    expect(ko.coaching.render(hint!)).toBe('2번 손가락이 3번 줄에 닿고 있을 수 있어요. 손끝을 세워 보세요.');
    // C chord, 1st string open (idx 5): only idx 4 (finger 1) is adjacent.
    expect(hintForString(C, { idx: 5, status: 'MUTED' })).toEqual({
      code: 'mutedOpenAdjacentFinger',
      stringNo: 1,
      finger: 1,
    });
  });

  it('MUTED fretted string → press right behind the fret with that finger', () => {
    const hint = hintForString(C, { idx: 4, status: 'MUTED' });
    expect(hint).toEqual({ code: 'mutedFretted', stringNo: 2, finger: 1 });
    expect(ko.coaching.render(hint!)).toBe('1번 손가락을 프렛 바로 뒤에 붙이고 손끝으로 눌러 보세요.');
  });

  it('WRONG_NOTE ±1 semitone on a fretted string → one fret higher/lower', () => {
    const up = hintForString(D, { idx: 4, status: 'WRONG_NOTE', semitones: 1 });
    expect(up).toEqual({ code: 'wrongFret', stringNo: 2, semitones: 1 });
    expect(ko.coaching.render(up!)).toBe('2번 줄에서 한 칸 높은 프렛을 누르고 있어요.');
    const down = hintForString(D, { idx: 4, status: 'WRONG_NOTE', semitones: -1 });
    expect(ko.coaching.render(down!)).toBe('2번 줄에서 한 칸 낮은 프렛을 누르고 있어요.');
  });

  it('WRONG_NOTE higher than an expected open string → do not press it', () => {
    const hint = hintForString(C, { idx: 3, status: 'WRONG_NOTE', semitones: 2 });
    expect(hint).toEqual({ code: 'openStringPressed', stringNo: 3 });
    expect(ko.coaching.render(hint!)).toBe('3번 줄은 누르지 않아요(개방현).');
  });

  it('UNEXPECTED x string → do not play it, start from the lowest played string', () => {
    const hint = hintForString(C, { idx: 0, status: 'UNEXPECTED' });
    expect(hint).toEqual({ code: 'unexpectedXString', stringNo: 6, lowestStringNo: 5 });
    expect(ko.coaching.render(hint!)).toBe('6번 줄은 치지 않아요(x). 5번 줄부터 스트럼하세요.');
    expect(hintForString(D, { idx: 1, status: 'UNEXPECTED' })).toEqual({
      code: 'unexpectedXString',
      stringNo: 5,
      lowestStringNo: 4,
    });
  });

  it('WEAK → play harder or move the device closer', () => {
    const hint = hintForString(C, { idx: 1, status: 'WEAK' });
    expect(ko.coaching.render(hint!)).toContain('30–60cm');
  });

  it('OK, UNVERIFIABLE and NOT_PLAYED produce no hint', () => {
    for (const status of ['OK', 'UNVERIFIABLE', 'NOT_PLAYED'] as const) {
      expect(hintForString(C, { idx: 1, status })).toBeNull();
    }
  });

  it('repeated failure (every 3rd) appends a rotating general tip', () => {
    const judgements = [{ idx: 4, status: 'MUTED' as const }];
    expect(coachingHints(C, judgements, 2, 4).some((h) => h.code === 'generalTip')).toBe(false);
    expect(coachingHints(C, judgements, 3, 4).at(-1)).toEqual({ code: 'generalTip', tipIndex: 0 });
    expect(coachingHints(C, judgements, 6, 4).at(-1)).toEqual({ code: 'generalTip', tipIndex: 1 });
    expect(coachingHints(C, judgements, 15, 4).at(-1)).toEqual({ code: 'generalTip', tipIndex: 0 });
    const rendered = ko.coaching.render({ code: 'generalTip', tipIndex: 0 });
    expect(rendered.length).toBeGreaterThan(5);
  });
});
