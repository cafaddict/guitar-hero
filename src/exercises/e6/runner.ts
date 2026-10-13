/**
 * E6 change on beat 1 (SPEC v1.1 §11.7): one chord per bar, the pattern is strummed and the chord changes on
 * the next bar's first beat. Mode D measures the beat-1 strum of every bar (delay vs grid + RTT) and finds bars
 * with no strum at all (a stop). Rule: ≥ 14 of 16 bars inside the window and no stop → +5 BPM. With a
 * microphone every strum is also classified among the progression's chords (Mode C), and each bar that changes
 * chord is checked as a two-way choice "this bar's chord vs the previous one" (research 01:315).
 */
import { z } from 'zod';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import { patternById } from '../../content/patterns';
import { voicingById, voicingForClass } from '../../content/voicings';
import type { OneBeatResult } from '../../domain/exerciseResults';
import type { SetClassification } from '../../dsp/modeC';
import { timingWindowMs } from '../../dsp/timing';
import { BaseRunner } from '../baseRunner';
import { GridRecorder } from '../gridRecorder';
import { judgeBeatOne, type LiveBar } from '../liveTiming';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

/**
 * Bar `b` changes chord: did its beat-1 strum sound more like this bar's chord ('right') than the previous one
 * ('wrong')? null when the bar keeps its chord or no classified strum landed on beat 1 (research 01:315).
 */
export function barChordVerdict(
  progression: readonly string[],
  chords: readonly string[],
  events: readonly JudgedEvent[],
  gridStart: number,
  barS: number,
  b: number,
  rttS: number,
  windowS: number,
): 'right' | 'wrong' | null {
  if (b < 1) return null;
  const chord = progression[b % progression.length]!;
  const previous = progression[(b - 1) % progression.length]!;
  if (chord === previous) return null;
  const at = gridStart + b * barS + rttS;
  const event = events
    .filter((e) => Math.abs(e.time - at) <= windowS)
    .sort((x, y) => Math.abs(x.time - at) - Math.abs(y.time - at))[0];
  const scores = (event?.result as SetClassification | null | undefined)?.scores;
  if (!scores) return null;
  return scores[chords.indexOf(chord)]! > scores[chords.indexOf(previous)]! ? 'right' : 'wrong';
}

/**
 * Share of chord-changing bars whose beat-1 strum sounded more like this bar's chord than the previous one
 * (null when no such bar was heard). `chords` are the classification candidates (classes, distinct).
 */
export function chordCorrectRatio(
  progression: readonly string[],
  chords: readonly string[],
  events: readonly JudgedEvent[],
  gridStart: number,
  barS: number,
  bars: number,
  rttS: number,
  windowS: number,
): number | null {
  const verdicts = Array.from({ length: bars }, (_, b) =>
    barChordVerdict(progression, chords, events, gridStart, barS, b, rttS, windowS),
  ).filter((v) => v !== null);
  return verdicts.length === 0 ? null : verdicts.filter((v) => v === 'right').length / verdicts.length;
}

export const e6ParamsSchema = z.object({
  progression: z.array(z.string().min(1)).min(2).max(8),
  patternId: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  bpm: z.number().int().min(30).max(240),
  bars: z.number().int().min(4).max(32),
  /**
   * The ladder's tempo when a "−10 BPM" prescription started (SPEC v1.1 §7.4): a slowed run never lowers the
   * stored ladder below it ("사다리 상태는 보존").
   */
  ladderBase: z.number().int().optional(),
});
export type E6Params = z.infer<typeof e6ParamsSchema>;

/** Share of bars that must start on time (14 of 16). */
export const ONE_BEAT_PASS_RATIO = 14 / 16;

export interface E6View {
  progression: readonly string[];
  bpm: number;
  bars: number;
  bar: number | null;
  chord: string | null;
  nextChord: string | null;
  analyzing: boolean;
  awaitingSelf: boolean;
  /** Bars judged so far while playing: beat 1 on time, late/early or a stop, and the chord (D-077). */
  liveBars: readonly LiveBar[];
}

