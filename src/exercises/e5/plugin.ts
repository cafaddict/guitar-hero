import { patternById, slotsPerBeat } from '../../content/patterns';
import { extractMetrics, type StrumResult, strumResultSchema } from '../../domain/exerciseResults';
import { ko } from '../../i18n/ko';
import type { ExercisePlugin } from '../types';
import { E5Summary, E5ViewComponent } from './E5View';
import {
  type E5Params,
  type E5View,
  e5ParamsSchema,
  LADDER_MIN_BARS,
  LADDER_STEP_BPM,
  LADDER_UP_HIT_RATE,
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
  howTo: (params) => {
    const g = ko.exercises.guide.E5;
    const pattern = patternById(params.patternId);
    const perClick = slotsPerBeat(pattern);
    return {
      steps: [
        g.bar(pattern.slots.length / perClick),
        g.cells(perClick),
        g.mode[params.mode],
        g.keepGoing,
        g.ladder(Math.round(LADDER_UP_HIT_RATE * 100), LADDER_MIN_BARS, LADDER_STEP_BPM),
      ],
      terms: params.mode === 'mute' ? ['strumLetters', 'muteStrum'] : ['strumLetters'],
    };
  },
  toMetrics: (result) => extractMetrics('E5', result),
  suggestedTempoRetry: (params, result) => tempoRetry(params, nextBpmFor(result.bpm, result.ladder)),
  usesMicrophone: true,
  // P pauses; a paused run keeps the ladder where it is (D-085).
  pausable: true,
};
