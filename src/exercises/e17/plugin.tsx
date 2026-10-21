import { riffById } from '../../content/riffs';
import {
  countsForCriteria,
  extractMetrics,
  ladderNextBpm,
  type RiffResult,
  riffResultSchema,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { LADDER_STEP_BPM, tempoRetry } from '../e5/runner';
import { SequenceStage } from '../sequence/SequenceStage';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import {
  type E17Params,
  type E17View,
  e17ParamsSchema,
  FLAWLESS_STREAK_UP,
  LOW_MISTAKE_RATIO,
  mistakeRatio,
  RiffRunner,
} from './runner';
import { riffSpelled } from './spell';

function E17ViewComponent({ runner }: { runner: ExerciseRunner<RiffResult, E17View>; params: E17Params }) {
  const { view, phase } = useRunnerSnapshot(runner);
  const t = ko.exercises.e17;
  const spelled = riffSpelled(view.riff);
  return (
    <SequenceStage
      runner={runner}
      title={view.riff.id}
      // The words double as the TAB picture's text alternative (D-080).
      tabLabel={`${t.tabLabel(view.riff.id)}. ${spelled.join('. ')}`}
      testId="e17-view"
      barSize={view.riff.value === 'e' ? 8 : 4}
      words={
        phase === 'ready' && (
          <section className="w-full rounded-2xl bg-surface p-4" data-testid="e17-spelled">
            <h3 className="font-semibold">{t.spelledTitle}</h3>
            <ol className="mt-2 space-y-1 text-lg">
              {spelled.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </section>
        )
      }
      secondary={
        phase === 'ready' && (
          <Button
            large
            variant="secondary"
            onClick={() => runner.command('mark')}
            data-testid="e17-listen"
            data-listening={view.listening}
          >
            {t.listen}
          </Button>
        )
      }
      status={
        phase === 'ready' &&
        view.listening && (
          <p aria-live="polite" className="text-muted">
            {t.listening}
          </p>
        )
      }
    >
      {view.riff.palmMute && <p className="text-lg">{t.palmMute}</p>}
    </SequenceStage>
  );
}

function E17Summary({ result }: { result: RiffResult; params: E17Params }) {
  const flawless = result.cycles.filter((c) => c.flawless).length;
  return (
    <div>
      <p className={RESULT_HEADLINE}>{ko.exercises.e17.summary(result.cycles.length, flawless)}</p>
      <p>{ko.exercises.e17.ladder[result.ladder](ladderNextBpm(result.bpm, result.ladder))}</p>
      {(result.pauses ?? 0) > 0 && <p className="text-muted">{ko.exercises.common.pausedRun}</p>}
    </div>
  );
}

export const e17Plugin: ExercisePlugin<E17Params, RiffResult, E17View> = {
  type: 'E17',
  version: 1,
  titleKey: 'E17',
  paramsSchema: e17ParamsSchema,
  resultSchema: riffResultSchema,
  defaultParams: () => ({ riffId: 'R1', bpm: 60, tabHidden: false, previousLow: false }),
  createRunner: (ctx, params) => new RiffRunner(ctx, params),
  View: E17ViewComponent,
  Summary: E17Summary,
  howTo: (params) => {
    const g = ko.exercises.guide;
    const riff = riffById(params.riffId);
    const eighths = riff.value === 'e';
    return {
      steps: [
        g.E17.left,
        g.E17.right(eighths),
        ...(riff.palmMute ? [ko.exercises.e17.palmMute] : []),
        g.perClick(eighths ? 2 : 1),
        g.E17.cycle,
        g.E17.listen,
        g.E17.judge(FLAWLESS_STREAK_UP, LADDER_STEP_BPM),
      ],
      terms: ['tab', 'fingerNumbers', 'stringNumbers'],
    };
  },
  toMetrics: (result) => extractMetrics('E17', result),
  withHistory: (params, recent) => {
    // A paused run does not count for the ladder (D-085).
    const last = recent.find((r) => r.riffId === params.riffId && countsForCriteria(r));
    return { ...params, previousLow: last !== undefined && mistakeRatio(last.cycles) >= LOW_MISTAKE_RATIO };
  },
  suggestedTempoRetry: (params, result) => tempoRetry(params, ladderNextBpm(result.bpm, result.ladder)),
  usesMicrophone: true,
  // P pauses; a paused run keeps the ladder where it is (D-085).
  pausable: true,
};
