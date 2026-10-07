import { voicingForClass } from '../../content/voicings';
import { changesPerMinute, type OneMinuteResult } from '../../domain/exerciseResults';
import type { ChordVoicing } from '../../domain/voicing';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { BigTimer } from '../ui/BigTimer';
import { useRunnerSnapshot } from '../ui/hooks';
import type { E2Params, E2View as View } from './runner';

export function makeE2View(voicingOf: (id: string) => ChordVoicing) {
  return function E2ViewComponent({
    runner,
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
      <div className="grid gap-4 md:grid-cols-2" data-testid="e2-view" data-phase={phase}>
        <div className="flex flex-col items-center gap-2">
          <ChordDiagram voicing={next} leftHanded={ctx.settings.leftHanded} />
          <p className="text-lg" data-testid="e2-next">
            {ko.exercises.e2.next(view.nextChord)}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <BigTimer remainingMs={remainingMs} />
          <p className="text-center">
            <span
              className="block font-bold tabular-nums leading-none"
              style={{ fontSize: 'clamp(3rem, 15vh, 8rem)' }}
              data-testid="e2-count"
            >
              {view.count}
            </span>
            <span className="text-muted">{ko.exercises.e2.count}</span>
          </p>
          {view.countMode === 'auto' && (
            <p className="text-center text-sm text-muted">
              {ko.exercises.e2.lowConfidence(view.lowConfidence)}
            </p>
          )}
          <p aria-live="polite" className="min-h-6">
            {waiting && (phase === 'armed' ? ko.exercises.e2.armed(view.from) : ko.exercises.e2.ready)}
            {phase === 'review' &&
              (view.countMode === 'manual' ? ko.exercises.e2.manualReview : ko.exercises.e2.review)}
          </p>
          <div className="flex flex-wrap gap-2">
            {waiting && (
              <Button large onClick={() => runner.command('toggle')}>
                {ko.exercises.e2.start}
              </Button>
            )}
            {phase === 'running' && view.countMode === 'tap' && (
              <Button large onClick={() => runner.command('next')}>
                {ko.exercises.e2.tap}
              </Button>
            )}
            {(phase === 'running' || phase === 'review') && (
              <>
                <Button large variant="secondary" onClick={() => runner.command('inc')}>
                  {ko.exercises.e2.plus}
                </Button>
                <Button large variant="secondary" onClick={() => runner.command('dec')}>
                  {ko.exercises.e2.minus}
                </Button>
              </>
            )}
            {phase === 'review' && (
              <Button large onClick={() => runner.command('next')} data-testid="e2-confirm">
                {ko.exercises.e2.confirm}
              </Button>
            )}
          </div>
          <p className="text-sm text-muted">
            {ko.exercises.e2.modes[view.countMode]} · {ko.exercises.e2.soundNote}
          </p>
        </div>
      </div>
    );
  };
}

export function E2Summary({ result }: { result: OneMinuteResult; params: E2Params }) {
  return (
    <div data-testid="e2-summary">
      <p className="text-xl font-bold">{ko.exercises.e2.perMinute(changesPerMinute(result))}</p>
      <p>
        {ko.exercises.e2.detail(
          result.countMode === 'tap' ? (result.tapChanges ?? 0) : result.detectedChanges,
          result.correctedChanges,
        )}
      </p>
    </div>
  );
}
