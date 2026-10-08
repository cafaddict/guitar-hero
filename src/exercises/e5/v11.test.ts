/** SPEC v1.1 §11.6 additions to E5: V key, count-aloud beats, dynamics mode, corrected ladder. */
import { describe, expect, it } from 'vitest';
import { strumResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { type E5Params, StrumLadderRunner } from './runner';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

function make(params: Partial<E5Params> = {}, mic = false) {
  const t = testContext({ mic });
  const runner = new StrumLadderRunner(t.ctx, {
    patternId: 'P0',
    bpm: 60,
    bars: 8,
    mode: 'mute',
    chords: [],
    cuesHidden: false,
    previousLow: false,
    ...params,
  });
  runner.start();
  return { ...t, runner };
}

describe('E5 v1.1', () => {
  it('V toggles the visual cues before and during the run; the Attempt params record it', async () => {
    const { runner, output, clock } = make();
    runner.command('cues');
    expect(runner.snapshot().view.cuesHidden).toBe(true);
    runner.command('toggle');
    await flush();
    output.run(clock, 2, () => runner.tick());
    runner.command('cues');
    runner.command('cues');
    expect(runner.effectiveParams().cuesHidden).toBe(true);
    output.run(clock, 40, () => runner.tick());
    runner.command('manual1');
    expect(runner.finish().cuesHidden).toBe(true);
  });

  it('shows the beat number to count aloud, the count-in included', async () => {
    const { runner, output, clock } = make();
    runner.command('toggle');
    await flush();
    const beats = new Set<number | null>();
    output.run(clock, 12, () => {
      runner.tick();
      beats.add(runner.snapshot().view.beat);
    });
    expect([...beats].filter((b) => b !== null).sort()).toEqual([1, 2, 3, 4]);
    expect(runner.snapshot().view.beatsPerBar).toBe(4);
  });

  it('dynamics mode: bars 1–4 soft, 5–8 loud, then a self evaluation stored with the result', async () => {
    const { runner, output, clock } = make({ dynamics: true });
    runner.command('toggle');
    await flush();
    const softness: (boolean | null)[] = [];
    output.run(clock, 40, () => {
      runner.tick();
      softness.push(runner.snapshot().view.soft);
    });
    expect(softness).toContain(true);
    expect(softness).toContain(false);
    runner.command('manual1'); // the hit-rate self rating
    expect(runner.snapshot().view.awaitingDynamics).toBe(true);
    expect(runner.snapshot().phase).toBe('review');
    runner.command('manual2'); // the dynamics rating
    expect(runner.snapshot().phase).toBe('done');
    const result = strumResultSchema.parse(runner.finish());
    expect(result.dynamics).toEqual({ selfRating: 2 });
  });

  it('the ladder and passes use the personal-lead-corrected hit rate (§7.1, §11.6)', () => {
    // A rate that misses 90 % raw but passes once a stable lead is corrected.
    const { runner } = make();
    const r = runner as unknown as { analysis: unknown; phase: string };
    r.analysis = {
      hits: 29,
      misses: 0,
      extras: 0,
      hitRate: 0.85,
      hitRateCorrected: 0.95,
      meanOffsetMs: -40,
      sdOffsetMs: 10,
    };
    const result = runner.finish();
    expect(result.ladder).toBe('up');
    expect(result.passed).toBe(true);
  });

  it('the run is "cues hidden" only when they stayed hidden while the bars ran (§7.6-4)', async () => {
    const { runner, output, clock } = make();
    runner.command('toggle');
    await flush();
    output.run(clock, 6, () => runner.tick()); // bars running with cues visible
    runner.command('cues'); // hidden late
    output.run(clock, 40, () => runner.tick());
    runner.command('manual1');
    expect(runner.finish().cuesHidden).toBe(false);
  });
});
