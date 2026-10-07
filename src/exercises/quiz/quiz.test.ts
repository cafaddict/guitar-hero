import { describe, expect, it } from 'vitest';
import { SEED_VOICINGS, voicingById } from '../../content/voicings';
import { quizResultSchema, recallResultSchema } from '../../domain/exerciseResults';
import { midiToHz } from '../../domain/theory';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { ChoiceQuizRunner } from './choiceQuiz';
import { OpenNotesRunner } from './openNotes';
import { diagramQuestions, earChordHz, earQuestions, openNoteQuestions, quizVoicings } from './questions';
import { RecallRunner } from './recall';

describe('question generators', () => {
  it('are deterministic for a seed and always contain the right answer once', () => {
    const voicings = quizVoicings(SEED_VOICINGS, ['Em', 'E', 'A', 'D', 'C'], 'G-3f');
    const a = diagramQuestions(voicings, 42);
    expect(diagramQuestions(voicings, 42)).toEqual(a);
    expect(a).toHaveLength(10);
    for (const q of a) {
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.answer).toBeGreaterThanOrEqual(0);
    }
    const position = a.find((q) => q.prompt.kind === 'position')!;
    const v = voicingById(position.prompt.voicingId);
    if (position.prompt.kind === 'position') expect(v.frets[position.prompt.idx]).toBe(position.prompt.fret);
    for (const q of openNoteQuestions(7, 'name'))
      expect(q.options).toContain(['E', 'A', 'D', 'G', 'B', 'E'][q.prompt.idx]);
    const ear = earQuestions(3);
    expect(ear.every((q) => q.answer === (q.prompt.quality === 'major' ? 0 : 1))).toBe(true);
    const hz = earChordHz({ rootMidi: 57, quality: 'minor', seed: 1 });
    expect(hz.map((f) => Math.round(f))).toEqual([220, 330, 440, 523]);
  });

  it('quizVoicings falls back to the beginner chords before anything is unlocked', () => {
    expect(
      quizVoicings(SEED_VOICINGS, [], 'G-2f')
        .map((v) => v.id)
        .sort(),
    ).toEqual(['A', 'Am', 'C', 'D', 'Dm', 'E', 'Em', 'G-2f']);
  });
});

describe('ChoiceQuizRunner', () => {
  it('answers with 1/2/3, measures reaction time, advances after feedback', () => {
    const { ctx, clock } = testContext({ mic: false });
    const shown: number[] = [];
    const questions = [0, 1, 2].map((answer) => ({ prompt: answer, options: ['a', 'b', 'c'], answer }));
    const runner = new ChoiceQuizRunner(ctx, questions, (q) => shown.push(q.prompt));
    runner.start();
    clock.advance(2);
    runner.command('manual1'); // correct
    expect(runner.snapshot().view.picked).toBe(0);
    runner.command('manual2'); // ignored: already answered
    clock.advance(2);
    runner.tick();
    expect(runner.snapshot().view.index).toBe(1);
    clock.advance(1);
    runner.command('manual3'); // wrong
    runner.command('next');
    runner.command('mark'); // replay
    clock.advance(3);
    runner.command('manual3'); // correct
    clock.advance(2);
    runner.tick();
    expect(runner.snapshot().phase).toBe('done');
    const result = runner.finish();
    expect(quizResultSchema.parse(result)).toEqual(result);
    expect(result).toEqual({ questions: 3, correct: 2, meanReactionMs: 2000 });
    expect(shown).toEqual([0, 1, 2, 2]);
  });

  it('stopping early records only the answered questions; nothing answered → no result', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new ChoiceQuizRunner(ctx, [
      { prompt: 0, options: ['a', 'b'], answer: 0 },
      { prompt: 1, options: ['a', 'b'], answer: 1 },
    ]);
    runner.start();
    expect(runner.hasResult()).toBe(false);
    runner.command('manual1');
    runner.command('abort');
    expect(runner.hasResult()).toBe(true);
    expect(runner.finish()).toEqual({ questions: 1, correct: 1, meanReactionMs: 0 });
  });
});

