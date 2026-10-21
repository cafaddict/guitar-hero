import { describe, expect, it } from 'vitest';
import { extractMetrics, riffResultSchema } from '../../domain/exerciseResults';
import { flawlessStreak } from '../sequence/runner';
import { testContext } from '../testing/fakes';
import { e17Plugin } from './plugin';
import { mistakeRatio, RiffRunner, sequenceLadder } from './runner';

const cycle = (flawless: boolean, uncertain = false) => ({ flawless, uncertain, stops: 0, okRatio: null });

describe('E17 single-note riff (SPEC v1.1 §11.19)', () => {
  it('ladder: 4 flawless cycles in a row → up; anything else stays, never down (D-098)', () => {
    expect(sequenceLadder([true, true, false, true, true, true, true].map((f) => cycle(f)))).toBe('up');
    expect(sequenceLadder([true, true, true].map((f) => cycle(f)))).toBe('stay');
    // An uncertain cycle neither counts nor breaks the streak (§10.10-4).
    expect(sequenceLadder([cycle(true), cycle(true), cycle(false, true), cycle(true), cycle(true)])).toBe(
      'up',
    );
    expect(sequenceLadder([false, false, true].map((f) => cycle(f)))).toBe('stay');
    expect(sequenceLadder([false, false, false].map((f) => cycle(f)))).toBe('stay');
    expect(
      sequenceLadder(
        [true, true, true].map((f) => cycle(f)),
        3,
      ),
    ).toBe('up');
    expect(mistakeRatio([cycle(false), cycle(true)])).toBe(0.5);
    // The streak starts over at the cycle after a pause (D-085).
    const resumed = { ...cycle(true), resumed: true };
    expect(sequenceLadder([cycle(true), cycle(true), resumed, cycle(true)])).toBe('stay');
    expect(sequenceLadder([cycle(true), resumed, cycle(true), cycle(true), cycle(true)])).toBe('up');
    // The live streak counter too.
    expect(flawlessStreak([cycle(true), cycle(true), cycle(true)])).toBe(3);
    expect(flawlessStreak([cycle(true), cycle(true), resumed, cycle(true)])).toBe(2);
    expect(flawlessStreak([cycle(true), resumed])).toBe(1);
    expect(flawlessStreak([cycle(true), resumed, cycle(false, true)])).toBe(1);
  });

  it('E17 has no history adjustment: the tempo is the one the run was started with (D-098)', () => {
    expect(e17Plugin.withHistory).toBeUndefined();
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

  it('with a microphone (§10.10): R3 eighths are judged per pass; a wrong note is a mistake, 4 clean passes step up', async () => {
    const t = testContext();
    let seen = 0;
    t.mic.sequenceResponder = (request) => ({
      notes: request.slots.map((s, i) =>
        ++seen === 3
          ? { slot: i, status: 'WRONG_NOTE', semitones: 2, cents: 200, onsetTime: s.time }
          : { slot: i, status: 'OK', cents: 0, onsetTime: s.time },
      ),
      extras: [],
    });
    const runner = new RiffRunner(t.ctx, { riffId: 'R3', bpm: 70, tabHidden: false, previousLow: false });
    runner.start();
    runner.command('toggle');
    // R3 = 16 eighths = 2 bars ≈ 6.9 s per pass at 70 BPM; five passes + count-in.
    for (let s = 0; s < 40; s += 0.025) {
      t.output.run(t.clock, 0.025);
      runner.tick();
      await Promise.resolve();
      await Promise.resolve();
    }
    runner.command('toggle');
    for (let s = 0; s < 2; s += 0.025) {
      t.output.run(t.clock, 0.025);
      runner.tick();
      await Promise.resolve();
    }
    const result = riffResultSchema.parse(runner.finish());
    expect(result.source).toBe('mic');
    expect(result.cycles[0]).toMatchObject({
      flawless: false,
      faults: [{ index: 2, status: 'WRONG_NOTE', semitones: 2 }],
    });
    expect(result.cycles.slice(1, 5).every((c) => c.flawless)).toBe(true);
    expect(result.ladder).toBe('up');
    for (const r of t.mic.sequenceRequests) expect(r.to - r.from).toBeLessThanOrEqual(3.2 + 1e-9);
    expect(
      t.mic.sequenceRequests
        .flatMap((r) => r.slots)
        .slice(0, 16)
        .map((s) => s.midi),
    ).toEqual([40, 43, 45, 47, 50, 52, 47, 45, 40, 43, 45, 47, 52, 50, 43, 40]);
  });

  it('"들어 보기" (M) plays one pass before the run; starting stops it so the microphone never hears it (D-080)', async () => {
    const { ctx, output, clock } = testContext({ mic: false });
    const runner = new RiffRunner(ctx, { riffId: 'R1', bpm: 60, tabHidden: false, previousLow: false });
    runner.start();
    runner.command('mark');
    expect(output.played).toHaveLength(1);
    // R1: 16 quarter notes at 60 BPM + 1 s to ring out.
    expect(output.played[0]!.length / output.sampleRate()).toBeCloseTo(17, 1);
    expect(runner.snapshot().view.listening).toBe(true);
    runner.command('toggle');
    expect(output.stoppedPlays).toEqual([0]);
    expect(runner.snapshot().view.listening).toBe(false);
    expect(output.lastConfig?.bpm).toBe(60);
    // While running, M does not play the demo.
    output.run(clock, 2);
    runner.command('mark');
    expect(output.played).toHaveLength(1);
    runner.dispose();
  });

  it('the demo ends by itself after its length', () => {
    const { ctx, output, clock } = testContext({ mic: false });
    const runner = new RiffRunner(ctx, { riffId: 'R1', bpm: 120, tabHidden: false, previousLow: false });
    runner.start();
    runner.command('mark');
    output.run(clock, 8, () => runner.tick());
    expect(runner.snapshot().view.listening).toBe(true);
    output.run(clock, 2, () => runner.tick());
    expect(runner.snapshot().view.listening).toBe(false);
    runner.dispose();
  });

  it('↑/↓ in ready pick the tempo (D-098); a pick stops the demo, the next demo plays at the new tempo', () => {
    const { ctx, output } = testContext({ mic: false });
    const runner = new RiffRunner(ctx, { riffId: 'R1', bpm: 60, tabHidden: false, previousLow: false });
    runner.start();
    runner.command('mark');
    expect(runner.snapshot().view.listening).toBe(true);
    runner.command('inc');
    expect(output.stoppedPlays).toEqual([0]);
    expect(runner.snapshot().view).toMatchObject({ listening: false, bpm: 65, tempoPickable: true });
    runner.command('mark');
    // R1: 16 quarter notes at 65 BPM + 1 s to ring out.
    expect(output.played[1]!.length / output.sampleRate()).toBeCloseTo((16 * 60) / 65 + 1, 1);
    runner.command('toggle');
    expect(output.lastConfig?.bpm).toBe(65);
    runner.command('manual1');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ bpm: 65 });
    expect(runner.effectiveParams().bpm).toBe(65);
    runner.dispose();
  });
});
