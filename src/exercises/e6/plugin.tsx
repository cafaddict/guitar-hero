import { patternById } from '../../content/patterns';
import { extractMetrics, type OneBeatResult, oneBeatResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { LADDER_STEP_BPM, nextBpmFor, tempoRetry } from '../e5/runner';
import type { ExerciseContext, ExercisePlugin, ExerciseRunner } from '../types';
import { ArmedStart } from '../ui/ArmedStart';
import { useRunnerSnapshot } from '../ui/hooks';
import { LiveBars } from '../ui/LiveBars';
import { SelfRating } from '../ui/SelfRating';
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
    <div className="flex flex-col gap-4" data-testid="e6-view" data-phase={phase}>
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
      <div className="grid grid-cols-2 gap-3 text-center">
        <p className="rounded-lg bg-surface p-4 font-bold" style={{ fontSize: 'clamp(2.5rem, 12vh, 6rem)' }}>
          {view.chord ?? '—'}
        </p>
        <p className="rounded-lg bg-surface-2 p-4 text-3xl text-muted">
          {view.nextChord ? ko.exercises.e6.next(view.nextChord) : ''}
        </p>
      </div>
      {live && <LiveBars bars={view.bars} live={view.liveBars} current={view.bar} kind="beatOne" />}
      <p className="text-sm text-muted">{ko.exercises.e6.how}</p>
      <ArmedStart phase={phase} onStart={() => runner.command('toggle')} />
      <div aria-live="polite">
        {view.analyzing && <p>{ko.exercises.e5.analyzing}</p>}
        {view.awaitingSelf && (
          <SelfRating
            prompt={ko.exercises.e6.selfPrompt}
            labels={ko.exercises.e6.self}
            onPick={(cmd) => runner.command(cmd)}
          />
        )}
      </div>
    </div>
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
