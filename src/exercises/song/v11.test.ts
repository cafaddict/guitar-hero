/** SPEC v1.1 §11.10 additions to S: stages, option keys, stops counted from beat 1. */
import { describe, expect, it } from 'vitest';
import { songResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { beat1Stops, SongRunner, songStageOf } from './runner';

describe('S v1.1', () => {
  it('stage = learn / perform / hidden from the mode and the chart setting', () => {
    expect(songStageOf('learn', true)).toBe('learn');
    expect(songStageOf('perform', false)).toBe('perform');
    expect(songStageOf('perform', true)).toBe('hidden');
  });

  it('a stop is every run of two or more bars without a beat-1 strum', () => {
    expect(beat1Stops([true, true, true])).toBe(0);
    expect(beat1Stops([true, false, true])).toBe(0);
    expect(beat1Stops([true, false, false, true])).toBe(1);
    expect(beat1Stops([false, false, false, true, false, false])).toBe(2);
  });

  it('↑/↓ change the tempo before the start, L loops a section (learn), H hides the chart; params record them', () => {
    const t = testContext({ mic: false });
    const runner = new SongRunner(
      t.ctx,
      { songId: 's02', mode: 'learn', bpm: 60, chartHidden: false, loopSection: null },
      () => new Float32Array(1),
    );
    runner.start();
    runner.command('inc');
    runner.command('inc');
    runner.command('dec');
    expect(runner.snapshot().view.bpm).toBe(65);
    runner.command('loop');
    expect(runner.snapshot().view.loopSection).toBe(0);
    runner.command('loop');
    runner.command('loop');
    expect(runner.snapshot().view.loopSection).toBeNull();
    runner.command('hide');
    expect(runner.effectiveParams()).toMatchObject({ bpm: 65, chartHidden: true, loopSection: null });
    // Not below the song's minimum tempo.
    for (let k = 0; k < 20; k++) runner.command('dec');
    expect(runner.snapshot().view.bpm).toBe(40);
  });

  it('results carry the stage and the play-along fields (no backing yet)', () => {
    const t = testContext({ mic: false });
    const runner = new SongRunner(
      t.ctx,
      { songId: 's01', mode: 'perform', bpm: 60, chartHidden: true, loopSection: null },
      () => new Float32Array(1),
    );
    runner.start();
    const result = songResultSchema.parse(runner.finish());
    expect(result).toMatchObject({ stage: 'hidden', backingOn: false, backingAudible: false });
  });

  it('a take counts as hidden only when the chart stayed hidden while playing; H is locked after the take', async () => {
    const t = testContext({ mic: false });
    const runner = new SongRunner(
      t.ctx,
      { songId: 's01', mode: 'perform', bpm: 60, chartHidden: false, loopSection: null },
      () => new Float32Array(1),
    );
    runner.start();
    runner.command('toggle'); // plays with the chart visible
    for (let k = 0; k < 4; k++) await Promise.resolve();
    runner.command('hide'); // hidden half-way
    runner.command('toggle'); // stop → review
    runner.command('hide'); // locked in the review
    expect(runner.effectiveParams().chartHidden).toBe(false);
    expect(runner.finish()).toMatchObject({ chartHidden: false, stage: 'perform' });
  });
});
