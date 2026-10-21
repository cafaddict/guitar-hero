/**
 * Generic multiple-choice quiz runner (Q1, Q3, Q4): one question at a time, answers with 1/2/3 (or buttons),
 * reaction time from showing the question to the answer, short feedback, then the next question. A quiz
 * stopped early is recorded over the questions actually answered (none answered → nothing is recorded).
 * ← looks back at the questions already answered, read-only (D-096): answers stay as they were, and the time
 * spent looking back is not reaction time.
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
  /** Showing an earlier, answered question (`index`, `picked` are that question's); answering waits. */
  lookingBack: boolean;
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
  private readonly items: { card: string; correct: boolean; reactionMs: number | null }[] = [];
  /** The answer picked for each question so far (what a look back shows). */
  private readonly picks: (number | null)[] = [];
  /** The earlier question shown by a look back, null while the current one is shown. */
  private lookIndex: number | null = null;
  private lookStartedAt = 0;
  /** The current question's feedback was showing when the look back began: it moves on after the return. */
  private heldAdvance = false;

  constructor(
    ctx: ExerciseContext,
    protected readonly questions: readonly ChoiceQuestion<P>[],
    private readonly onShow: (question: ChoiceQuestion<P>) => void = () => {},
    /** Knowledge card of a question (SPEC v1.1 §7.5), or null when the quiz keeps no cards. */
    private readonly cardOf: (prompt: P) => string | null = () => null,
    /** Extra result fields (Q3 scope, Q4 kind). */
    private readonly extra: Partial<QuizResult> = {},
  ) {
    super(ctx);
    if (questions.length === 0) throw new Error('quiz without questions');
  }

  protected current(): ChoiceQuestion<P> | null {
    return this.questions[this.index] ?? null;
  }

  /** The question on screen: the current one, or the earlier one a look back shows. */
  private displayed(): ChoiceQuestion<P> | null {
    return this.questions[this.lookIndex ?? this.index] ?? null;
  }

  protected view(): QuizView<P> {
    const looking = this.lookIndex !== null;
    return {
      index: this.lookIndex ?? this.index,
      total: this.questions.length,
      question: this.displayed(),
      picked: this.lookIndex === null ? this.picked : (this.picks[this.lookIndex] ?? null),
      correctCount: this.correct,
      lookingBack: looking,
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
    // During a look back nothing is answered (a Q3 pluck heard meanwhile included).
    if (!q || this.picked !== null || this.phase !== 'running' || this.lookIndex !== null) return;
    this.picked = choice;
    this.picks[this.index] = choice;
    if (choice === q.answer) this.correct++;
    const reaction = this.ctx.clock.now() - this.shownAt;
    this.reactions.push(reaction);
    const card = this.cardOf(q.prompt);
    if (card) this.items.push({ card, correct: choice === q.answer, reactionMs: reaction });
    this.advanceAt = this.ctx.clock.now() + FEEDBACK_MS;
    this.publish();
  }

  /** Plays the question on screen again (a look back at a Q4 question plays that question's sound). */
  protected replay(): void {
    const q = this.displayed();
    if (q) this.onShow(q);
  }

  /** A look back is possible while an earlier question exists to show. */
  canStepBack(): boolean {
    return this.phase === 'running' && (this.lookIndex ?? this.index) > 0;
  }

  /** One question further back; the current question's clock and pending feedback wait meanwhile. */
  private lookBack(): void {
    if (this.lookIndex === null) {
      this.lookStartedAt = this.ctx.clock.now();
      if (this.advanceAt !== null) {
        this.heldAdvance = true;
        this.advanceAt = null;
      }
    }
    this.lookIndex = (this.lookIndex ?? this.index) - 1;
    this.publish();
  }

  /** Back to the current question: an unanswered one gets its reaction clock back, feedback moves on as before. */
  private endLookBack(): void {
    this.lookIndex = null;
    const now = this.ctx.clock.now();
    if (this.picked === null) this.shownAt += now - this.lookStartedAt;
    if (this.heldAdvance) {
      this.heldAdvance = false;
      this.advanceAt = now + FEEDBACK_MS;
    }
    this.publish();
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
    if (cmd === 'prev') {
      if (this.canStepBack()) this.lookBack();
      return;
    }
    if (this.lookIndex !== null) {
      if (cmd === 'next' || cmd === 'toggle') this.endLookBack();
      else if (cmd === 'mark') this.replay();
      return;
    }
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
      ...(this.items.length > 0 ? { items: [...this.items] } : {}),
      ...this.extra,
    };
  }
}
