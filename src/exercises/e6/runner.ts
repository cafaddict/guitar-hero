/**
 * E6 change on beat 1 (SPEC §11.7): one chord per bar, the pattern is strummed and the chord changes on the
 * next bar's first beat. Mode D measures the beat-1 strum of every bar (delay vs grid + RTT) and finds bars
 * with no strum at all (a stop). Rule: ≥ 14 of 16 bars inside the window and no stop → +5 BPM.
 */
import { z } from 'zod';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import { patternById } from '../../content/patterns';
import type { OneBeatResult } from '../../domain/exerciseResults';
import { timingWindowMs } from '../../dsp/timing';
import { BaseRunner } from '../baseRunner';
import { GridRecorder } from '../gridRecorder';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e6ParamsSchema = z.object({
  progression: z.array(z.string().min(1)).min(2).max(8),
  patternId: z.enum(['P0', 'P1', 'P2', 'P3', 'P4']),
  bpm: z.number().int().min(30).max(240),
  bars: z.number().int().min(4).max(32),
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

  constructor(
    ctx: ExerciseContext,
    private readonly params: E6Params,
  ) {
    super(ctx);
    patternById(params.patternId);
    this.barS = (4 * 60) / params.bpm;
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
    };
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
          this.outcome = this.summarize(outcome.result.hits, stops, outcome.result.meanOffsetMs);
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
    };
  }
}
