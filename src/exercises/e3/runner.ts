/**
 * E3 precise fast change (SPEC v1.1 §11.11, 01:292–296). Like E2 the first strum starts the timer. At every
 * arrival the player strums slowly (or arpeggiates) to check every string, then marks it: Enter/pedal = clean,
 * ↓ = not clean (muted or buzzing). An arrival left unmarked counts as not clean. With a microphone the arrivals
 * are the Mode C change state machine (E2's rule) and each shows Mode B as "참고(베타)"; without one every Enter
 * or ↓ is an arrival. Score: clean changes per minute and clean rate; pass = clean rate ≥ 0.8 and ≥ 20/min.
 */
import { z } from 'zod';
import { voicingForClass } from '../../content/voicings';
import type { PfcResult } from '../../domain/exerciseResults';
import { pairId } from '../../domain/pairs';
import type { ChordVoicing } from '../../domain/voicing';
import type { StrumResult as StrumVerdict } from '../../dsp/modeB';
import { ChangeCounter, type PairClassification } from '../../dsp/modeC';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

export const e3ParamsSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  durationMs: z.number().int().min(60_000).max(120_000).default(60_000),
});
export type E3Params = z.infer<typeof e3ParamsSchema>;

export type ArrivalMark = 'clean' | 'unclean' | null;

export interface E3View {
  from: string;
  to: string;
  arrivals: number;
  clean: number;
  /** The latest arrival's mark (null = not marked yet) and its Mode B verdict (beta). */
  lastMark: ArrivalMark;
  lastStrumBeta: 'PASS' | 'FAIL' | 'RETRY' | null;
  nextChord: string;
  autoStart: boolean;
  source: 'mic' | 'self';
}

const MIN_RECORDED_MS = 5000;

export class PfcRunner extends BaseRunner<PfcResult, E3View> {
  private readonly counter = new ChangeCounter();
  private readonly voicings: [ChordVoicing, ChordVoicing];
  private readonly marks: ArrivalMark[] = [];
  private readonly strumBeta: ('PASS' | 'FAIL' | 'RETRY')[] = [];
  private startAudio: number | null = null;
  private timeUp = false;
  private readonly source: 'mic' | 'self';

  constructor(
    ctx: ExerciseContext,
    private readonly params: E3Params,
    voicingOf: (id: string) => ChordVoicing,
  ) {
    super(ctx);
    this.source = ctx.audio ? 'mic' : 'self';
    this.voicings = [
      voicingOf(voicingForClass(params.from, ctx.content.gVoicing)),
      voicingOf(voicingForClass(params.to, ctx.content.gVoicing)),
    ];
  }

  protected view(): E3View {
    const arrivals = this.marks.length;
    return {
      from: this.params.from,
      to: this.params.to,
      arrivals,
      clean: this.marks.filter((m) => m === 'clean').length,
      lastMark: this.marks.at(-1) ?? null,
      lastStrumBeta: this.strumBeta.at(-1) ?? null,
      nextChord: arrivals % 2 === 0 ? this.params.to : this.params.from,
      autoStart: this.source === 'mic',
      source: this.source,
    };
  }

  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(mic.onCoarseOnset((t) => this.phase === 'armed' && this.begin(t)));
      this.own(mic.onJudged((e) => this.onJudged(e)));
      mic.setJob({ kind: 'pfc', voicings: this.voicings, deltaCents: this.ctx.calibration?.tuningCents });
      this.own(() => mic.setJob(null));
    }
    this.setPhase(this.source === 'mic' ? 'armed' : 'ready');
  }

  private begin(audioTime: number): void {
    this.startAudio = audioTime;
    this.startTimer(this.params.durationMs);
    this.setPhase('running');
  }

  private onJudged(event: JudgedEvent): void {
    if (event.jobKind !== 'pfc' || this.phase !== 'running' || this.startAudio === null) return;
    if (event.time < this.startAudio - 0.05) return;
    this.recordDsp(event);
    const { pair, strum } = event.result as { pair: PairClassification; strum: StrumVerdict | null };
    if (this.counter.push(pair, event.time * 1000)) {
      // A new arrival: unmarked until Enter or ↓.
      this.marks.push(null);
      this.strumBeta.push(strum?.verdict ?? 'RETRY');
    }
    this.publish();
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.pauseTimer();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if ((this.phase === 'ready' || this.phase === 'armed') && (cmd === 'toggle' || cmd === 'next')) {
      this.begin(this.ctx.output.now());
      return;
    }
    if (this.phase === 'running') {
      const mark: ArrivalMark = cmd === 'next' || cmd === 'mark' ? 'clean' : cmd === 'dec' ? 'unclean' : null;
      if (mark === null) return;
      if (this.source === 'self') this.marks.push(mark);
      else {
        // Marks the latest arrival not marked yet (an arrival is marked once).
        const k = this.marks.lastIndexOf(null);
        if (k >= 0) this.marks[k] = mark;
      }
      this.publish();
      return;
    }
    if (this.phase === 'review' && (cmd === 'next' || cmd === 'toggle')) this.setPhase('done');
  }

  protected override onTimeUp(): void {
    this.timeUp = true;
    this.pauseTimer();
    this.ctx.output.cue('end');
    this.setPhase('review');
  }

  private playedMs(): number {
    return this.timeUp && this.remainingMs() === 0
      ? this.params.durationMs
      : Math.min(this.params.durationMs, Math.round(this.elapsedMs()));
  }

  hasResult(): boolean {
    return this.startAudio !== null && this.playedMs() >= MIN_RECORDED_MS;
  }

  finish(): PfcResult {
    return {
      pair: pairId(this.params.from, this.params.to),
      direction: `${this.params.from}>${this.params.to}`,
      durationMs: Math.max(1, this.playedMs()),
      arrivals: this.marks.length,
      cleanArrivals: this.marks.filter((m) => m === 'clean').length,
      source: this.source,
      ...(this.source === 'mic' ? { strumBeta: [...this.strumBeta] } : {}),
    };
  }
}
