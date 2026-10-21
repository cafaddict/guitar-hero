import { type AltPickResult, altPickResultSchema, extractMetrics } from '../../domain/exerciseResults';
import { stringNumber } from '../../domain/strings';
import { ko } from '../../i18n/ko';
import { LADDER_STEP_BPM, nextBpmFor, tempoRetry } from '../e5/runner';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { BigBpm } from '../ui/BigBpm';
import { useRunnerSnapshot } from '../ui/hooks';
import { LiveBars } from '../ui/LiveBars';
import { PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import { selfRatingButtons } from '../ui/SelfRating';
import {
  ALT_PICK_HIT_RATE,
  ALT_PICK_MAX_IOI_CV,
  ALT_PICK_MIN_BARS,
  AltPickRunner,
  type E8Params,
  type E8View,
  e8ParamsSchema,
} from './runner';

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
    <PracticeStage
      data-testid="e8-view"
      data-phase={phase}
      figure={
        <div className="flex w-full flex-col gap-4">
          <p className="text-2xl font-semibold">{ko.exercises.e8.how(stringNumber(view.stringIdx))}</p>
          {live && <LiveBars bars={view.bars} live={view.liveBars} current={view.bar} kind="counts" />}
        </div>
      }
      primary={
        view.awaitingSelf ? selfRatingButtons(ko.exercises.e8.self, (cmd) => runner.command(cmd)) : undefined
      }
      primaryLabel={view.awaitingSelf ? ko.exercises.e8.selfPrompt : undefined}
    >
      <BigBpm bpm={view.bpm} />
      <p className="text-xl">
        {phase === 'countIn'
          ? ko.exercises.e5.countIn
          : view.bar !== null
            ? ko.exercises.e5.bar(view.bar + 1, view.bars)
            : ''}
      </p>
      <div aria-live="polite" className="text-xl">
        {view.analyzing && <p>{ko.exercises.e5.analyzing}</p>}
        {view.awaitingSelf && <p>{ko.exercises.e8.selfPrompt}</p>}
      </div>
    </PracticeStage>
  );
}

function E8Summary({ result }: { result: AltPickResult; params: E8Params }) {
  return (
    <div data-testid="e8-summary">
      <p className={RESULT_HEADLINE}>{ko.exercises.e8.hitRate(result.hitRate)}</p>
      {result.ioiCv !== null && <p>{ko.exercises.e8.evenness(result.ioiCv)}</p>}
      <p className="mt-2 font-semibold">
        {result.passed ? ko.exercises.e8.passed(nextBpmFor(result.bpm, 'up')) : ko.exercises.e8.notYet}
      </p>
      {(result.pauses ?? 0) > 0 && <p className="text-muted">{ko.exercises.common.pausedRun}</p>}
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
  howTo: (params) => {
    const g = ko.exercises.guide;
    return {
      steps: [
        g.E8.string(stringNumber(params.stringIdx)),
        g.perClick(2),
        g.E8.start,
        g.E8.pass(
          Math.round(ALT_PICK_HIT_RATE * 100),
          Math.round(ALT_PICK_MAX_IOI_CV * 100),
          ALT_PICK_MIN_BARS,
          LADDER_STEP_BPM,
        ),
      ],
      terms: ['stringNumbers'],
    };
  },
  toMetrics: (result) => extractMetrics('E8', result),
  // Passing suggests the next tempo up (the summary says so); otherwise the same tempo again.
  suggestedTempoRetry: (params, result) =>
    result.passed ? tempoRetry(params, nextBpmFor(result.bpm, 'up')) : null,
  usesMicrophone: true,
  // P pauses; a paused run does not count for the ladder (D-085).
  pausable: true,
};
