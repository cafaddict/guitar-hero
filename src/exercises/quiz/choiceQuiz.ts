/**
 * Generic multiple-choice quiz runner (Q1, Q3, Q4): one question at a time, answers with 1/2/3 (or buttons),
 * reaction time from showing the question to the answer, short feedback, then the next question. A quiz
 * stopped early is recorded over the questions actually answered (none answered → nothing is recorded).
 */
import type { QuizResult } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, RunnerCommand } from '../types';

export interface ChoiceQuestion<P> {
  prompt: P;
  options: readonly string[];
  answer: number;
}

export interface QuizView<P> {
  index: number;
  total: number;
  question: ChoiceQuestion<P> | null;
  picked: number | null;
  correctCount: number;
}

const CHOICES: Partial<Record<RunnerCommand, number>> = { manual1: 0, manual2: 1, manual3: 2 };
/** Feedback stays this long (simulated ms) before the next question. */
const FEEDBACK_MS = 1500;

export class ChoiceQuizRunner<P> extends BaseRunner<QuizResult, QuizView<P>> {
  protected index = 0;
  protected picked: number | null = null;
  private shownAt = 0;
  private advanceAt: number | null = null;
  private correct = 0;
  private readonly reactions: number[] = [];

  constructor(
    ctx: ExerciseContext,
    protected readonly questions: readonly ChoiceQuestion<P>[],
    private readonly onShow: (question: ChoiceQuestion<P>) => void = () => {},
  ) {
    super(ctx);
    if (questions.length === 0) throw new Error('quiz without questions');
  }

  protected current(): ChoiceQuestion<P> | null {
    return this.questions[this.index] ?? null;
  }

  protected view(): QuizView<P> {
    return {
      index: this.index,
      total: this.questions.length,
      question: this.current(),
      picked: this.picked,
      correctCount: this.correct,
    };
  }

  start(): void {
    this.setPhase('running');
    this.show();
  }

  private show(): void {
    const q = this.current();
    this.picked = null;
    this.shownAt = this.ctx.clock.now();
    if (q) this.onShow(q);
    this.publish();
  }

  /** Records an answer for the current question (index into its options). */
  protected answer(choice: number): void {
    const q = this.current();
    if (!q || this.picked !== null || this.phase !== 'running') return;
    this.picked = choice;
    if (choice === q.answer) this.correct++;
    this.reactions.push(this.ctx.clock.now() - this.shownAt);
    this.advanceAt = this.ctx.clock.now() + FEEDBACK_MS;
    this.publish();
  }

  protected replay(): void {
    const q = this.current();
    if (q) this.onShow(q);
  }

  private advance(): void {
    this.advanceAt = null;
    this.index++;
    if (this.index >= this.questions.length) {
      this.setPhase('done');
      return;
    }
    this.show();
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.phase !== 'running') return;
    const choice = CHOICES[cmd];
    if (choice !== undefined && choice < (this.current()?.options.length ?? 0)) this.answer(choice);
    else if (cmd === 'mark') this.replay();
    else if ((cmd === 'next' || cmd === 'toggle') && this.picked !== null) this.advance();
  }

  override tick(): void {
    super.tick();
    if (this.advanceAt !== null && this.ctx.clock.now() >= this.advanceAt) this.advance();
  }

  hasResult(): boolean {
    return this.reactions.length > 0;
  }

  finish(): QuizResult {
    return {
      questions: Math.max(1, this.reactions.length),
      correct: this.correct,
      meanReactionMs: this.reactions.length
        ? this.reactions.reduce((s, x) => s + x, 0) / this.reactions.length
        : null,
    };
  }
}
