import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import type { ChordCheckResult } from '../../domain/exerciseResults';
import { stringTendencies } from './tendency';

const attempt = (statuses: Record<number, string>) => ({
  perString: Object.entries(statuses).map(([idx, status]) => ({
    idx: Number(idx),
    status: status as 'OK',
    selfStatus: null,
    cents: null,
    confidence: 0.9,
    semitones: status === 'WRONG_NOTE' ? 1 : null,
  })),
  clean: Object.values(statuses).every((s) => s === 'OK'),
  strumVerdict: null,
  selfAgreement: null,
});

describe('E1 per-string tendencies (SPEC v1.1 §11.3)', () => {
  it('reports strings muted or wrong in ≥ 2 attempts with the coaching hint for that string', () => {
    // C (x32010): the 2nd string (idx 4) is fretted at 1 by the 1st finger.
    const result: ChordCheckResult = {
      voicingId: 'C',
      mode: 'pluck',
      earFirst: false,
      cleanRatio: 1 / 3,
      attempts: [
        attempt({ 1: 'OK', 2: 'OK', 4: 'MUTED', 5: 'OK' }),
        attempt({ 1: 'OK', 2: 'WRONG_NOTE', 4: 'MUTED', 5: 'OK' }),
        attempt({ 1: 'OK', 2: 'OK', 4: 'OK', 5: 'OK' }),
      ],
    };
    const tendencies = stringTendencies(result, voicingById('C'));
    expect(tendencies).toHaveLength(1);
    expect(tendencies[0]).toMatchObject({ stringNo: 2, kind: 'muted', count: 2, attempts: 3 });
    expect(tendencies[0]!.hint).not.toBeNull();
  });
});
