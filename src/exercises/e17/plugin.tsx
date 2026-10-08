import { riffNotes } from '../../content/riffs';
import {
  extractMetrics,
  ladderNextBpm,
  type RiffResult,
  riffResultSchema,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Tab } from '../../ui/Tab';
import { tempoRetry } from '../e5/runner';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from '../ui/hooks';
import {
  type E17Params,
  type E17View,
  e17ParamsSchema,
  LOW_MISTAKE_RATIO,
  mistakeRatio,
  RiffRunner,
} from './runner';

function E17ViewComponent({ runner }: { runner: ExerciseRunner<RiffResult, E17View>; params: E17Params }) {
  const { view, phase } = useRunnerSnapshot(runner);
  const flawless = view.cycles.filter((c) => c.flawless).length;
  return (
    <section className="flex flex-col gap-3" data-testid="e17-view">
      <p className="text-3xl font-bold tabular-nums">
        {view.riff.id} · {ko.exercises.e17.bpm(view.bpm)}
      </p>
      <Tab
        notes={riffNotes(view.riff)}
        hidden={view.tabHidden}
        label={ko.exercises.e17.tabLabel(view.riff.id)}
      />
      <p className="text-sm text-muted">{ko.exercises.e17.tabTopLine}</p>
      {view.riff.palmMute && <p>{ko.exercises.e17.palmMute}</p>}
      {phase === 'ready' && <p>{ko.exercises.e17.ready}</p>}
      {phase === 'running' && (
        <>
          <p aria-live="polite" data-testid="e17-cycles">
            {ko.exercises.e17.cycles(view.cycles.length, flawless, view.streak)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button large onClick={() => runner.command('manual1')} data-testid="e17-flawless">
              {ko.exercises.e17.flawless}
            </Button>
            <Button
              large
              variant="secondary"
              onClick={() => runner.command('manual2')}
              data-testid="e17-mistake"
            >
              {ko.exercises.e17.mistake}
            </Button>
            <Button variant="secondary" onClick={() => runner.command('hide')}>
              {view.tabHidden ? ko.exercises.e17.showTab : ko.exercises.e17.hideTab}
            </Button>
            <Button variant="secondary" onClick={() => runner.command('toggle')}>
              {ko.exercises.e17.finish}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function E17Summary({ result }: { result: RiffResult; params: E17Params }) {
  const flawless = result.cycles.filter((c) => c.flawless).length;
  return (
    <div>
      <p className="text-xl font-bold">{ko.exercises.e17.summary(result.cycles.length, flawless)}</p>
      <p>{ko.exercises.e17.ladder[result.ladder](ladderNextBpm(result.bpm, result.ladder))}</p>
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
  toMetrics: (result) => extractMetrics('E17', result),
  withHistory: (params, recent) => {
    const last = recent.find((r) => r.riffId === params.riffId);
    return { ...params, previousLow: last !== undefined && mistakeRatio(last.cycles) >= LOW_MISTAKE_RATIO };
  },
  suggestedTempoRetry: (params, result) => tempoRetry(params, ladderNextBpm(result.bpm, result.ladder)),
  usesMicrophone: false,
};
