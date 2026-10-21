import { describe, expect, it } from 'vitest';
import { chromaticResultSchema, extractMetrics } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { e9Plugin } from './plugin';
import { ChromaticRunner, chromaticLadder, e9ParamsSchema } from './runner';

const c = (flawless: boolean) => ({ flawless, uncertain: false, stops: 0, okRatio: null });

describe('E9 chromatic 1-2-3-4 (SPEC v1.1 §11.14)', () => {
  it('ladder: 10 flawless groups in a row → +5; anything else stays, never −5 (D-098)', () => {
    expect(chromaticLadder(Array.from({ length: 10 }, () => c(true)))).toBe('up');
    expect(chromaticLadder(Array.from({ length: 9 }, () => c(true)))).toBe('stay');
    expect(chromaticLadder([c(false), c(false), c(true)])).toBe('stay');
    expect(chromaticLadder([c(false), c(true)])).toBe('stay');
    // A pause splits the run of flawless groups (D-085).
    const split = Array.from({ length: 10 }, (_, i) => ({ ...c(true), resumed: i === 5 }));
    expect(chromaticLadder(split)).toBe('stay');
  });

  it('withHistory: the tempo follows the latest run of the start fret', () => {
    const params = e9ParamsSchema.parse({ startFret: 5, bpm: 60 });
    const run = (flawless: boolean[], ladder: 'up' | 'stay', pauses?: number) =>
      chromaticResultSchema.parse({
        startFret: 5,
        bpm: 60,
        cycles: flawless.map((f) => c(f)),
        ladder,
        source: 'self',
        hitRate: null,
        okRatio: null,
        ioiCv: null,
        ...(pauses === undefined ? {} : { pauses }),
      });
    const low = [false, false, true];
    const good = [true, true, true];
    expect(e9Plugin.withHistory!(params, [run(low, 'stay'), run(good, 'stay')]).bpm).toBe(60);
    expect(e9Plugin.withHistory!(params, [run(low, 'stay', 1), run(good, 'up')]).bpm).toBe(60);
    expect(e9Plugin.withHistory!(params, [run(good, 'up'), run(low, 'stay')]).bpm).toBe(65);
    // A low run keeps the tempo: there is no step down any more (D-098).
    expect(e9Plugin.withHistory!(params, [run(low, 'stay'), run(low, 'stay')]).bpm).toBe(60);
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
