/** The −5/+5 tempo steppers (D-098): shown while a ladder run waits to start, gone once it runs or is locked. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NATIVE_KEYS_ATTR } from '../../app/keys';
import { ko } from '../../i18n/ko';
import { e5Plugin } from '../e5/plugin';
import { type E5Params, StrumLadderRunner } from '../e5/runner';
import { e11Plugin } from '../e11/plugin';
import { e11ParamsSchema, HammerRunner } from '../e11/runner';
import { e17Plugin } from '../e17/plugin';
import { type E17Params, RiffRunner } from '../e17/runner';
import { testContext } from '../testing/fakes';

const E5: E5Params = {
  patternId: 'P3',
  bpm: 80,
  bars: 8,
  mode: 'single',
  chords: ['C'],
  cuesHidden: false,
  previousLow: false,
};
const E17: E17Params = { riffId: 'R1', bpm: 60, tabHidden: false, previousLow: false };

function e5Html(params: E5Params) {
  const t = testContext();
  const runner = new StrumLadderRunner(t.ctx, params);
  runner.start();
  const html = () => renderToStaticMarkup(<e5Plugin.View runner={runner} params={params} ctx={t.ctx} />);
  return { runner, html };
}

describe('TempoPick (D-098)', () => {
  it('E5 armed: −5/+5 outside the next step, keys kept native, the note says how; gone after the start', () => {
    const { runner, html } = e5Html(E5);
    const armed = html();
    expect(armed).toContain('data-testid="tempo-pick"');
    expect(armed).toContain(`aria-label="${ko.metronome.decrease(5)}"`);
    expect(armed).toContain(`aria-label="${ko.metronome.increase(5)}"`);
    expect(armed).toContain(NATIVE_KEYS_ATTR);
    expect(armed).toContain(ko.exercises.common.tempoPickNote);
    // The steppers sit after the action bar, not inside the next step.
    const primary = armed.slice(armed.indexOf('data-primary-action'));
    expect(primary.indexOf('tempo-pick')).toBeGreaterThan(primary.indexOf('</div>'));
    runner.command('toggle');
    expect(html()).not.toContain('tempo-pick');
    expect(html()).not.toContain(ko.exercises.common.tempoPickNote);
  });

  it('E5 with the tempo locked (exam) shows no steppers and no tempo how-to step', () => {
    const { html } = e5Html({ ...E5, tempoLocked: true });
    expect(html()).not.toContain('tempo-pick');
    expect(e5Plugin.howTo({ ...E5, tempoLocked: true })?.steps).not.toContain(ko.exercises.guide.tempoPick);
    expect(e5Plugin.howTo(E5)?.steps).toContain(ko.exercises.guide.tempoPick);
  });

  it('sequence stage: E17 ready shows them in place of the run tools; E11 keeps its tempo', () => {
    const t = testContext({ mic: false });
    const riff = new RiffRunner(t.ctx, E17);
    riff.start();
    const ready = renderToStaticMarkup(<e17Plugin.View runner={riff} params={E17} ctx={t.ctx} />);
    expect(ready).toContain('data-testid="tempo-pick"');
    expect(ready).not.toContain('seq-finish');
    riff.command('toggle');
    const running = renderToStaticMarkup(<e17Plugin.View runner={riff} params={E17} ctx={t.ctx} />);
    expect(running).not.toContain('tempo-pick');

    const params = e11ParamsSchema.parse({ pair: '1-3', bpm: 60 });
    const hammer = new HammerRunner(t.ctx, params);
    hammer.start();
    const e11 = renderToStaticMarkup(<e11Plugin.View runner={hammer} params={params} ctx={t.ctx} />);
    expect(e11).not.toContain('tempo-pick');
  });
});
