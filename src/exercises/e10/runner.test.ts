import { describe, expect, it } from 'vitest';
import { extractMetrics, type ScaleResult, scaleResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { nextScaleRun } from './plugin';
import { type E10Params, e10ParamsSchema, ScaleRunner } from './runner';

const params = (over: Partial<E10Params> = {}): E10Params =>
  e10ParamsSchema.parse({ scaleId: 'em-pent-open', ...over });

/** Runs the fake clock in 25 ms steps, ticking the runner and letting the fake worker answer. */
async function play(t: ReturnType<typeof testContext>, runner: ScaleRunner, seconds: number) {
  for (let s = 0; s < seconds; s += 0.025) {
    t.output.run(t.clock, 0.025);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe('E10 scale ladder (SPEC v1.1 §11.13)', () => {
  it('with a microphone: cycles are judged in chunks; 4 flawless at 80 BPM graduate the step', async () => {
    const t = testContext();
    const runner = new ScaleRunner(t.ctx, params({ bpm: 80 }));
    runner.start();
    runner.command('toggle');
    // Step 1 of Em pentatonic = 23 notes; 4 cycles at 80 BPM ≈ 69 s (+ count-in).
    await play(t, runner, 75);
    runner.command('toggle');
    await play(t, runner, 2);
    expect(runner.snapshot().phase).toBe('done');
    const result = scaleResultSchema.parse(runner.finish());
    expect(result.cycles.length).toBeGreaterThanOrEqual(4);
    expect(result.cycles.every((c) => c.flawless && c.okRatio === 1)).toBe(true);
    expect(result).toMatchObject({ source: 'mic', graduated: true, ladder: 'up', memorized: false });
    for (const r of t.mic.sequenceRequests) expect(r.to - r.from).toBeLessThanOrEqual(3.2 + 1e-9);
    expect(runner.dspStats().detectorVersion).toBe(DETECTOR_VERSION);
    expect(extractMetrics('E10', result)).toEqual(
      expect.arrayContaining([
        { subjectKey: 'scale:em-pent-open:s1', metric: 'streakBpm', value: 80 },
        { subjectKey: 'scale:em-pent-open:s1', metric: 'ladderBpm', value: 85 },
      ]),
    );
  });

  it('a wrong note breaks the streak and is shown with its position and semitones', async () => {
    const t = testContext();
    let seen = 0;
    t.mic.sequenceResponder = (request) => ({
      notes: request.slots.map((s, i) =>
        ++seen === 5
          ? { slot: i, status: 'WRONG_NOTE', semitones: -1, cents: -100, onsetTime: s.time }
          : { slot: i, status: 'OK', cents: 0, onsetTime: s.time },
      ),
      extras: [],
    });
    const runner = new ScaleRunner(t.ctx, params({ scaleId: 'c-major-open', bpm: 60 }));
    runner.start();
    runner.command('toggle');
    await play(t, runner, 40);
    runner.command('toggle');
    await play(t, runner, 2);
    const result = runner.finish();
    const faulty = result.cycles.find((c) => !c.flawless)!;
    expect(faulty.faults).toEqual([{ index: 4, status: 'WRONG_NOTE', semitones: -1 }]);
    expect(t.mic.sequenceRequests.some((r) => r.slots.length > 1)).toBe(true);
    expect(result.graduated).toBe(false);
  });

  it('without a microphone: self-reported cycles; TAB hidden throughout + 4 flawless at step 1 = memorized', () => {
    const t = testContext({ mic: false });
    const runner = new ScaleRunner(t.ctx, params({ scaleId: 'c-major-open', tabHidden: true }));
    runner.start();
    runner.command('toggle');
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('next');
    const result = runner.finish();
    expect(result).toMatchObject({ source: 'self', memorized: true, hiddenThroughout: true, ladder: 'up' });
    expect(extractMetrics('E10', result)).toEqual(
      expect.arrayContaining([{ subjectKey: 'scale:c-major-open:memorized', metric: 'memorized', value: 1 }]),
    );
  });

  it('showing the TAB while playing (H) means not memorized', () => {
    const t = testContext({ mic: false });
    const runner = new ScaleRunner(t.ctx, params({ scaleId: 'c-major-open', tabHidden: true }));
    runner.start();
    runner.command('toggle');
    runner.command('hide');
    runner.command('hide');
    for (let i = 0; i < 4; i++) runner.command('manual1');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ memorized: false, hiddenThroughout: false });
  });

  it('backing on speakers (§8.6): judged as reference only — no graduation, no metrics, no ladder move; E = earphones', async () => {
    const backing = () => ({ signal: new Float32Array(16), events: [] });
    const speakers = testContext();
    const runner = new ScaleRunner(speakers.ctx, params({ bpm: 80, withBacking: true }), backing);
    runner.start();
    expect(runner.snapshot().view).toMatchObject({ earphones: false, backingAudible: true });
    runner.command('toggle');
    await play(speakers, runner, 75);
    runner.command('toggle');
    await play(speakers, runner, 2);
    const reference = scaleResultSchema.parse(runner.finish());
    expect(reference.cycles.filter((c) => c.flawless).length).toBeGreaterThanOrEqual(4);
    expect(reference).toMatchObject({ backingAudible: true, graduated: false, ladder: 'stay' });
    expect(extractMetrics('E10', reference)).toEqual([]);
    expect(nextScaleRun(params({ bpm: 70 }), [reference])).toEqual(nextScaleRun(params({ bpm: 70 }), []));

    const earphones = testContext();
    const confirmed = new ScaleRunner(earphones.ctx, params({ bpm: 80, withBacking: true }), backing);
    confirmed.start();
    confirmed.command('ear');
    expect(confirmed.snapshot().view).toMatchObject({ earphones: true, backingAudible: false });
    expect(confirmed.effectiveParams().earphones).toBe(true);
    confirmed.command('toggle');
    await play(earphones, confirmed, 75);
    confirmed.command('toggle');
    await play(earphones, confirmed, 2);
    expect(confirmed.finish()).toMatchObject({ backingAudible: false, graduated: true });
  });

  it('next run: graduated → next step at 60; otherwise the ladder tempo; review plays the step under review at 80', () => {
    const base = (over: Partial<ScaleResult>): ScaleResult => ({
      scaleId: 'em-pent-open',
      step: 1,
      bpm: 70,
      tabHidden: false,
      hiddenThroughout: false,
      withBacking: false,
      cycles: [],
      ladder: 'stay',
      graduated: false,
      memorized: false,
      source: 'self',
      ...over,
    });
    expect(nextScaleRun(params(), [])).toMatchObject({ step: 1, bpm: 60 });
    expect(nextScaleRun(params(), [base({ bpm: 80, graduated: true, ladder: 'up' })])).toMatchObject({
      step: 2,
      bpm: 60,
    });
    expect(nextScaleRun(params(), [base({ bpm: 70, ladder: 'up' })])).toMatchObject({ step: 1, bpm: 75 });
    expect(
      nextScaleRun(params({ review: true, step: 1 }), [
        base({ step: 2, graduated: true }),
        base({ step: 1, graduated: true }),
      ]),
    ).toMatchObject({ step: 1, bpm: 80 });
  });
});
