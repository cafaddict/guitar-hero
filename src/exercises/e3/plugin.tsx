import { voicingById, voicingForClass } from '../../content/voicings';
import {
  extractMetrics,
  PFC_CLEAN_PER_MIN,
  PFC_CLEAN_RATE,
  type PfcResult,
  pfcResultSchema,
  pfcScores,
} from '../../domain/exerciseResults';
import { pairsAmong, parsePairId } from '../../domain/pairs';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { BigTimer } from '../ui/BigTimer';
import { useRunnerSnapshot } from '../ui/hooks';
import { type E3Params, type E3View, e3ParamsSchema, PfcRunner } from './runner';

function E3ViewComponent({
  runner,
  ctx,
}: {
  runner: ExerciseRunner<PfcResult, E3View>;
  params: E3Params;
  ctx: ExerciseContext;
}) {
  const { view, phase, remainingMs } = useRunnerSnapshot(runner);
  const t = ko.exercises.e3;
  const next = voicingById(voicingForClass(view.nextChord, ctx.content.gVoicing));
  const waiting = phase === 'ready' || phase === 'armed';
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="e3-view" data-phase={phase}>
      <div className="flex flex-col items-center gap-2">
        <ChordDiagram voicing={next} leftHanded={ctx.settings.leftHanded} />
        <p className="text-lg">{ko.exercises.e2.next(view.nextChord)}</p>
      </div>
      <div className="flex flex-col gap-3">
        <BigTimer remainingMs={remainingMs} />
        <p className="text-2xl font-bold tabular-nums" data-testid="e3-count" data-arrivals={view.arrivals}>
          {t.arrivals(view.arrivals, view.clean)}
        </p>
        <p>{t.how}</p>
        <p className="text-sm text-muted">{t.normal}</p>
        {view.source === 'mic' && view.lastStrumBeta && (
          <p className="text-sm" data-testid="e3-beta" data-beta="true">
            {t.strumBeta(t.verdict[view.lastStrumBeta] ?? '')}
          </p>
        )}
        {view.source === 'mic' && view.arrivals > 0 && view.lastMark === null && phase === 'running' && (
          <p aria-live="polite">{t.unmarked}</p>
        )}
        <p aria-live="polite" className="min-h-6">
          {waiting && (phase === 'armed' ? ko.exercises.e2.armed(view.from) : ko.exercises.e2.ready)}
          {phase === 'review' && t.review}
        </p>
        <div className="flex flex-wrap gap-2">
          {waiting && (
            <Button large onClick={() => runner.command('toggle')}>
              {ko.exercises.e2.start}
            </Button>
          )}
          {phase === 'running' && (
            <>
              <Button large onClick={() => runner.command('next')} data-testid="e3-clean">
                {t.clean}
              </Button>
              <Button
                large
                variant="secondary"
                onClick={() => runner.command('dec')}
                data-testid="e3-unclean"
              >
                {t.unclean}
              </Button>
            </>
          )}
          {phase === 'review' && (
            <Button large onClick={() => runner.command('next')}>
              {ko.exercises.e2.confirm}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function E3Summary({ result }: { result: PfcResult; params: E3Params }) {
  const t = ko.exercises.e3;
  const s = pfcScores(result);
  return (
    <div data-testid="e3-summary" data-passed={s.passed}>
      <p className="text-xl font-bold">{t.score(s.cleanPerMin, s.cleanRate)}</p>
      <p>{s.passed ? t.passed : t.notYet}</p>
      <p className="text-sm text-muted">{t.normal}</p>
    </div>
  );
}

export const e3Plugin: ExercisePlugin<E3Params, PfcResult, E3View> = {
  type: 'E3',
  version: 1,
  titleKey: 'E3',
  paramsSchema: e3ParamsSchema,
  resultSchema: pfcResultSchema,
  defaultParams: (content) => {
    const [from, to] = parsePairId(pairsAmong(content.unlockedChordClasses)[0] ?? 'A|D');
    return { from, to, durationMs: 60_000 };
  },
  createRunner: (ctx, params) => new PfcRunner(ctx, params, voicingById),
  View: E3ViewComponent,
  Summary: E3Summary,
  howTo: () => {
    const g = ko.exercises.guide.E3;
    return {
      steps: [g.start, g.check, g.mark, g.pass(Math.round(PFC_CLEAN_RATE * 100), PFC_CLEAN_PER_MIN)],
      terms: ['mutedBuzz'],
    };
  },
  toMetrics: (result) => extractMetrics('E3', result),
  usesMicrophone: true,
};
