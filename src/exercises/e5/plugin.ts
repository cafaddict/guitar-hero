import { extractMetrics, type StrumResult, strumResultSchema } from '../../domain/exerciseResults';
import type { ExercisePlugin } from '../types';
import { E5Summary, E5ViewComponent } from './E5View';
import {
  type E5Params,
  type E5View,
  e5ParamsSchema,
  LADDER_DOWN_HIT_RATE,
  nextBpmFor,
  StrumLadderRunner,
  tempoRetry,
} from './runner';

export const e5Plugin: ExercisePlugin<E5Params, StrumResult, E5View> = {
  type: 'E5',
  version: 1,
  titleKey: 'E5',
  paramsSchema: e5ParamsSchema,
  resultSchema: strumResultSchema,
  defaultParams: (content) => ({
    patternId: 'P0',
    bpm: 60,
    bars: 8,
    mode: content.unlockedChordClasses.length === 0 ? 'mute' : 'single',
    chords: content.unlockedChordClasses.slice(-1),
    cuesHidden: false,
    previousLow: false,
    dynamics: false,
    palmMute: false,
  }),
  createRunner: (ctx, params) => new StrumLadderRunner(ctx, params),
  View: E5ViewComponent,
  Summary: E5Summary,
  toMetrics: (result) => extractMetrics('E5', result),
  // "Two runs in a row below 70 %": the latest run of the same pattern decides `previousLow`.
  withHistory: (params, recent) => {
    const last = recent.find((r) => r.patternId === params.patternId);
    return { ...params, previousLow: last !== undefined && last.hitRateCorrected < LADDER_DOWN_HIT_RATE };
  },
  suggestedTempoRetry: (params, result) => tempoRetry(params, nextBpmFor(result.bpm, result.ladder)),
  usesMicrophone: true,
};
