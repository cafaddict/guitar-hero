import { extractMetrics, type StretchResult, stretchResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { TimedSelfReport } from '../ui/TimedSelfReport';
import { type E7Params, type E7View, e7ParamsSchema, StretchRunner } from './runner';

function E7ViewComponent({ runner }: { runner: ExerciseRunner<StretchResult, E7View>; params: E7Params }) {
  const { view, phase, remainingMs } = useRunnerSnapshot(runner);
  return (
    <TimedSelfReport
      testId="e7-view"
      phase={phase}
      remainingMs={remainingMs}
      startLabel={ko.exercises.e7.start}
      stopLabel={ko.exercises.e7.stop}
      reviewPrompt={ko.exercises.e7.painPrompt}
      value={ko.exercises.e7.pain(view.pain)}
      confirmLabel={ko.exercises.e7.confirm}
      onCommand={(cmd) => runner.command(cmd)}
    >
      <p className="text-3xl font-bold">{ko.exercises.e7.startFret(view.startFret)}</p>
      <p>{ko.exercises.e7.how}</p>
      <p role="note" className="rounded-lg bg-surface p-3 text-retry" data-testid="stretch-notice">
        {ko.safety.stretchNotice}
      </p>
    </TimedSelfReport>
  );
}

function E7Summary({ result }: { result: StretchResult; params: E7Params }) {
  return (
    <p className="text-xl font-bold">
      {ko.exercises.e7.startFret(result.startFret)}
      {result.pain !== null && ` · ${ko.exercises.e7.pain(result.pain)}`}
    </p>
  );
}

export const e7Plugin: ExercisePlugin<E7Params, StretchResult, E7View> = {
  type: 'E7',
  version: 1,
  titleKey: 'E7',
  paramsSchema: e7ParamsSchema,
  resultSchema: stretchResultSchema,
  defaultParams: () => ({ startFret: 5, durationMs: 60_000 }),
  createRunner: (ctx, params) => new StretchRunner(ctx, params),
  View: E7ViewComponent,
  Summary: E7Summary,
  howTo: (params) => ({
    steps: [ko.exercises.e7.startFret(params.startFret), ko.exercises.e7.how, ko.exercises.guide.E7.report],
    terms: ['fingerNumbers'],
  }),
  toMetrics: (result) => extractMetrics('E7', result),
  usesMicrophone: false,
};
