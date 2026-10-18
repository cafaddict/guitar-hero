import {
  CHROMATIC_GOAL_BPM,
  CHROMATIC_STREAK,
  type ChromaticResult,
  chromaticResultSchema,
  countsForCriteria,
  extractMetrics,
  ladderNextBpm,
} from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import { LADDER_STEP_BPM, tempoRetry } from '../e5/runner';
import { SequenceStage } from '../sequence/SequenceStage';
import { type ExercisePlugin, type ExerciseRunner, SEQUENCE_HISTORY_DEPTH } from '../types';
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
  howTo: () => ({
    steps: [
      ko.exercises.e9.how,
      ko.exercises.guide.perClick(2),
      ko.exercises.guide.E9.ladder(CHROMATIC_STREAK, CHROMATIC_GOAL_BPM, LADDER_STEP_BPM),
    ],
    terms: ['tab', 'fingerNumbers', 'stringNumbers'],
  }),
  toMetrics: (result) => extractMetrics('E9', result),
  // Several subjects (scales/steps, finger pairs, start frets) share the history: look far enough back.
  historyDepth: SEQUENCE_HISTORY_DEPTH,
  withHistory: (params, recent) => {
    const last = recent.find((r) => r.startFret === params.startFret);
    if (!last || params.ladderBase !== undefined) return params;
    // `previousLow` from the latest run that counts (a paused one is ignored, D-085).
    const counted = recent.find((r) => r.startFret === params.startFret && countsForCriteria(r));
    return {
      ...params,
      bpm: ladderNextBpm(last.bpm, last.ladder),
      previousLow: counted !== undefined && counted.cycles.length > 0 && flawlessShare(counted.cycles) < 0.5,
    };
  },
  suggestedTempoRetry: (params, result) => tempoRetry(params, ladderNextBpm(result.bpm, result.ladder)),
  usesMicrophone: true,
};
