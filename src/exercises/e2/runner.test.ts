import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { changesPerMinute, oneMinuteResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { type E2Params, OneMinuteRunner } from './runner';

function setup(params: Partial<E2Params> = {}, options: { mic?: boolean } = {}) {
  const t = testContext({ mic: options.mic ?? true });
  const runner = new OneMinuteRunner(
    t.ctx,
    { from: 'A', to: 'D', durationMs: 60_000, countMode: 'auto', ...params },
    voicingById,
  );
  runner.start();
  /** A strum at the current time classified as `winner`; its judgement arrives 0.45 s later. */
  const strum = (winner: 0 | 1 | null) => {
    const at = t.clock.t;
    t.mic.coarse.emit(at + 0.03);
    t.clock.advance(0.45);
    t.mic.judged.emit({
      time: at,
      result: { winner, margin: 5, distractorWins: false },
      jobKind: 'pair',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 3,
    });
    runner.tick();
  };
  return { ...t, runner, strum, view: () => runner.snapshot().view };
}

describe('E2 one-minute changes', () => {
  it('waits armed, starts on the first strum and counts arrivals (first A strum not counted)', () => {
    const { runner, mic, strum, clock, view } = setup();
    expect(runner.snapshot().phase).toBe('armed');
    expect(mic.job).toMatchObject({ kind: 'pair' });
    expect((mic.job as { voicings: { id: string }[] }).voicings.map((v) => v.id)).toEqual(['A', 'D']);
    strum(0); // A: starts the timer, not a change
    expect(runner.snapshot().phase).toBe('running');
    expect(view().count).toBe(0);
    for (let k = 0; k < 20; k++) {
      clock.advance(0.55);
      strum(k % 2 === 0 ? 1 : 0);
    }
    expect(view().count).toBe(20);
    expect(view().nextChord).toBe('D');
    strum(null); // low confidence: held, not counted
    expect(view().lowConfidence).toBe(1);
    clock.advance(60);
    runner.tick();
    expect(runner.snapshot().phase).toBe('review');
    runner.command('next');
    expect(runner.snapshot().phase).toBe('done');
    const result = runner.finish();
    expect(oneMinuteResultSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      pair: 'A|D',
      direction: 'A>D',
      countMode: 'auto',
      detectedChanges: 20,
      correctedChanges: null,
      tapChanges: null,
      lowConfidenceEvents: 1,
    });
    expect(result.changeTimestampsMs).toHaveLength(20);
    // Timer starts at the coarse onset (30 ms after the first strum here); the first change came 1 s later.
    expect(result.changeTimestampsMs[0]).toBeCloseTo(970, 6);
    expect(runner.dspStats().events).toBe(22);
  });

  it('↑ twice and ↓ once correct the count; detected and corrected are both stored', () => {
    const { runner, strum, clock } = setup();
    strum(0);
    for (let k = 0; k < 6; k++) {
      clock.advance(0.55);
      strum(k % 2 === 0 ? 1 : 0);
    }
    runner.command('inc');
    runner.command('inc');
    runner.command('dec');
    expect(runner.snapshot().view.count).toBe(7);
    clock.advance(61);
    runner.tick();
    runner.command('next');
    expect(runner.finish()).toMatchObject({ detectedChanges: 6, correctedChanges: 7 });
    expect(changesPerMinute(runner.finish())).toBeCloseTo(7, 9);
  });

  it('a change needs the other chord and ≥ 300 ms since the last change', () => {
    const { strum, clock, view } = setup();
    strum(0);
    clock.advance(0.5);
    strum(0); // same chord again
    strum(1);
    strum(0); // only 0.45 s after the previous change: still counts (≥ 300 ms)
    expect(view().count).toBe(2);
  });

  it('judgements of strums before the start or after the end are ignored', () => {
    const { runner, mic, strum, clock, view } = setup();
    mic.judged.emit({
      time: clock.t - 2,
      result: { winner: 1 },
      jobKind: 'pair',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 1,
    });
    strum(0);
    clock.advance(60);
    runner.tick();
    expect(runner.snapshot().phase).toBe('review');
    // Strummed just before the end, judged during review → counts.
    mic.judged.emit({
      time: clock.t - 0.2,
      result: { winner: 1 },
      jobKind: 'pair',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 1,
    });
    expect(view().count).toBe(1);
    clock.advance(1);
    runner.tick();
    mic.judged.emit({
      time: clock.t - 0.1,
      result: { winner: 0 },
      jobKind: 'pair',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 1,
    });
    expect(view().count).toBe(1);
  });

  it('Space starts the timer as well', () => {
    const { runner } = setup();
    runner.command('toggle');
    expect(runner.snapshot().phase).toBe('running');
  });

  it('tap mode: Enter/pedal adds one per change, corrections apply to the tap count', () => {
    const { runner, clock, mic } = setup({ countMode: 'tap' });
    expect(mic.job).toBeNull();
    runner.command('toggle');
    for (let k = 0; k < 9; k++) runner.command('next');
    runner.command('dec');
    clock.advance(61);
    runner.tick();
    runner.command('next');
    expect(runner.finish()).toMatchObject({
      countMode: 'tap',
      tapChanges: 9,
      correctedChanges: 8,
      detectedChanges: 0,
    });
  });

  it('without a microphone auto falls back to tap; manual mode takes the count in review', () => {
    const noMic = setup({ countMode: 'auto' }, { mic: false });
    expect(noMic.runner.snapshot().phase).toBe('ready');
    expect(noMic.view().countMode).toBe('tap');
    const manual = setup({ countMode: 'manual' }, { mic: false });
    manual.runner.command('toggle');
    manual.clock.advance(61);
    manual.runner.tick();
    for (let k = 0; k < 12; k++) manual.runner.command('inc');
    manual.runner.command('next');
    expect(manual.runner.finish()).toMatchObject({
      countMode: 'manual',
      correctedChanges: 12,
      detectedChanges: 0,
    });
  });

  it('stopping early records the real played time; stopping before the start records nothing', () => {
    const { runner, clock } = setup({ countMode: 'tap' }, { mic: false });
    expect(runner.hasResult()).toBe(false);
    runner.command('toggle');
    clock.advance(15);
    for (let k = 0; k < 5; k++) runner.command('next');
    runner.command('abort');
    clock.advance(30); // time after the abort does not count
    expect(runner.hasResult()).toBe(true);
    const result = runner.finish();
    expect(result.durationMs).toBe(15_000);
    expect(changesPerMinute(result)).toBeCloseTo(20, 9);
    const brief = setup({ countMode: 'tap' }, { mic: false });
    brief.runner.command('toggle');
    brief.clock.advance(2);
    brief.runner.command('abort');
    expect(brief.runner.hasResult()).toBe(false);
  });

  it('plays the end cue when the minute is over', () => {
    const { runner, clock, output } = setup({ countMode: 'tap' }, { mic: false });
    runner.command('toggle');
    clock.advance(61);
    runner.tick();
    expect(output.cues).toEqual(['end']);
    expect(runner.finish().durationMs).toBe(60_000);
  });
});
