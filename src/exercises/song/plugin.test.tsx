/**
 * D-082: the hidden stage shows the chart before the start (covered from the count-in on), and the first run at
 * a stage the routine raised says so.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { songResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { testContext } from '../testing/fakes';
import { songPlugin } from './plugin';
import { firstRunAtStage, type SongParamsInput, SongRunner } from './runner';

const params = (over: Partial<SongParamsInput> = {}) =>
  songPlugin.paramsSchema.parse({
    songId: 's03',
    mode: 'perform',
    bpm: 65,
    chartHidden: true,
    loopSection: null,
    ...over,
  });

function render(runner: SongRunner, p: ReturnType<typeof params>): string {
  const t = testContext();
  return renderToStaticMarkup(<songPlugin.View runner={runner} params={p} ctx={t.ctx} />);
}

const result = (over: Record<string, unknown>) =>
  songResultSchema.parse({
    songId: 's03',
    mode: 'perform',
    chartHidden: false,
    bpm: 65,
    completed: true,
    stops: 0,
    memorized: false,
    beat1HitRate: null,
    ...over,
  });

describe('S hidden stage preview (D-082)', () => {
  it('shows the chart while armed, then covers it from the count-in on', () => {
    const t = testContext();
    const p = params();
    const runner = new SongRunner(t.ctx, p, () => new Float32Array(1));
    runner.start();
    expect(runner.snapshot().phase).toBe('armed');
    const before = render(runner, p);
    expect(before).toContain('data-testid="song-hidden-preview"');
    expect(before).toContain('<ol');
    expect(before).not.toContain(ko.exercises.song.hidden);

    runner.command('toggle');
    expect(runner.snapshot().phase).toBe('countIn');
    const playing = render(runner, p);
    expect(playing).not.toContain('<ol');
    expect(playing).toContain(ko.exercises.song.hidden);
    expect(playing).not.toContain('song-hidden-preview');
  });

  it('the preview does not make the take a perform take', () => {
    const t = testContext({ mic: false });
    const runner = new SongRunner(t.ctx, params(), () => new Float32Array(1));
    runner.start();
    runner.command('toggle');
    runner.command('toggle');
    expect(runner.finish()).toMatchObject({ chartHidden: true, stage: 'hidden' });
  });

  it('perform stage: no preview line', () => {
    const t = testContext();
    const p = params({ chartHidden: false });
    const runner = new SongRunner(t.ctx, p, () => new Float32Array(1));
    runner.start();
    expect(render(runner, p)).not.toContain('song-hidden-preview');
  });
});

describe('S first run at a stage (D-082)', () => {
  it('is announced before the start, and dropped when H switches the stage', () => {
    const t = testContext();
    const p = params({ firstAtStage: true });
    const runner = new SongRunner(t.ctx, p, () => new Float32Array(1));
    runner.start();
    expect(render(runner, p)).toContain(ko.exercises.song.stageNew.hidden);
    runner.command('hide');
    expect(render(runner, p)).not.toContain('data-testid="song-stage-new"');
  });

  it('no notice without the flag', () => {
    const t = testContext();
    const p = params();
    const runner = new SongRunner(t.ctx, p, () => new Float32Array(1));
    runner.start();
    expect(render(runner, p)).not.toContain('data-testid="song-stage-new"');
  });

  it('withHistory: first when no recent run of this song is at this stage; learn is never announced', () => {
    const withHistory = songPlugin.withHistory!;
    expect(withHistory(params(), []).firstAtStage).toBe(true);
    expect(withHistory(params({ chartHidden: false }), []).firstAtStage).toBe(true);
    expect(withHistory(params({ mode: 'learn', chartHidden: false }), []).firstAtStage).toBe(false);
    // Earlier perform runs do not count for the hidden stage; another song's hidden run does not either.
    const performed = [
      result({ stage: 'perform' }),
      result({ songId: 's01', chartHidden: true, stage: 'hidden' }),
    ];
    expect(withHistory(params(), performed).firstAtStage).toBe(true);
    expect(withHistory(params({ chartHidden: false }), performed).firstAtStage).toBe(false);
    // A stale flag from stored params is recomputed.
    expect(withHistory(params({ firstAtStage: true }), [result({ chartHidden: true })]).firstAtStage).toBe(
      false,
    );
  });

  it('reads the stage of v1 results (no `stage`) from mode and chartHidden', () => {
    expect(firstRunAtStage('s03', 'hidden', [result({ chartHidden: true })])).toBe(false);
    expect(firstRunAtStage('s03', 'perform', [result({ mode: 'learn' })])).toBe(true);
  });
});

describe('S how-to (D-082)', () => {
  it('describes the hidden stage, preview included', () => {
    expect(songPlugin.howTo(params()).steps).toContain(ko.exercises.guide.S.mode.hidden);
    expect(songPlugin.howTo(params({ chartHidden: false })).steps).toContain(
      ko.exercises.guide.S.mode.perform,
    );
  });
});
