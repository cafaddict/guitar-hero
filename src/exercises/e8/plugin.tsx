import { type AltPickResult, altPickResultSchema, extractMetrics } from '../../domain/exerciseResults';
import { stringNumber } from '../../domain/strings';
import { ko } from '../../i18n/ko';
import { nextBpmFor, tempoRetry } from '../e5/runner';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import { LiveBars } from '../ui/LiveBars';
import { SelfRating } from '../ui/SelfRating';
import { AltPickRunner, type E8Params, type E8View, e8ParamsSchema } from './runner';

function E8ViewComponent({
  runner,
  ctx,
}: {
  runner: ExerciseRunner<AltPickResult, E8View>;
  params: E8Params;
  ctx: ExerciseContext;
}) {
  const { view, phase } = useRunnerSnapshot(runner);
  const live = ctx.audio !== null && phase !== 'done';
  return (
    <div className="flex flex-col gap-4" data-testid="e8-view" data-phase={phase}>
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-bold tabular-nums">{view.bpm} BPM</p>
        <p className="text-lg">
          {phase === 'countIn'
            ? ko.exercises.e5.countIn
            : view.bar !== null
              ? ko.exercises.e5.bar(view.bar + 1, view.bars)
              : ''}
        </p>
      </div>
      <p className="text-2xl font-semibold">{ko.exercises.e8.how(stringNumber(view.stringIdx))}</p>
      {live && <LiveBars bars={view.bars} live={view.liveBars} current={view.bar} kind="counts" />}
      <div aria-live="polite">
        {view.analyzing && <p>{ko.exercises.e5.analyzing}</p>}
        {view.awaitingSelf && (
          <SelfRating
            prompt={ko.exercises.e8.selfPrompt}
            labels={ko.exercises.e8.self}
            onPick={(cmd) => runner.command(cmd)}
          />
        )}
      </div>
    </div>
  );
}

function E8Summary({ result }: { result: AltPickResult; params: E8Params }) {
  return (
    <div data-testid="e8-summary">
      <p className="text-xl font-bold">{ko.exercises.e8.hitRate(result.hitRate)}</p>
      {result.ioiCv !== null && <p>{ko.exercises.e8.evenness(result.ioiCv)}</p>}
      <p className="mt-2 font-semibold">
        {result.passed ? ko.exercises.e8.passed(nextBpmFor(result.bpm, 'up')) : ko.exercises.e8.notYet}
      </p>
    </div>
  );
}

export const e8Plugin: ExercisePlugin<E8Params, AltPickResult, E8View> = {
  type: 'E8',
  version: 1,
  titleKey: 'E8',
  paramsSchema: e8ParamsSchema,
  resultSchema: altPickResultSchema,
  defaultParams: () => ({ stringIdx: 3, bpm: 60, bars: 8 }),
  createRunner: (ctx, params) => new AltPickRunner(ctx, params),
  View: E8ViewComponent,
  Summary: E8Summary,
  toMetrics: (result) => extractMetrics('E8', result),
  // Passing suggests the next tempo up (the summary says so); otherwise the same tempo again.
  suggestedTempoRetry: (params, result) =>
    result.passed ? tempoRetry(params, nextBpmFor(result.bpm, 'up')) : null,
  usesMicrophone: true,
};
