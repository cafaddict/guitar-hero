import { describe, expect, it } from 'vitest';
import { deriveAll } from '../../domain/derive';
import { quizResultSchema } from '../../domain/exerciseResults';
import type { Attempt } from '../../domain/records';
import { testContext } from '../testing/fakes';
import { OpenNotesRunner } from './openNotes';
import { tabQuestions } from './questions';

describe('knowledge cards in Q3 (SPEC v1.1 §7.5)', () => {
  it('asks due note cards first and records one card answer per question', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new OpenNotesRunner(ctx, {
      mode: 'name',
      seed: 7,
      scope: 'open',
      questions: 3,
      focus: ['card:note:4:0', 'card:note:0:0'],
    });
    runner.start();
    expect(runner.snapshot().view.question?.prompt.idx).toBe(4);
    for (let q = 0; q < 3; q++) {
      const answer = runner.snapshot().view.question!.answer;
      clock.advance(1.2);
      runner.command((['manual1', 'manual2', 'manual3'] as const)[answer]!);
      runner.command('next');
    }
    const result = quizResultSchema.parse(runner.finish());
    expect(result.scope).toBe('open');
    expect(result.items?.map((i) => i.card).slice(0, 2)).toEqual(['card:note:4:0', 'card:note:0:0']);
    expect(result.items?.every((i) => i.correct)).toBe(true);
    for (const item of result.items ?? []) expect(item.reactionMs).toBeCloseTo(1200, 3);
    const attempt: Attempt = {
      id: 'q3',
      sessionId: 's',
      exerciseType: 'Q3',
      exerciseVersion: 1,
      startedAt: 0,
      endedAt: 1000,
      params: {},
      result,
      detectorVersion: null,
      processingMs: 0,
      reviewOf: null,
    };
    expect(deriveAll([attempt]).reviews.get('card:note:4:0')).toMatchObject({ kind: 'card', lapses: 0 });
  });
});

describe('Q5 TAB reading (SPEC v1.1 §11.20)', () => {
  it('10 three-way questions in both directions, the answer among the options, upside-down reading as a distractor', () => {
    const questions = tabQuestions(11);
    expect(questions).toHaveLength(10);
    expect(new Set(questions.map((q) => q.prompt.kind))).toEqual(new Set(['tabToPos', 'posToTab']));
    for (const q of questions) {
      expect(q.options).toHaveLength(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.options[q.answer]).toContain(
        String(q.prompt.fret === 0 && q.prompt.kind === 'tabToPos' ? '개방현' : q.prompt.fret),
      );
    }
  });
});
