import { voicingById, voicingForClass } from '../../content/voicings';
import { type ChordCheckResult, chordCheckResultSchema, extractMetrics } from '../../domain/exerciseResults';
import type { ExercisePlugin } from '../types';
import { E1Summary, makeE1View } from './E1View';
import { ChordCheckRunner, type E1Params, type E1View, e1ParamsSchema } from './runner';

export const e1Plugin: ExercisePlugin<E1Params, ChordCheckResult, E1View> = {
  type: 'E1',
  version: 1,
  titleKey: 'E1',
  paramsSchema: e1ParamsSchema,
  resultSchema: chordCheckResultSchema,
  defaultParams: (content) => ({
    voicingId: voicingForClass(content.unlockedChordClasses.at(-1) ?? 'Em', content.gVoicing),
    blockMs: 120_000,
    mode: 'pluck',
    earFirst: false,
  }),
  createRunner: (ctx, params) => new ChordCheckRunner(ctx, params, voicingById(params.voicingId)),
  View: makeE1View(voicingById),
  Summary: E1Summary,
  toMetrics: (result) => extractMetrics('E1', result),
  usesMicrophone: true,
};
