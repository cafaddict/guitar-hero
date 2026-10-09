import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING } from '../domain/theory';
import { RIFFS, riffNotes } from './riffs';

const cells = (riff: (typeof RIFFS)[number]) =>
  riff.bars.map((b) => b.map((n) => `${n.string}:${n.fret}`).join(' '));

describe('SPEC v1.1 §6.9 riffs', () => {
  it('are the four app-authored riffs of the table (stage, tempo, note value, palm mute, notes)', () => {
    expect(RIFFS.map((r) => [r.id, r.stage, r.bpm, r.value, r.palmMute])).toEqual([
      ['R1', 2, 60, 'q', false],
      ['R2', 4, 60, 'e', false],
      ['R3', 8, 70, 'e', false],
      ['R4', 10, 80, 'e', true],
    ]);
    expect(RIFFS.map(cells)).toEqual([
      ['6:0 6:0 6:3 6:3', '5:0 5:0 5:2 5:2', '6:0 6:0 6:3 6:3', '5:2 5:0 6:3 6:0'],
      ['5:0 5:0 5:3 5:0 4:0 4:0 4:2 4:0', '5:0 5:0 5:3 5:0 4:2 4:0 5:3 5:0'],
      ['6:0 6:3 5:0 5:2 4:0 4:2 5:2 5:0', '6:0 6:3 5:0 5:2 4:2 4:0 6:3 6:0'],
      ['6:0 6:0 6:3 6:0 6:5 6:0 6:3 6:0', '5:0 5:0 5:3 5:0 5:5 5:0 5:3 5:0'],
    ]);
  });

  it('fill 4/4 bars (4 quarters or 8 eighths) and R3 stays inside E minor pentatonic', () => {
    for (const r of RIFFS) for (const b of r.bars) expect(b).toHaveLength(r.value === 'q' ? 4 : 8);
    const emPentatonic = new Set([4, 7, 9, 11, 2]); // E G A B D
    const r3 = riffNotes(RIFFS.find((r) => r.id === 'R3')!);
    for (const n of r3)
      expect(emPentatonic.has((STANDARD_TUNING.openMidi[6 - n.string]! + n.fret) % 12)).toBe(true);
  });
});
