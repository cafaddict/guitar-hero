import { voicingForClass } from '../../content/voicings';
import { changesPerMinute, type OneMinuteResult } from '../../domain/exerciseResults';
import type { ChordVoicing } from '../../domain/voicing';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { BigTimer } from '../ui/BigTimer';
import { useRunnerSnapshot } from '../ui/hooks';
import { PRACTICE_DIAGRAM, PracticeStage } from '../ui/PracticeStage';
import { RESULT_HEADLINE } from '../ui/resultHeadline';
import type { E2Params, E2View as View } from './runner';

export function makeE2View(voicingOf: (id: string) => ChordVoicing) {
  return function E2ViewComponent({
    runner,
    params,
    ctx,
  }: {
    runner: ExerciseRunner<OneMinuteResult, View>;
    params: E2Params;
    ctx: ExerciseContext;
  }) {
    const { view, phase, remainingMs } = useRunnerSnapshot(runner);
    const next = voicingOf(voicingForClass(view.nextChord, ctx.content.gVoicing));
    const waiting = phase === 'ready' || phase === 'armed';
    return (
      <PracticeStage
        data-testid="e2-view"
        data-phase={phase}
        figure={
          <>
            <ChordDiagram voicing={next} leftHanded={ctx.settings.leftHanded} className={PRACTICE_DIAGRAM} />
            <p className="text-xl font-semibold" data-testid="e2-next">
              {ko.exercises.e2.next(view.nextChord)}
            </p>
          </>
        }
        primary={
          waiting ? (
            <Button large onClick={() => runner.command('toggle')}>
              {ko.exercises.e2.start}
            </Button>
          ) : phase === 'running' && view.countMode === 'tap' ? (
            <Button large onClick={() => runner.command('next')}>
              {ko.exercises.e2.tap}
            </Button>
          ) : phase === 'review' ? (
            <Button large onClick={() => runner.command('next')} data-testid="e2-confirm">
              {ko.exercises.e2.confirm}
            </Button>
          ) : undefined
        }
        secondary={
          (phase === 'running' || phase === 'review') && (
            <>
              <Button large variant="secondary" className="min-w-16" onClick={() => runner.command('inc')}>
                {ko.exercises.e2.plus}
              </Button>
              <Button large variant="secondary" className="min-w-16" onClick={() => runner.command('dec')}>
                {ko.exercises.e2.minus}
              </Button>
            </>
          )
        }
        notes={
          <p className="text-muted">
            {ko.exercises.e2.modes[view.countMode]} · {ko.exercises.e2.soundNote}
          </p>
        }
      >
        {/* Time and count side by side where the column is wide enough (iPad portrait), stacked elsewhere. */}
        <div className="flex flex-wrap items-end gap-x-14 gap-y-4">
          <BigTimer remainingMs={remainingMs} plannedMs={params.durationMs} />
          <p className="flex items-baseline gap-3" data-core-number>
            <span
              className="font-bold tabular-nums leading-none"
              style={{ fontSize: 'clamp(3rem, 16vh, 13rem)' }}
              data-testid="e2-count"
            >
              {view.count}
            </span>
            <span className="text-2xl text-muted">{ko.exercises.e2.count}</span>
          </p>
        </div>
        {view.countMode === 'auto' && (
          <p className="text-muted">{ko.exercises.e2.lowConfidence(view.lowConfidence)}</p>
        )}
        <p aria-live="polite" className="min-h-7 text-xl">
          {waiting && (phase === 'armed' ? ko.exercises.e2.armed(view.from) : ko.exercises.e2.ready)}
          {phase === 'review' &&
            (view.countMode === 'manual' ? ko.exercises.e2.manualReview : ko.exercises.e2.review)}
        </p>
      </PracticeStage>
    );
  };
}

export function E2Summary({ result }: { result: OneMinuteResult; params: E2Params }) {
  return (
    <div data-testid="e2-summary">
      <p className={RESULT_HEADLINE}>{ko.exercises.e2.perMinute(changesPerMinute(result))}</p>
      <p className="text-muted">{ko.exercises.e2.perMinuteMeaning}</p>
      <p>
        {ko.exercises.e2.detail(
          result.countMode === 'tap' ? (result.tapChanges ?? 0) : result.detectedChanges,
          result.correctedChanges,
        )}
      </p>
    </div>
  );
}
