import { patternById } from '../../content/patterns';
import { extractMetrics, type OneBeatResult, oneBeatResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { LADDER_STEP_BPM, nextBpmFor, tempoRetry } from '../e5/runner';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { ArmedPrompt, armedStartButton } from '../ui/ArmedStart';
import { BigBpm } from '../ui/BigBpm';
import { useRunnerSnapshot } from '../ui/hooks';
import { LiveBars } from '../ui/LiveBars';
import { PracticeStage } from '../ui/PracticeStage';
import { selfRatingButtons } from '../ui/SelfRating';
import { type E6Params, type E6View, e6ParamsSchema, ONE_BEAT_PASS_RATIO, OneBeatRunner } from './runner';

function E6ViewComponent({
  runner,
  ctx,
}: {
  runner: ExerciseRunner<OneBeatResult, E6View>;
  params: E6Params;
  ctx: ExerciseContext;
}) {
  const { view, phase } = useRunnerSnapshot(runner);
  const live = ctx.audio !== null && phase !== 'armed' && phase !== 'ready' && phase !== 'done';
  return (
    <PracticeStage
      data-testid="e6-view"
      data-phase={phase}
      figure={
        <div className="flex w-full flex-col gap-4">
          <div className="grid grid-cols-2 gap-3 text-center">
            <p
              className="flex items-center justify-center rounded-2xl bg-surface p-4 font-bold"
              style={{ fontSize: 'clamp(2.5rem, 12vh, 7rem)' }}
            >
              {view.chord ?? '—'}
            </p>
            <p className="flex items-center justify-center rounded-2xl bg-surface-2 p-4 text-3xl text-muted">
              {view.nextChord ? ko.exercises.e6.next(view.nextChord) : ''}
            </p>
          </div>
          {live && <LiveBars bars={view.bars} live={view.liveBars} current={view.bar} kind="beatOne" />}
        </div>
      }
      primary={
        armedStartButton(phase, () => runner.command('toggle')) ??
        (view.awaitingSelf
          ? selfRatingButtons(ko.exercises.e6.self, (cmd) => runner.command(cmd))
          : undefined)
      }
      primaryLabel={view.awaitingSelf ? ko.exercises.e6.selfPrompt : undefined}
      notes={<p className="text-lg">{ko.exercises.e6.how}</p>}
    >
      <BigBpm bpm={view.bpm} />
      <p className="text-xl">
        {phase === 'countIn'
          ? ko.exercises.e5.countIn
          : view.bar !== null
            ? ko.exercises.e5.bar(view.bar + 1, view.bars)
            : ''}
      </p>
      <ArmedPrompt phase={phase} />
      <div aria-live="polite" className="text-xl">
        {view.analyzing && <p>{ko.exercises.e5.analyzing}</p>}
        {view.awaitingSelf && <p>{ko.exercises.e6.selfPrompt}</p>}
      </div>
    </PracticeStage>
  );
}

function E6Summary({ result }: { result: OneBeatResult; params: E6Params }) {
  return (
    <div data-testid="e6-summary">
      <p className="text-xl font-bold">{ko.exercises.e6.bars(result.barsInWindow, result.bars)}</p>
      <p>{ko.exercises.e6.stops(result.stops)}</p>
      {result.beat1DelayMsMean !== null && <p>{ko.exercises.e6.delay(result.beat1DelayMsMean)}</p>}
      <p className="mt-2 font-semibold">
        {result.passed ? ko.exercises.e6.passed(nextBpmFor(result.bpm, 'up')) : ko.exercises.e6.notYet}
      </p>
      {(result.pauses ?? 0) > 0 && <p className="text-muted">{ko.exercises.common.pausedRun}</p>}
    </div>
  );
}

export const e6Plugin: ExercisePlugin<E6Params, OneBeatResult, E6View> = {
  type: 'E6',
  version: 1,
  titleKey: 'E6',
  paramsSchema: e6ParamsSchema,
  resultSchema: oneBeatResultSchema,
  defaultParams: (content) => ({
    progression:
      content.unlockedChordClasses.length >= 2 ? content.unlockedChordClasses.slice(-2) : ['A', 'D'],
    patternId: 'P0',
    bpm: 60,
    bars: 16,
  }),
  createRunner: (ctx, params) => new OneBeatRunner(ctx, params),
  View: E6ViewComponent,
  Summary: E6Summary,
  howTo: (params) => {
    const g = ko.exercises.guide.E6;
    return {
      steps: [
        g.chords(params.progression.join(' → ')),
        g.pattern(patternById(params.patternId).label),
        g.change,
        g.pass(Math.ceil(params.bars * ONE_BEAT_PASS_RATIO), params.bars, LADDER_STEP_BPM),
        g.live,
      ],
      terms: ['strumLetters'],
    };
  },
  toMetrics: (result) => extractMetrics('E6', result),
  // Passing suggests the next tempo up (the summary says so); otherwise the same tempo again.
  suggestedTempoRetry: (params, result) =>
    result.passed ? tempoRetry(params, nextBpmFor(result.bpm, 'up')) : null,
  usesMicrophone: true,
  // P pauses; a paused run does not count for the ladder (D-085).
  pausable: true,
};
