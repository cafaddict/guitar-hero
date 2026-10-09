import { extractMetrics, type PinkyResult, pinkyResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { TimedSelfReport } from '../ui/TimedSelfReport';
import { type E12Params, type E12View, e12ParamsSchema, PinkyRunner } from './runner';

function E12ViewComponent({ runner }: { runner: ExerciseRunner<PinkyResult, E12View>; params: E12Params }) {
  const { view, phase, remainingMs } = useRunnerSnapshot(runner);
  const t = ko.exercises.e12;
  const body = (
    <>
      <p>{t.how}</p>
      <p className="text-sm text-muted">{t.notSpeed}</p>
      <p role="note" className="rounded-lg bg-surface p-3 text-retry" data-testid="pinky-notice">
        {t.safety}
      </p>
    </>
  );
  if (phase === 'review' && view.question === 'clarity')
    return (
      <div className="flex flex-col gap-4" data-testid="e12-view" data-phase={phase}>
        {body}
        <div aria-live="polite" data-testid="e12-clarity">
          <p>{t.clarityPrompt}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
              <Button key={cmd} large variant="secondary" onClick={() => runner.command(cmd)}>
                {t.clarity[k + 1]}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  return (
    <TimedSelfReport
      testId="e12-view"
      phase={phase}
      remainingMs={remainingMs}
      startLabel={ko.exercises.e7.start}
      stopLabel={t.stop}
      reviewPrompt={ko.exercises.e7.painPrompt}
      value={ko.exercises.e7.pain(view.pain)}
      confirmLabel={ko.exercises.e7.confirm}
      onCommand={(cmd) => runner.command(cmd)}
    >
      {body}
    </TimedSelfReport>
  );
}

function E12Summary({ result }: { result: PinkyResult; params: E12Params }) {
  const t = ko.exercises.e12;
  return (
    <p className="text-xl font-bold" data-testid="e12-summary">
      {result.clarity !== null && t.clarity[result.clarity]}
      {result.pain !== null && ` · ${ko.exercises.e7.pain(result.pain)}`}
    </p>
  );
}

export const e12Plugin: ExercisePlugin<E12Params, PinkyResult, E12View> = {
  type: 'E12',
  version: 1,
  titleKey: 'E12',
  paramsSchema: e12ParamsSchema,
  resultSchema: pinkyResultSchema,
  defaultParams: () => e12ParamsSchema.parse({}),
  createRunner: (ctx, params) => new PinkyRunner(ctx, params),
  View: E12ViewComponent,
  Summary: E12Summary,
  toMetrics: (result) => extractMetrics('E12', result),
  usesMicrophone: false,
};
