import { describe, expect, it } from 'vitest';
import { chromaticResultSchema, extractMetrics } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { ChromaticRunner, chromaticLadder, e9ParamsSchema } from './runner';

const c = (flawless: boolean) => ({ flawless, uncertain: false, stops: 0, okRatio: null });

describe('E9 chromatic 1-2-3-4 (SPEC v1.1 §11.14)', () => {
  it('ladder: 10 flawless groups in a row → +5; under half flawless twice in a row → −5', () => {
    expect(
      chromaticLadder(
        Array.from({ length: 10 }, () => c(true)),
        false,
      ),
    ).toBe('up');
    expect(
      chromaticLadder(
        Array.from({ length: 9 }, () => c(true)),
        false,
      ),
    ).toBe('stay');
    expect(chromaticLadder([c(false), c(false), c(true)], true)).toBe('down');
    expect(chromaticLadder([c(false), c(true)], true)).toBe('stay');
  });

  it('eighth-note four-note groups from the start fret; metrics under chromatic:<startFret>', () => {
    const t = testContext({ mic: false });
    const runner = new ChromaticRunner(t.ctx, e9ParamsSchema.parse({ startFret: 3, bpm: 70 }));
    runner.start();
    runner.command('toggle');
    for (let i = 0; i < 10; i++) runner.command('manual1');
    runner.command('next');
    const result = chromaticResultSchema.parse(runner.finish());
    expect(result).toMatchObject({ startFret: 3, ladder: 'up', source: 'self' });
    expect(extractMetrics('E9', result)).toEqual(
      expect.arrayContaining([
        { subjectKey: 'chromatic:3', metric: 'ladderBpm', value: 75 },
        { subjectKey: 'chromatic:3', metric: 'passBpm', value: 70 },
      ]),
    );
    expect(runner.snapshot().view.cycleNotes.map((n) => [n.string, n.fret])).toEqual([
      [6, 3],
      [6, 4],
      [6, 5],
      [6, 6],
    ]);
  });
});
