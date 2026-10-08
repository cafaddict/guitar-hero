/**
 * Q3 open-string note names (SPEC §11.9): "string n → note name" (choice) or "note name → pluck that string"
 * (chromatic tuner: a stable reading of the right pitch class answers correctly, any other stable pitch
 * class answers wrongly).
 */
import { z } from 'zod';
import type { ExerciseContext } from '../types';
import { ChoiceQuizRunner } from './choiceQuiz';
import { type OpenNotePrompt, openNoteCard, openNoteQuestions } from './questions';

export const q3ParamsSchema = z.object({
  mode: z.enum(['name', 'pluck']),
  seed: z.number().int().min(0),
  /** Fretboard range (SPEC v1.1 §11.15); 'open' until the wider ranges arrive. */
  scope: z.enum(['open', 'openPosition', 'strings65']).default('open'),
  questions: z.number().int().min(1).max(40).default(10),
  /** Due note cards to ask first (SPEC v1.1 §7.5). */
  focus: z.array(z.string()).default([]),
});
export type Q3Params = z.infer<typeof q3ParamsSchema>;

export class OpenNotesRunner extends ChoiceQuizRunner<OpenNotePrompt> {
  constructor(ctx: ExerciseContext, given: Pick<Q3Params, 'mode' | 'seed'> & Partial<Q3Params>) {
    const params: Q3Params = { scope: 'open', questions: 10, focus: [], ...given };
    const seed = params.seed === 0 ? Math.floor(ctx.clock.now()) : params.seed;
    const mode = params.mode === 'pluck' && ctx.audio ? 'pluck' : 'name';
    // Each pluck question restarts the tuner so a reading from the previous string cannot answer it.
    super(
      ctx,
      openNoteQuestions(seed, mode, params.questions, params.focus),
      (q) => {
        if (q.prompt.kind === 'pluck') ctx.audio?.setTuner(true, null);
      },
      openNoteCard,
      { scope: params.scope },
    );
  }

  override start(): void {
    const mic = this.ctx.audio;
    if (mic && this.current()?.prompt.kind === 'pluck') {
      mic.setJob(null);
      mic.setTuner(true, null);
      this.own(() => mic.setTuner(false, null));
      this.own(
        mic.onTuner(({ stableF0 }) => {
          const q = this.current();
          if (q?.prompt.kind !== 'pluck' || stableF0 === null || this.picked !== null) return;
          const pitchClass = ((Math.round(69 + 12 * Math.log2(stableF0 / 440)) % 12) + 12) % 12;
          // Choice 0 is "correct" for pluck questions; any other value marks it wrong.
          this.answer(pitchClass === q.prompt.pitchClass ? 0 : 1);
        }),
      );
    }
    super.start();
  }
}
