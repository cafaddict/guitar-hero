import { describe, expect, it } from 'vitest';
import { songById } from '../../content/songs';
import { songResultSchema } from '../../domain/exerciseResults';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { expandChart, type SongParams, SongRunner } from './runner';

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe('S practice song', () => {
  it('expands sections with repeats', () => {
    const chart = expandChart(songById('s02'));
    expect(chart).toHaveLength(16);
    expect(chart.slice(0, 5).map((b) => b.chord)).toEqual(['A', 'A', 'D', 'D', 'A']);
    expect(chart[8]!.section).toBe(1);
  });

  it('perform mode: plays the whole song, measures beat 1, then the self-report', async () => {
    const t = testContext();
    const params: SongParams = {
      songId: 's01',
      mode: 'perform',
      bpm: 60,
      chartHidden: true,
      loopSection: null,
    };
    const runner = new SongRunner(
      t.ctx,
      params,
      (chords, bpm, beats) => new Float32Array(chords.length * bpm * beats),
    );
    runner.start();
    expect(runner.snapshot().phase).toBe('armed');
    runner.command('mark');
    expect(t.output.played).toHaveLength(1);
    expect(t.output.played[0]!.length).toBe((4 * 8 * 60 * 4) / 4);
    runner.command('toggle');
    await flush();
    const grid = t.output.metronome.gridStartTime()!;
    const bars = 16;
    const pending = Array.from({ length: bars }, (_, b) => grid + b * 4 + (b === 7 ? 0.2 : 0));
    t.output.run(t.clock, 4 + bars * 4 + 2, () => {
      while (pending.length > 0 && pending[0]! <= t.clock.t - 0.45) {
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
    expect(runner.snapshot().phase).toBe('review');
    expect(runner.snapshot().view.report.completed).toBe(true);
    runner.command('manual2'); // memorized
    runner.command('next');
    const result = runner.finish();
    expect(songResultSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({
      songId: 's01',
      mode: 'perform',
      chartHidden: true,
      completed: true,
      stops: 0,
      memorized: true,
    });
    expect(result.beat1HitRate).toBeCloseTo(15 / 16, 9);
  });

  it('learn mode loops a section until stopped; stopping counts as a stop', async () => {
    const t = testContext();
    const runner = new SongRunner(
      t.ctx,
      { songId: 's02', mode: 'learn', bpm: 60, chartHidden: false, loopSection: 1 },
      () => new Float32Array(1),
    );
    runner.start();
    runner.command('toggle');
    await flush();
    expect(t.output.lastConfig?.stopAfterBars).toBeNull();
    t.output.run(t.clock, 4 + 4 * 6, () => runner.tick());
    const view = runner.snapshot().view;
    expect(view.chart[view.bar!]!.section).toBe(1);
    expect(t.mic.job).toBeNull(); // learn mode does not judge
    runner.command('toggle');
    expect(runner.snapshot().phase).toBe('review');
    runner.command('inc');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ mode: 'learn', completed: false, stops: 2, beat1HitRate: null });
  });

  it('learn mode: Space in the review starts again ("stop and retry"), stops are counted', async () => {
    const t = testContext({ mic: false });
    const runner = new SongRunner(
      t.ctx,
      { songId: 's01', mode: 'learn', bpm: 60, chartHidden: false, loopSection: null },
      () => new Float32Array(1),
    );
    runner.start();
    expect(runner.snapshot().phase).toBe('ready');
    expect(runner.hasResult()).toBe(false);
    runner.command('toggle');
    await flush();
    t.output.run(t.clock, 6, () => runner.tick());
    runner.command('toggle'); // stop
    expect(runner.snapshot().phase).toBe('review');
    runner.command('toggle'); // again
    await flush();
    expect(runner.snapshot().phase).toBe('countIn');
    t.output.run(t.clock, 6, () => runner.tick());
    runner.command('toggle');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ stops: 2, completed: false });
    expect(runner.hasResult()).toBe(true);
  });

  it('perform mode: a failed beat-1 measurement does not block the self-report', async () => {
    const t = testContext();
    t.mic.analyzeTiming = () => Promise.reject(new Error('timeout'));
    const runner = new SongRunner(
      t.ctx,
      { songId: 's01', mode: 'perform', bpm: 120, chartHidden: false, loopSection: null },
      () => new Float32Array(1),
    );
    runner.start();
    runner.command('toggle');
    await flush();
    t.output.run(t.clock, 2 + 16 * 2 + 2, () => runner.tick());
    await flush();
    expect(runner.snapshot().phase).toBe('review');
    expect(runner.snapshot().view.analyzing).toBe(false);
    runner.command('next');
    expect(runner.snapshot().phase).toBe('done');
    expect(runner.finish().beat1HitRate).toBeNull();
  });
});
