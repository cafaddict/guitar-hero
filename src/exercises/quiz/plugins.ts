import { z } from 'zod';
import { voicingById } from '../../content/voicings';
import {
  extractMetrics,
  type QuizResult,
  quizResultSchema,
  type RecallResult,
  recallResultSchema,
} from '../../domain/exerciseResults';
import { mulberry32 } from '../../domain/prng';
import type { ExercisePlugin } from '../types';
import { ChoiceQuizRunner, type QuizView } from './choiceQuiz';
import { renderEarChord } from './earAudio';
import { OpenNotesRunner, type Q3Params, q3ParamsSchema } from './openNotes';
import { Q1View, Q2Summary, Q2ViewComponent, Q3View, Q4View, Q5View, QuizSummary } from './QuizViews';
import {
  type DiagramPrompt,
  diagramQuestions,
  type EarPrompt,
  earQuestions,
  type OpenNotePrompt,
  quizVoicings,
  type TabPrompt,
  tabQuestions,
} from './questions';
import { type Q2Params, type Q2View, q2ParamsSchema, RecallRunner } from './recall';

const seedParams = z.object({ seed: z.number().int().min(0) });
type SeedParams = z.infer<typeof seedParams>;
/** seed 0 = a fresh quiz each time (seeded from the clock, so tests with a fake clock stay deterministic). */
const seedOf = (seed: number, now: number) =>
  seed === 0 ? Math.floor(mulberry32(Math.floor(now))() * 2 ** 31) : seed;

export const q1Plugin: ExercisePlugin<SeedParams, QuizResult, QuizView<DiagramPrompt>> = {
  type: 'Q1',
  version: 1,
  titleKey: 'Q1',
  paramsSchema: seedParams,
  resultSchema: quizResultSchema,
  defaultParams: () => ({ seed: 0 }),
  createRunner: (ctx, params) =>
    new ChoiceQuizRunner(
      ctx,
      diagramQuestions(
        quizVoicings(ctx.content.voicings, ctx.content.unlockedChordClasses, ctx.content.gVoicing),
        seedOf(params.seed, ctx.clock.now()),
      ),
    ),
  View: Q1View,
  Summary: QuizSummary,
  toMetrics: (result) => extractMetrics('Q1', result),
  usesMicrophone: false,
};

export const q2Plugin: ExercisePlugin<Q2Params, RecallResult, Q2View> = {
  type: 'Q2',
  version: 1,
  titleKey: 'Q2',
  paramsSchema: q2ParamsSchema,
  resultSchema: recallResultSchema,
  defaultParams: () => ({ count: 8, chordClasses: [], seed: 0 }),
  createRunner: (ctx, params) => new RecallRunner(ctx, params, voicingById),
  View: Q2ViewComponent,
  Summary: Q2Summary,
  toMetrics: (result) => extractMetrics('Q2', result),
  usesMicrophone: true,
};

export const q3Plugin: ExercisePlugin<Q3Params, QuizResult, QuizView<OpenNotePrompt>> = {
  type: 'Q3',
  version: 1,
  titleKey: 'Q3',
  paramsSchema: q3ParamsSchema,
  resultSchema: quizResultSchema,
  defaultParams: () => ({ mode: 'name', seed: 0 }),
  createRunner: (ctx, params) => new OpenNotesRunner(ctx, params),
  View: Q3View,
  Summary: QuizSummary,
  toMetrics: (result) => extractMetrics('Q3', result),
  // Optional microphone: the pluck variant listens with the tuner.
  usesMicrophone: true,
};

export const q4Plugin: ExercisePlugin<SeedParams, QuizResult, QuizView<EarPrompt>> = {
  type: 'Q4',
  version: 1,
  titleKey: 'Q4',
  paramsSchema: seedParams,
  resultSchema: quizResultSchema,
  defaultParams: () => ({ seed: 0 }),
  createRunner: (ctx, params) =>
    new ChoiceQuizRunner(ctx, earQuestions(seedOf(params.seed, ctx.clock.now())), (q) =>
      ctx.output.playSamples(renderEarChord(q.prompt, ctx.output.sampleRate())),
    ),
  View: Q4View,
  Summary: QuizSummary,
  toMetrics: (result) => extractMetrics('Q4', result),
  usesMicrophone: false,
};

export const q5Plugin: ExercisePlugin<SeedParams, QuizResult, QuizView<TabPrompt>> = {
  type: 'Q5',
  version: 1,
  titleKey: 'Q5',
  paramsSchema: seedParams,
  resultSchema: quizResultSchema,
  defaultParams: () => ({ seed: 0 }),
  createRunner: (ctx, params) =>
    new ChoiceQuizRunner(ctx, tabQuestions(seedOf(params.seed, ctx.clock.now()))),
  View: Q5View,
  Summary: QuizSummary,
  toMetrics: (result) => extractMetrics('Q5', result),
  usesMicrophone: false,
};
