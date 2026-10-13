import { PAIR_UNLOCK_CHANGES, PAIR_UNLOCK_DAYS } from '../../content/curriculum';
import { voicingById } from '../../content/voicings';
import { extractMetrics, type OneMinuteResult, oneMinuteResultSchema } from '../../domain/exerciseResults';
import { pairsAmong, parsePairId } from '../../domain/pairs';
import { ko } from '../../i18n/ko';
import type { ExercisePlugin } from '../types';
import { E2Summary, makeE2View } from './E2View';
import { type E2Params, type E2View, e2ParamsSchema, OneMinuteRunner } from './runner';

export const e2Plugin: ExercisePlugin<E2Params, OneMinuteResult, E2View> = {
  type: 'E2',
  version: 1,
  titleKey: 'E2',
  paramsSchema: e2ParamsSchema,
  resultSchema: oneMinuteResultSchema,
  defaultParams: (content) => {
    const [from, to] = parsePairId(pairsAmong(content.unlockedChordClasses)[0] ?? 'A|D');
    return { from, to, durationMs: 60_000, countMode: 'auto' };
  },
  createRunner: (ctx, params) => new OneMinuteRunner(ctx, params, voicingById),
  View: makeE2View(voicingById),
  Summary: E2Summary,
  howTo: (params) => {
    const g = ko.exercises.guide.E2;
    return {
      steps: [
        g.start(params.from),
        g.go(params.from, params.to),
        g.count[params.countMode],
        g.sound,
        g.goal(PAIR_UNLOCK_CHANGES, PAIR_UNLOCK_DAYS),
      ],
      terms: [],
    };
  },
  toMetrics: (result) => extractMetrics('E2', result),
  usesMicrophone: true,
};
