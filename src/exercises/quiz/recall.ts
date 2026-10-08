/**
 * Q2 chord recall (SPEC §11.9): a random unlocked chord name appears, the user has 3 s (countdown) to form it
 * and strum once; the first strum is classified among all unlocked chords (Mode C set). Correct + within 3 s
 * = pass (graduation exam item 2). Without a microphone the user reports it (1 got it / 2 did not).
 */
import { z } from 'zod';
import { classOfVoicing, voicingForClass } from '../../content/voicings';
import { RECALL_LIMIT_MS, type RecallResult } from '../../domain/exerciseResults';
import { mulberry32, shuffled } from '../../domain/prng';
import type { ChordVoicing } from '../../domain/voicing';
import type { SetClassification } from '../../dsp/modeC';
import { BaseRunner } from '../baseRunner';
import { TakeTracker } from '../take';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

export const q2ParamsSchema = z.object({
  count: z.number().int().min(3).max(12),
  /** Chord classes to ask; empty = everything unlocked. */
  chordClasses: z.array(z.string()),
  seed: z.number().int().min(0),
});
export type Q2Params = z.infer<typeof q2ParamsSchema>;

type Item = RecallResult['items'][number];

/** Root note of a chord symbol ('Am7' → 'A', 'F#m' → 'F#'). */
export function chordRoot(symbol: string): string {
  return /^[A-G][#b]?/.exec(symbol)?.[0] ?? symbol;
}

/** Every class once per round, each round shuffled, until `count` questions (each candidate asked at least once). */
export function recallOrder(rng: () => number, classes: readonly string[], count: number): string[] {
  const out: string[] = [];
  while (out.length < count) out.push(...shuffled(rng, classes));
  return out.slice(0, Math.max(count, classes.length));
}

export interface Q2View {
  index: number;
  total: number;
  chordClass: string | null;
  /** Seconds left of the 3 s window (0 after). */
  countdown: number;
  heard: string | null;
  last: Item | null;
  self: boolean;
  passed: number;
}

/** After the 3 s window the take stays open a little longer (late strums count as correct but slow). */
const WAIT_MS = 6000;
const FEEDBACK_MS = 1500;

export class RecallRunner extends BaseRunner<RecallResult, Q2View> {
  private readonly order: string[];
  private readonly candidates: ChordVoicing[];
  private readonly take: TakeTracker;
  private index = 0;
  private shownMs = 0;
  private shownAudio = 0;
  private heard: string | null = null;
  private readonly items: Item[] = [];
  private advanceAt: number | null = null;
  private shownCountdown: number | null = null;
  /** Classification candidates of the question on screen. */
  private asked: ChordVoicing[] = [];

  constructor(ctx: ExerciseContext, params: Q2Params, voicingOf: (id: string) => ChordVoicing) {
    super(ctx);
    const unlocked = params.chordClasses.length > 0 ? params.chordClasses : ctx.content.unlockedChordClasses;
    const classes = unlocked.length >= 2 ? [...unlocked] : ['Em', 'E', 'A', 'D'];
    this.candidates = classes.map((c) => voicingOf(voicingForClass(c, ctx.content.gVoicing)));
    const seed = params.seed === 0 ? Math.floor(ctx.clock.now()) : params.seed;
    this.order = recallOrder(mulberry32(seed), classes, params.count);
    this.take = new TakeTracker(() => ctx.output.now());
  }

  /**
   * Classification candidates of the current question (SPEC v1.1 §11.9): the asked chord plus every candidate
   * whose root differs — chords sharing a root (A / Am / A7 …) share most partials and are left out.
   */
  private questionCandidates(): ChordVoicing[] {
    const target = this.chordClass;
    if (!target) return this.candidates;
    const targetId = voicingForClass(target, this.ctx.content.gVoicing);
    const targetRoot = chordRoot(this.candidates.find((v) => v.id === targetId)?.symbol ?? target);
    return this.candidates.filter((v) => v.id === targetId || chordRoot(v.symbol) !== targetRoot);
  }

  private get chordClass(): string | null {
    return this.order[this.index] ?? null;
  }

  protected view(): Q2View {
    const elapsed = this.ctx.clock.now() - this.shownMs;
    return {
      index: this.index,
      total: this.order.length,
      chordClass: this.chordClass,
      countdown: this.advanceAt === null ? Math.max(0, Math.ceil((RECALL_LIMIT_MS - elapsed) / 1000)) : 0,
      heard: this.heard,
      last: this.items.at(-1) ?? null,
      self: this.ctx.audio === null,
      passed: this.items.filter((i) => i.correct && i.reactionMs !== null && i.reactionMs <= RECALL_LIMIT_MS)
        .length,
    };
  }

  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(() => mic.setJob(null));
      this.own(mic.onCoarseOnset((t) => this.take.noteCoarse(t)));
      this.own(mic.onJudged((e) => this.onJudged(e)));
    }
    this.setPhase('running');
    this.show();
  }

  private show(): void {
    this.asked = this.questionCandidates();
    this.ctx.audio?.setJob({
      kind: 'set',
      voicings: this.asked,
      deltaCents: this.ctx.calibration?.tuningCents,
    });
    this.shownMs = this.ctx.clock.now();
    this.shownAudio = this.ctx.output.now();
    this.heard = null;
    this.take.arm();
    this.publish();
  }

  private record(item: Item): void {
    this.items.push(item);
    this.take.disarm();
    this.advanceAt = this.ctx.clock.now() + FEEDBACK_MS;
    this.publish();
  }

  private onJudged(event: JudgedEvent): void {
    if (this.phase !== 'running' || this.advanceAt !== null || event.jobKind !== 'set') return;
    const target = this.chordClass;
    if (!target) return;
    const decision = this.take.decide(event);
    if (decision === 'ignore') return;
    this.recordDsp(event);
    if (decision === 'multiple') {
      this.take.arm();
      return;
    }
    const result = event.result as SetClassification;
    const top = this.asked[result.top];
    const heardClass = top ? classOfVoicing(top.id) : null;
    this.heard = heardClass;
    this.record({
      chordClass: target,
      voicingId: voicingForClass(target, this.ctx.content.gVoicing),
      correct: heardClass === target,
      reactionMs: Math.max(0, (event.time - this.shownAudio) * 1000),
      method: 'mic',
    });
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.phase !== 'running' || this.advanceAt !== null) return;
    const target = this.chordClass;
    if (!target || this.ctx.audio) return;
    if (cmd === 'manual1' || cmd === 'manual2') {
      this.record({
        chordClass: target,
        voicingId: voicingForClass(target, this.ctx.content.gVoicing),
        correct: cmd === 'manual1',
        reactionMs: cmd === 'manual1' ? this.ctx.clock.now() - this.shownMs : null,
        method: 'self',
      });
    }
  }

  override tick(): void {
    super.tick();
    if (this.phase !== 'running') return;
    const now = this.ctx.clock.now();
    if (this.advanceAt !== null && now >= this.advanceAt) {
      this.advanceAt = null;
      this.index++;
      if (this.index >= this.order.length) this.setPhase('done');
      else this.show();
      return;
    }
    if (this.advanceAt === null && this.ctx.audio && now - this.shownMs >= WAIT_MS) {
      const target = this.chordClass!;
      this.record({
        chordClass: target,
        voicingId: voicingForClass(target, this.ctx.content.gVoicing),
        correct: false,
        reactionMs: null,
        method: 'mic',
      });
      return;
    }
    const second = this.view().countdown;
    if (second !== this.shownCountdown) {
      this.shownCountdown = second;
      this.publish();
    }
  }

  hasResult(): boolean {
    return this.items.length > 0;
  }

  finish(): RecallResult {
    return { items: this.items };
  }
}
