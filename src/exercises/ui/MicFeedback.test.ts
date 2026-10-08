import { describe, expect, it } from 'vitest';
import { confidenceLabel } from './MicFeedback';

describe('practice-screen confidence (SPEC v1.1 §12.1)', () => {
  it('turns a judgement confidence into 확실 / 아마도 / 불확실; strum checks are beta', () => {
    expect(confidenceLabel({ jobKind: 'pluck', result: { confidence: 0.92 } })).toBe('sure');
    expect(confidenceLabel({ jobKind: 'pluck', result: { confidence: 0.6 } })).toBe('likely');
    expect(confidenceLabel({ jobKind: 'set', result: { confidence: 0.2 } })).toBe('unsure');
    expect(confidenceLabel({ jobKind: 'strum', result: { confidence: 0.9 } })).toBe('beta');
    expect(confidenceLabel({ jobKind: 'onsets', result: null })).toBeNull();
  });
});
