import { describe, expect, it } from 'vitest';
import { altPickResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { AltPickRunner } from './runner';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

async function run(jitterS: (i: number) => number, drop: (i: number) => boolean = () => false, mic = true) {
  const t = testContext({ mic });
  const runner = new AltPickRunner(t.ctx, { stringIdx: 3, bpm: 60, bars: 8 });
  runner.start();
  await flush();
  const grid = t.output.metronome.gridStartTime()!;
  const pending = Array.from({ length: 64 }, (_, i) => i)
    .filter((i) => !drop(i))
    .map((i) => grid + i * 0.5 + jitterS(i));
  t.output.run(t.clock, 64 * 0.5 + 6, () => {
    while (mic && pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
      t.mic.judged.emit({
        time: pending.shift()!,
        result: null,
        jobKind: 'onsets',
        detectorVersion: DETECTOR_VERSION,
        processingMs: 1,
      });
    }
    runner.tick();
  });
  await flush();
  return { runner, t };
}

describe('E8 alternate picking', () => {
  it('even eighths: hit rate 1, small ioi_cv, passed', async () => {
    const { runner } = await run((i) => ((i % 3) - 1) * 0.005);
    const result = runner.finish();
    expect(altPickResultSchema.parse(result)).toEqual(result);
    expect(result.hitRate).toBe(1);
    expect(result.ioiCv!).toBeLessThan(0.05);
    expect(result.passed).toBe(true);
  });

  it('uneven picking fails on ioi_cv even with a good hit rate', async () => {
    const { runner } = await run((i) => (i % 2 === 0 ? 0 : 0.055));
    const result = runner.finish();
    expect(result.hitRate).toBe(1);
    expect(result.ioiCv!).toBeGreaterThan(0.1);
    expect(result.passed).toBe(false);
  });

  it('without a microphone the user rates the run', async () => {
    const { runner } = await run(
      () => 0,
      () => false,
      false,
    );
    expect(runner.snapshot().phase).toBe('review');
    runner.command('manual2');
    expect(runner.finish()).toMatchObject({ source: 'self', hitRate: 0.8, ioiCv: null, passed: false });
  });
});
