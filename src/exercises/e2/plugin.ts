import { voicingById } from '../../content/voicings';
import { extractMetrics, type OneMinuteResult, oneMinuteResultSchema } from '../../domain/exerciseResults';
import { pairsAmong, parsePairId } from '../../domain/pairs';
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
  toMetrics: (result) => extractMetrics('E2', result),
  usesMicrophone: true,
};
