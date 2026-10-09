import { describe, expect, it } from 'vitest';
import { extractMetrics, type HammerResult, hammerResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { nextHammerRun } from './plugin';
import { e11ParamsSchema, HammerRunner, hammerLadder } from './runner';

async function play(t: ReturnType<typeof testContext>, runner: HammerRunner, seconds: number) {
  for (let s = 0; s < seconds; s += 0.025) {
    t.output.run(t.clock, 0.025);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
  }
}

describe('E11 hammer-on finger gym (SPEC v1.1 §11.16)', () => {
  it('plans picked + hammer-on eighths from the 5th fret, strings 6 → 1; hammer slots are legato (beta)', async () => {
    const t = testContext();
    const runner = new HammerRunner(t.ctx, e11ParamsSchema.parse({ pair: '1-3', bpm: 60 }));
    runner.start();
    runner.command('toggle');
    await play(t, runner, 12);
    const first = t.mic.sequenceRequests[0]!;
    expect(first.slots.slice(0, 2).map((s) => [s.midi, s.stringIdx, s.legatoAllowed ?? false])).toEqual([
      [45, 0, false], // 6th string, 5th fret (A2), picked with finger 1
      [47, 0, true], // 7th fret (B2), hammered with finger 3
    ]);
    runner.command('toggle');
    await play(t, runner, 2);
    expect(runner.snapshot().view.awaitingRating).toBe(true);
    runner.command('manual3');
    const result = hammerResultSchema.parse(runner.finish());
    expect(result).toMatchObject({ pair: '1-3', evenRating: 3, ladder: 'up', source: 'mic' });
    expect(result.pickedHitRate).toBe(1);
    expect(result.legatoBeta?.heard).toBe(result.legatoBeta?.total);
    expect(extractMetrics('E11', result)).toEqual(
      expect.arrayContaining([{ subjectKey: 'hammer:1-3', metric: 'selfRating', value: 3 }]),
    );
  });

  it('the daily cap (10 min) refuses a new run; ladder needs hit rate ≥ 0.9 and a rating of 3', () => {
    const t = testContext({ mic: false });
    const runner = new HammerRunner(t.ctx, e11ParamsSchema.parse({ minutesToday: 10 }));
    runner.start();
    runner.command('toggle');
    expect(runner.snapshot()).toMatchObject({ phase: 'ready', view: { capped: true } });
    expect(hammerLadder(0.95, 3)).toBe('up');
    expect(hammerLadder(0.85, 3)).toBe('stay');
    expect(hammerLadder(1, 2)).toBe('stay');
  });

  it('the daily cap also ends a run in progress at the minutes left; Esc leaves the rating prompt (review M12)', async () => {
    const t = testContext({ mic: false });
    const runner = new HammerRunner(t.ctx, e11ParamsSchema.parse({ minutesToday: 9 }));
    runner.start();
    runner.command('toggle');
    await Promise.resolve();
    t.output.run(t.clock, 55, () => runner.tick());
    expect(runner.snapshot().phase).not.toBe('review');
    t.output.run(t.clock, 10, () => runner.tick());
    expect(runner.snapshot()).toMatchObject({ phase: 'review', view: { awaitingRating: true } });
    runner.command('abort');
    expect(runner.snapshot().phase).toBe('done');
  });

  it('next run: never-practised pairs first, then the lowest evenness rating', () => {
    const r = (pair: HammerResult['pair'], evenRating: number): HammerResult => ({
      pair,
      bpm: 65,
      cycles: [],
      source: 'self',
      pickedHitRate: null,
      legatoBeta: null,
      evenRating,
      ladder: 'stay',
      durationMs: 60_000,
    });
    const all = (['1-2', '1-3', '1-4', '2-3', '2-4'] as const).map((p) => r(p, 3));
    expect(nextHammerRun(e11ParamsSchema.parse({}), all).pair).toBe('3-4');
    // Results are newest first: the latest rating of 2-4 is 1.
    expect(nextHammerRun(e11ParamsSchema.parse({}), [r('2-4', 1), ...all, r('3-4', 3)]).pair).toBe('2-4');
  });
});
