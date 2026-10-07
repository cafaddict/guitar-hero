/**
 * E2 one-minute chord changes (SPEC §11.4). Hold chord A and wait ("armed"): the first strum starts the
 * timer (Space also starts). Every arrival at the other chord counts 1 (the first A strum does not).
 * Count modes: auto (Mode C pair classification + change state machine), tap (Enter/pedal = +1), manual
 * (enter the number afterwards). ↑/+ and ↓/− correct the count at any time; detected and corrected counts are
 * both stored. Sound quality is not scored.
 */
import { z } from 'zod';
import { voicingForClass } from '../../content/voicings';
import type { OneMinuteResult } from '../../domain/exerciseResults';
import { pairId } from '../../domain/pairs';
import type { ChordVoicing } from '../../domain/voicing';
import { ChangeCounter, type PairClassification } from '../../dsp/modeC';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

export const e2ParamsSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  durationMs: z.number().int().min(30_000).max(120_000),
  countMode: z.enum(['auto', 'tap', 'manual']),
});
export type E2Params = z.infer<typeof e2ParamsSchema>;

export interface E2View {
  from: string;
  to: string;
  countMode: E2Params['countMode'];
  /** Count shown to the user (auto/tap count plus corrections; manual entry in review). */
  count: number;
  detected: number;
  lowConfidence: number;
  correction: number;
  /** Chord to change to next (the diagram shown). */
  nextChord: string;
  autoStart: boolean;
}

/** Judged strums that happened before the end still count when their judgement arrives late (≤ 0.6 s). */
const LATE_JUDGEMENT_S = 0.6;
/** A run stopped before this much (simulated) time is not recorded: the rate would be meaningless. */
const MIN_RECORDED_MS = 5000;

export class OneMinuteRunner extends BaseRunner<OneMinuteResult, E2View> {
  private readonly countMode: E2Params['countMode'];
  private readonly counter = new ChangeCounter();
  private readonly voicings: [ChordVoicing, ChordVoicing];
  private startAudio: number | null = null;
  private endAudio: number | null = null;
  private taps = 0;
  private correction = 0;
  private corrected = false;
  private manualCount = 0;
  private timeUp = false;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E2Params,
    voicingOf: (id: string) => ChordVoicing,
  ) {
    super(ctx);
    // Auto counting needs the microphone; without it tap counting is the fallback (SPEC §12.3 E2E-12).
    this.countMode = params.countMode === 'auto' && !ctx.audio ? 'tap' : params.countMode;
    this.voicings = [
      voicingOf(voicingForClass(params.from, ctx.content.gVoicing)),
      voicingOf(voicingForClass(params.to, ctx.content.gVoicing)),
    ];
  }

  private get autoStart(): boolean {
    return this.ctx.audio !== null;
  }

  protected view(): E2View {
    const base =
      this.countMode === 'auto'
        ? this.counter.count
        : this.countMode === 'tap'
          ? this.taps
          : this.manualCount;
    const atFrom = this.countMode === 'auto' ? this.counter.currentChord === 0 : base % 2 === 0;
    return {
      from: this.params.from,
      to: this.params.to,
      countMode: this.countMode,
      count: Math.max(0, base + (this.countMode === 'manual' ? 0 : this.correction)),
      detected: this.counter.count,
      lowConfidence: this.counter.held,
      correction: this.correction,
      nextChord: atFrom ? this.params.to : this.params.from,
      autoStart: this.autoStart,
    };
  }

  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(mic.onCoarseOnset((t) => this.onCoarse(t)));
      if (this.countMode === 'auto') {
        this.own(mic.onJudged((e) => this.onJudged(e)));
        mic.setJob({ kind: 'pair', voicings: this.voicings, deltaCents: this.ctx.calibration?.tuningCents });
        this.own(() => mic.setJob(null));
      }
    }
    this.setPhase(this.autoStart ? 'armed' : 'ready');
  }

  private begin(audioTime: number): void {
    this.startAudio = audioTime;
    this.startTimer(this.params.durationMs);
    this.setPhase('running');
  }

  private onCoarse(time: number): void {
    if (this.phase === 'armed') this.begin(time);
  }

  private onJudged(event: JudgedEvent): void {
    if (event.jobKind !== 'pair' || this.startAudio === null) return;
    if (this.phase !== 'running' && this.phase !== 'review') return;
    if (event.time < this.startAudio - 0.05) return;
    if (this.endAudio !== null && event.time > this.endAudio) return;
    this.recordDsp(event);
    const classification = event.result as PairClassification;
    this.counter.push(classification, event.time * 1000);
    this.publish();
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.pauseTimer(); // the played time stops at the abort
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.phase === 'ready' || this.phase === 'armed') {
      if (cmd === 'toggle' || cmd === 'next') this.begin(this.ctx.output.now());
      return;
    }
    if (this.phase === 'running' || this.phase === 'review') {
      if (cmd === 'inc' || cmd === 'dec') {
        const delta = cmd === 'inc' ? 1 : -1;
        if (this.countMode === 'manual') this.manualCount = Math.max(0, this.manualCount + delta);
        else {
          this.correction += delta;
          this.corrected = true;
        }
        this.publish();
        return;
      }
      if (this.phase === 'running' && this.countMode === 'tap' && (cmd === 'next' || cmd === 'mark')) {
        this.taps++;
        this.publish();
        return;
      }
      if (this.phase === 'review' && (cmd === 'next' || cmd === 'toggle')) this.setPhase('done');
    }
  }

  protected override onTimeUp(): void {
    this.timeUp = true;
    this.endAudio = this.ctx.output.now();
    this.ctx.output.cue('end');
    this.setPhase('review');
  }

  /** Played duration: the full minute, or the time until the user stopped early. */
  private playedMs(): number {
    return this.timeUp
      ? this.params.durationMs
      : Math.min(this.params.durationMs, Math.round(this.elapsedMs()));
  }

  hasResult(): boolean {
    return this.startAudio !== null && this.playedMs() >= MIN_RECORDED_MS;
  }

  override tick(): void {
    super.tick();
    // The worker judges a strum ~0.4 s after it; stop listening once those have arrived.
    if (
      this.phase === 'review' &&
      this.endAudio !== null &&
      this.ctx.output.now() > this.endAudio + LATE_JUDGEMENT_S
    ) {
      this.endAudio = Number.NEGATIVE_INFINITY;
    }
  }

  finish(): OneMinuteResult {
    const detected = this.countMode === 'auto' ? this.counter.count : 0;
    const base = this.countMode === 'tap' ? this.taps : detected;
    let correctedChanges: number | null = null;
    if (this.countMode === 'manual') correctedChanges = this.manualCount;
    else if (this.corrected) correctedChanges = Math.max(0, base + this.correction);
    const startMs = (this.startAudio ?? 0) * 1000;
    return {
      pair: pairId(this.params.from, this.params.to),
      direction: `${this.params.from}>${this.params.to}`,
      durationMs: Math.max(1, this.playedMs()),
      countMode: this.countMode,
      detectedChanges: detected,
      correctedChanges,
      tapChanges: this.countMode === 'tap' ? this.taps : null,
      lowConfidenceEvents: this.counter.held,
      changeTimestampsMs: this.counter.changeTimesMs.map((t) => t - startMs),
    };
  }
}
