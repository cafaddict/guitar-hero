import { describe, expect, it } from 'vitest';
import { extractMetrics, fretPositionResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { FretPositionRunner } from './runner';

const pluck = (status: string, clarity: number, decayRatio: number) => ({
  time: 0,
  jobKind: 'pluck' as const,
  detectorVersion: 'test',
  processingMs: 1,
  result: {
    status,
    verdict: status === 'OK' ? 'PASS' : 'FAIL',
    clarity,
    decayRatio,
    f0: 261.6,
    cents: 0,
    semitones: null,
    levelDb: -20,
    detectorVersion: 'test',
    confidence: 0.9,
    reasons: [],
    processingMs: 1,
  },
});

describe('E16 fret-position comparison (SPEC v1.1 §11.18)', () => {
  it('judges two plucks at each of three positions in Mode A (C4 on the 2nd string) and shows them side by side', () => {
    const { ctx, mic } = testContext();
    const runner = new FretPositionRunner(ctx, { plucksPerPosition: 2 });
    runner.start();
    expect(mic.job).toMatchObject({ kind: 'pluck' });
    expect((mic.job as { expectedF0: number }).expectedF0).toBeCloseTo(261.63, 1);
    for (const event of [
      pluck('OK', 0.95, 0.6),
      pluck('OK', 0.93, 0.55),
      pluck('WEAK', 0.7, 0.4),
      pluck('OK', 0.88, 0.45),
      pluck('MUTED', 0.5, 0.05),
      pluck('MUTED', 0.4, 0.04),
    ])
      mic.judged.emit(event);
    expect(runner.snapshot().phase).toBe('done');
    const result = fretPositionResultSchema.parse(runner.finish());
    expect(result.source).toBe('mic');
    expect(result.positions.map((p) => [p.pos, p.statuses])).toEqual([
      ['behind', ['OK', 'OK']],
      ['middle', ['WEAK', 'OK']],
      ['onFret', ['MUTED', 'MUTED']],
    ]);
    expect(result.positions[0]!.clarity).toBeCloseTo(0.94, 5);
    expect(extractMetrics('E16', result)).toEqual([{ subjectKey: 'fretpos', metric: 'done', value: 1 }]);
  });

  it('without a microphone the user rates each pluck (1 clean / 2 muted / 3 buzz)', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new FretPositionRunner(ctx, { plucksPerPosition: 2 });
    runner.start();
    for (const cmd of ['manual1', 'manual1', 'manual3', 'manual1', 'manual2', 'manual3'] as const)
      runner.command(cmd);
    const result = runner.finish();
    expect(result.source).toBe('self');
    expect(result.positions.map((p) => p.statuses)).toEqual([
      ['clean', 'clean'],
      ['buzz', 'clean'],
      ['muted', 'buzz'],
    ]);
  });
});