/** Bars (0-based) with no onset anywhere in [bar start − window, next bar start − window). */
export function stoppedBars(
  strums: readonly number[],
  gridStart: number,
  barS: number,
  bars: number,
  windowS: number,
): number[] {
  const stops: number[] = [];
  for (let b = 0; b < bars; b++) {
    const from = gridStart + b * barS - windowS;
    const to = gridStart + (b + 1) * barS - windowS;
    if (!strums.some((t) => t >= from && t < to)) stops.push(b);
  }
  return stops;
}

export class OneBeatRunner extends BaseRunner<OneBeatResult, E6View> {
  private readonly recorder: GridRecorder;
  private readonly barS: number;
  private bar: number | null = null;
  private analyzing = false;
  private outcome: Omit<OneBeatResult, 'progression' | 'patternId' | 'bpm' | 'bars' | 'source'> | null = null;
  /** Distinct chord classes of the progression (Mode C candidates). */
  private readonly chords: string[];
  private liveBars: LiveBar[] = [];

  constructor(
    ctx: ExerciseContext,
    private readonly params: E6Params,
  ) {
    super(ctx);
    patternById(params.patternId);
    this.barS = (4 * 60) / params.bpm;
    this.chords = [...new Set(params.progression)];
    const voicings = this.chords.map((c) => voicingById(voicingForClass(c, ctx.content.gVoicing)));
    this.recorder = new GridRecorder(
      ctx,
      {
        ...DEFAULT_METRONOME_CONFIG,
        bpm: params.bpm,
        meter: '4/4',
        countInBars: 1,
        stopAfterBars: params.bars,
        visualOnly: ctx.settings.visualOnlyMetronome,
      },
      () => {
        this.bar = null;
        this.setPhase('review');
      },
      (event) => this.recordDsp(event),
      this.chords.length >= 2
        ? { kind: 'set', voicings, deltaCents: ctx.calibration?.tuningCents }
        : { kind: 'onsets' },
    );
  }

  protected view(): E6View {
    const chord =
      this.bar === null ? null : this.params.progression[this.bar % this.params.progression.length]!;
    const nextChord =
      this.bar === null
        ? this.params.progression[0]!
        : this.params.progression[(this.bar + 1) % this.params.progression.length]!;
    return {
      progression: this.params.progression,
      bpm: this.params.bpm,
      bars: this.params.bars,
      bar: this.bar,
      chord,
      nextChord,
      analyzing: this.analyzing,
      awaitingSelf: !this.ctx.audio && this.phase === 'review',
      liveBars: this.liveBars,
    };
  }

  /** Live feedback (D-077): each bar's beat 1 as soon as it can be judged, the same rules as the summary. */
  private settleLiveBars(now: number, grid: number): void {
    if (!this.ctx.audio || this.outcome !== null) return;
    const rttS = this.recorder.rttS;
    const windowS = timingWindowMs(this.params.bpm) / 1000;
    let changed = false;
    for (let b = this.liveBars.length; b < this.params.bars; b++) {
      const judged = judgeBeatOne({
        bar: b,
        gridStart: grid,
        barS: this.barS,
        strums: this.recorder.strums,
        rttS,
        bpm: this.params.bpm,
        now,
      });
      if (!judged) break;
      const chord =
        this.chords.length >= 2
          ? barChordVerdict(
              this.params.progression,
              this.chords,
              this.recorder.events,
              grid,
              this.barS,
              b,
              rttS,
              windowS,
            )
          : null;
      this.liveBars = [...this.liveBars, { ...judged, chord }];
      changed = true;
    }
    if (changed) this.publish();
  }

  /** With a microphone the run waits "armed": the first strum (or Space) starts the count-in (SPEC §12.3). */
  start(): void {
    this.own(() => this.recorder.dispose());
    const mic = this.ctx.audio;
    if (mic) {
      this.own(
        mic.onCoarseOnset(() => {
          if (this.phase === 'armed') this.begin();
        }),
      );
    }
    this.setPhase(mic ? 'armed' : 'ready');
  }