describe('Q3 pluck mode', () => {
  it('a stable reading of the right pitch class answers correctly', () => {
    const { ctx, mic } = testContext();
    const runner = new OpenNotesRunner(ctx, { mode: 'pluck', seed: 5 });
    runner.start();
    expect(mic.tunerOn).toBe(true);
    const q = runner.snapshot().view.question!;
    if (q.prompt.kind !== 'pluck') throw new Error('expected a pluck question');
    const right = midiToHz(52 + ((((q.prompt.pitchClass - 52) % 12) + 12) % 12));
    mic.tuner.emit({ f0: right, stableF0: null });
    expect(runner.snapshot().view.picked).toBeNull();
    mic.tuner.emit({ f0: right, stableF0: right });
    expect(runner.snapshot().view.picked).toBe(0);
    expect(runner.snapshot().view.correctCount).toBe(1);
  });

  it('falls back to name questions without a microphone', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new OpenNotesRunner(ctx, { mode: 'pluck', seed: 5 });
    runner.start();
    expect(runner.snapshot().view.question!.prompt.kind).toBe('name');
  });
});

describe('Q2 recall', () => {
  it('classifies the first strum after the prompt and times it', () => {
    const { ctx, mic, clock } = testContext();
    const runner = new RecallRunner(ctx, { count: 3, chordClasses: ['C', 'G', 'Am'], seed: 9 }, voicingById);
    runner.start();
    const job = mic.job as { kind: string; voicings: { id: string }[] };
    expect(job.kind).toBe('set');
    expect(job.voicings.map((v) => v.id)).toEqual(['C', 'G-3f', 'Am']);
    const ask = () => runner.snapshot().view.chordClass!;
    const indexOf = (cls: string) => ['C', 'G', 'Am'].indexOf(cls);
    // 1: correct in 2 s.
    let target = ask();
    mic.strike(clock.t + 2, {
      top: indexOf(target),
      margin: 6,
      scores: [],
      detectorVersion: DETECTOR_VERSION,
      processingMs: 4,
    });
    clock.advance(2.6);
    runner.tick();
    // 2: wrong chord.
    clock.advance(0.5);
    runner.tick();
    target = ask();
    mic.strike(clock.t + 1, {
      top: (indexOf(target) + 1) % 3,
      margin: 6,
      scores: [],
      detectorVersion: DETECTOR_VERSION,
      processingMs: 4,
    });
    clock.advance(2);
    runner.tick();
    // 3: nothing → timeout after 6 s.
    clock.advance(0.5);
    runner.tick();
    clock.advance(6.1);
    runner.tick();
    clock.advance(2);
    runner.tick();
    expect(runner.snapshot().phase).toBe('done');
    const result = runner.finish();
    expect(recallResultSchema.parse(result)).toEqual(result);
    expect(result.items.map((i) => i.correct)).toEqual([true, false, false]);
    expect(result.items[0]!.reactionMs).toBeCloseTo(2000, 0);
    expect(result.items[2]!.reactionMs).toBeNull();
    expect(result.items[0]!.voicingId === 'G-3f' || result.items[0]!.chordClass !== 'G').toBe(true);
  });

  it('self-report without a microphone', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new RecallRunner(ctx, { count: 2, chordClasses: ['C', 'G'], seed: 2 }, voicingById);
    runner.start();
    clock.advance(1.5);
    runner.command('manual1');
    clock.advance(2);
    runner.tick();
    runner.command('manual2');
    clock.advance(2);
    runner.tick();
    expect(runner.finish().items.map((i) => [i.correct, i.reactionMs, i.method])).toEqual([
      [true, 1500, 'self'],
      [false, null, 'self'],
    ]);
  });
});
