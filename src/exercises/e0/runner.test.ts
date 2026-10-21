import { describe, expect, it } from 'vitest';
import { tuningResultSchema } from '../../domain/exerciseResults';
import { midiToHz, STANDARD_TUNING } from '../../domain/theory';
import { testContext } from '../testing/fakes';
import { TuningRunner } from './runner';

describe('E0 tuning', () => {
  it('walks strings 6 → 1; five readings within ±3 cents mark a string in tune', () => {
    const { ctx, mic, clock } = testContext();
    const runner = new TuningRunner(ctx);
    runner.start();
    expect(mic.tunerOn).toBe(true);
    for (let idx = 0; idx < 6; idx++) {
      const f0 = midiToHz(STANDARD_TUNING.openMidi[idx]!);
      expect(mic.tunerTarget).toBeCloseTo(f0, 6);
      if (idx === 2) {
        runner.command('next'); // skipped (not in tune)
        continue;
      }
      // Out of tune first, then in tune.
      mic.tuner.emit({ f0: f0 * 2 ** (20 / 1200), stableF0: null });
      for (let k = 0; k < 5; k++) mic.tuner.emit({ f0: f0 * 2 ** (((k % 3) - 1) / 1200), stableF0: null });
      expect(runner.snapshot().view.inTune[idx]).toBe(true);
      clock.advance(0.8);
      runner.tick();
    }
    expect(runner.snapshot().phase).toBe('done');
    expect(mic.tunerOn).toBe(false);
    const result = runner.finish();
    expect(tuningResultSchema.parse(result)).toEqual(result);
    expect(result.complete).toBe(false);
    expect(result.strings.map((s) => s.inTune)).toEqual([true, true, false, true, true, true]);
    expect(result.strings[0]!.cents).toBeCloseTo(0, 0);
  });

  it('without a microphone the user confirms each string', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new TuningRunner(ctx);
    runner.start();
    for (let k = 0; k < 6; k++) runner.command('next');
    expect(runner.finish().complete).toBe(true);
  });

  it('prev goes back a string (D-096): the tuner re-targets it and it has to be tuned again', () => {
    const { ctx, mic, clock } = testContext();
    const runner = new TuningRunner(ctx);
    runner.start();
    expect(runner.canStepBack()).toBe(false);
    const f0 = midiToHz(STANDARD_TUNING.openMidi[0]!);
    for (let k = 0; k < 5; k++) mic.tuner.emit({ f0, stableF0: null });
    clock.advance(0.8);
    runner.tick();
    expect(runner.snapshot().view.idx).toBe(1);
    expect(runner.canStepBack()).toBe(true);
    runner.command('prev');
    expect(runner.snapshot().view).toMatchObject({ idx: 0, cents: null });
    expect(runner.snapshot().view.inTune[0]).toBe(false);
    expect(runner.snapshot().view.finalCents[0]).toBeNull();
    expect(mic.tunerTarget).toBeCloseTo(f0, 6);
    expect(runner.canStepBack()).toBe(false);
    // Readings from before the step back do not count: five fresh ones are needed.
    for (let k = 0; k < 4; k++) mic.tuner.emit({ f0, stableF0: null });
    expect(runner.snapshot().view.inTune[0]).toBe(false);
    mic.tuner.emit({ f0, stableF0: null });
    expect(runner.snapshot().view.inTune[0]).toBe(true);
  });

  it('prev while a tuned string waits to advance stays on the string before; a skip is undone too', () => {
    const { ctx, mic } = testContext();
    const runner = new TuningRunner(ctx);
    runner.start();
    runner.command('next'); // 6th string skipped
    expect(runner.snapshot().view.skipped[0]).toBe(true);
    const f0 = midiToHz(STANDARD_TUNING.openMidi[1]!);
    for (let k = 0; k < 5; k++) mic.tuner.emit({ f0, stableF0: null });
    runner.command('prev'); // before the 0.7 s advance
    runner.tick();
    expect(runner.snapshot().view.idx).toBe(0);
    expect(runner.snapshot().view.skipped[0]).toBe(false);
  });

  it('without a microphone a string confirmed by mistake is confirmed again after prev', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new TuningRunner(ctx);
    runner.start();
    runner.command('next');
    runner.command('prev');
    expect(runner.snapshot().view.inTune[0]).toBe(false);
    expect(runner.hasResult()).toBe(false);
    for (let k = 0; k < 6; k++) runner.command('next');
    expect(runner.snapshot().phase).toBe('done');
    expect(runner.finish().complete).toBe(true);
  });
});