  private begin(): void {
    this.setPhase('countIn');
    this.recorder.start(() => this.publish());
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.recorder.stop();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if ((this.phase === 'armed' || this.phase === 'ready') && (cmd === 'toggle' || cmd === 'next')) {
      this.begin();
      return;
    }
    if (this.phase !== 'review' || this.ctx.audio) return;
    const bars = this.params.bars;
    const self = {
      manual1: { inWindow: bars, stops: 0 },
      manual2: { inWindow: bars - 2, stops: 0 },
      manual3: { inWindow: bars - 4, stops: 1 },
    } as const;
    if (cmd !== 'manual1' && cmd !== 'manual2' && cmd !== 'manual3') return;
    const pick = self[cmd];
    this.outcome = this.summarize(pick.inWindow, pick.stops, null);
    this.setPhase('done');
  }

  private summarize(barsInWindow: number, stops: number, delay: number | null) {
    const bars = this.params.bars;
    return {
      barsInWindow,
      stops,
      beat1DelayMsMean: delay,
      missingBarRatio: (bars - barsInWindow) / bars,
      passed: barsInWindow >= Math.ceil(bars * ONE_BEAT_PASS_RATIO) && stops === 0,
    };
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    const grid = this.recorder.gridStart;
    if (grid !== null && (this.phase === 'countIn' || this.phase === 'running')) {
      if (this.phase === 'countIn' && now >= grid) this.setPhase('running');
      const bar = now >= grid ? Math.floor((now - grid) / this.barS) : null;
      if (bar !== this.bar && (bar === null || bar < this.params.bars)) {
        this.bar = bar;
        this.publish();
      }
    }
    if (grid !== null && this.phase !== 'done') this.settleLiveBars(now, grid);
    const mic = this.ctx.audio;
    if (
      mic &&
      grid !== null &&
      this.phase === 'review' &&
      !this.analyzing &&
      !this.outcome &&
      this.recorder.settled(now)
    ) {
      this.analyzing = true;
      this.publish();
      const slots = Array.from({ length: this.params.bars }, (_, b) => ({
        time: grid + b * this.barS,
        expected: true,
      }));
      void mic
        .analyzeTiming({
          slots,
          strumTimes: this.recorder.strums,
          rttS: this.recorder.rttS,
          bpm: this.params.bpm,
          personalOffsetMs: this.ctx.personalOffsetMs ?? null,
        })
        .then((outcome) => {
          this.recordDsp(outcome);
          const windowS = timingWindowMs(this.params.bpm) / 1000;
          const stops = stoppedBars(
            this.recorder.strums.map((t) => t - this.recorder.rttS),
            grid,
            this.barS,
            this.params.bars,
            windowS,
          ).length;
          this.outcome = {
            ...this.summarize(outcome.result.hits, stops, outcome.result.meanOffsetMs),
            chordCorrectRatio: chordCorrectRatio(
              this.params.progression,
              this.chords,
              this.recorder.events,
              grid,
              this.barS,
              this.params.bars,
              this.recorder.rttS,
              windowS,
            ),
          };
          this.analyzing = false;
          this.setPhase('done');
        })
        .catch(() => {
          // Scoring failed: end without a result (nothing is recorded).
          this.analyzing = false;
          this.setPhase('done');
        });
    }
  }

  /** Only a scored (or self-rated) run is recorded. */
  hasResult(): boolean {
    return this.outcome !== null;
  }

  finish(): OneBeatResult {
    const o = this.outcome ?? this.summarize(0, this.params.bars, null);
    return {
      progression: [...this.params.progression],
      patternId: this.params.patternId,
      bpm: this.params.bpm,
      bars: this.params.bars,
      ...o,
      source: this.ctx.audio ? 'mic' : 'self',
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
    };
  }
}
