import {
  extractMetrics,
  ladderNextBpm,
  type RiffResult,
  riffResultSchema,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { tempoRetry } from '../e5/runner';
import { SequenceStage } from '../sequence/SequenceStage';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import {
  type E17Params,
  type E17View,
  e17ParamsSchema,
  LOW_MISTAKE_RATIO,
  mistakeRatio,
  RiffRunner,
} from './runner';

function E17ViewComponent({ runner }: { runner: ExerciseRunner<RiffResult, E17View>; params: E17Params }) {
  const view = runner.snapshot().view;
  return (
    <SequenceStage
      runner={runner}
      title={view.riff.id}
      tabLabel={ko.exercises.e17.tabLabel(view.riff.id)}
      testId="e17-view"
    >
      {view.riff.palmMute && <p>{ko.exercises.e17.palmMute}</p>}
    </SequenceStage>
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
  usesMicrophone: true,
};
