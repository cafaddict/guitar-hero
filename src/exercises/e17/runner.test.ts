import { describe, expect, it } from 'vitest';
import { extractMetrics, riffResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { mistakeRatio, RiffRunner, sequenceLadder } from './runner';

const cycle = (flawless: boolean, uncertain = false) => ({ flawless, uncertain, stops: 0, okRatio: null });

describe('E17 single-note riff (SPEC v1.1 §11.19)', () => {
  it('ladder: 4 flawless cycles in a row → up; mistakes in ≥ half of the cycles twice in a row → down', () => {
    expect(
      sequenceLadder(
        [true, true, false, true, true, true, true].map((f) => cycle(f)),
        false,
      ),
    ).toBe('up');
    expect(
      sequenceLadder(
        [true, true, true].map((f) => cycle(f)),
        false,
      ),
    ).toBe('stay');
    // An uncertain cycle neither counts nor breaks the streak (§10.10-4).
    expect(
      sequenceLadder([cycle(true), cycle(true), cycle(false, true), cycle(true), cycle(true)], false),
    ).toBe('up');
    expect(
      sequenceLadder(
        [false, false, true].map((f) => cycle(f)),
        false,
      ),
    ).toBe('stay');
    expect(
      sequenceLadder(
        [false, false, true].map((f) => cycle(f)),
        true,
      ),
    ).toBe('down');
    expect(mistakeRatio([cycle(false), cycle(true)])).toBe(0.5);
  });

  it('self-reported cycles with the metronome; records the riff ladder tempo', async () => {
    const { ctx, output } = testContext({ mic: false });
    const runner = new RiffRunner(ctx, { riffId: 'R1', bpm: 60, tabHidden: false, previousLow: false });
    runner.start();
    runner.command('toggle');
    expect(output.lastConfig?.bpm).toBe(60);
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('next');
    const result = riffResultSchema.parse(runner.finish());
    expect(result.ladder).toBe('up');
    expect(extractMetrics('E17', result)).toEqual(
      expect.arrayContaining([
        { subjectKey: 'riff:R1', metric: 'ladderBpm', value: 65 },
        { subjectKey: 'riff:R1', metric: 'passBpm', value: 60 },
      ]),
    );
  });
});
