import {
  type ChromaticResult,
  chromaticResultSchema,
  extractMetrics,
  ladderNextBpm,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { tempoRetry } from '../e5/runner';
import { SequenceStage } from '../sequence/SequenceStage';
import type { ExercisePlugin, ExerciseRunner } from '../types';
import { ChromaticRunner, type E9Params, type E9View, e9ParamsSchema, flawlessShare } from './runner';

function E9ViewComponent({ runner }: { runner: ExerciseRunner<ChromaticResult, E9View>; params: E9Params }) {
  const view = runner.snapshot().view;
  const t = ko.exercises.e9;
  return (
    <SequenceStage
      runner={runner}
      title={t.title(view.startFret)}
      tabLabel={t.tabLabel(view.startFret)}
      testId="e9-view"
    >
      <p>{t.how}</p>
      <p className="text-sm text-muted">{t.goal}</p>
    </SequenceStage>
  );
}

function E9Summary({ result }: { result: ChromaticResult; params: E9Params }) {
  const t = ko.exercises.sequence;
  return (
    <div data-testid="e9-summary">
      <p className="text-xl font-bold">
        {t.summary(result.cycles.length, result.cycles.filter((c) => c.flawless).length)}
      </p>
      <p>{t.ladder[result.ladder](ladderNextBpm(result.bpm, result.ladder))}</p>
    </div>
  );
}

export const e9Plugin: ExercisePlugin<E9Params, ChromaticResult, E9View> = {
  type: 'E9',
  version: 1,
  titleKey: 'E9',
  paramsSchema: e9ParamsSchema,
  resultSchema: chromaticResultSchema,
  defaultParams: () => e9ParamsSchema.parse({}),
  createRunner: (ctx, params) => new ChromaticRunner(ctx, params),
  View: E9ViewComponent,
  Summary: E9Summary,
  toMetrics: (result) => extractMetrics('E9', result),
  withHistory: (params, recent) => {
    const last = recent.find((r) => r.startFret === params.startFret);
    if (!last || params.ladderBase !== undefined) return params;
    return {
      ...params,
      bpm: ladderNextBpm(last.bpm, last.ladder),
      previousLow: last.cycles.length > 0 && flawlessShare(last.cycles) < 0.5,
    };
  },
  suggestedTempoRetry: (params, result) => tempoRetry(params, ladderNextBpm(result.bpm, result.ladder)),
  usesMicrophone: true,
};
