/**
 * E5 strumming pattern ladder (SPEC §11.6). One count-in bar, then `bars` bars of the pattern against the
 * metronome; missed strums do not stop anything. Mode D scores strums (judged onset times) against the
 * eighth-note slot grid shifted by the calibrated RTT; strums in rest slots count as extra. Direction is not
 * judged (v2). Ladder: hit rate ≥ 90 % and no miss → +5 BPM; a second run in a row below 70 % → −5 BPM.
 * Without a microphone the user rates the run (1 nothing missed / 2 sometimes missed / 3 often missed).
 * With a microphone the run waits "armed": the first strum (or Space) starts the count-in (SPEC §12.3).
 */
import { z } from 'zod';
import { clampBpm, DEFAULT_METRONOME_CONFIG, type MetronomeConfig } from '../../audio/metronome';
import { patternById, type StrumPattern, slotsPerBeat } from '../../content/patterns';
import type { StrumResult } from '../../domain/exerciseResults';
import type { TimingAnalysis, TimingSlot } from '../../dsp/timing';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

export const e5ParamsSchema = z.object({
  patternId: z.enum(['P0', 'P1', 'P2', 'P3', 'P4', 'P5']),
  bpm: z.number().int().min(30).max(240),
  bars: z.number().int().min(1).max(32),
  mode: z.enum(['mute', 'single', 'progression']),
  /** Chord classes shown per bar (single = one chord; progression cycles). */
  chords: z.array(z.string()).max(8),
  cuesHidden: z.boolean(),
  /** The previous run of this pattern was below 70 % (two in a row → step down). */
  previousLow: z.boolean(),
});
export type E5Params = z.infer<typeof e5ParamsSchema>;

export const LADDER_UP_HIT_RATE = 0.9;
export const LADDER_DOWN_HIT_RATE = 0.7;
export const LADDER_STEP_BPM = 5;
/** The ladder only steps up on a full 8-bar run (SPEC §11.6 "8마디"). */
export const LADDER_MIN_BARS = 8;
/** Self ratings (no microphone): 1 nothing missed, 2 sometimes missed, 3 often missed. */
const SELF_HIT_RATE = { manual1: 1, manual2: 0.8, manual3: 0.5 } as const;
/** Judged onsets arrive ~0.4 s after the strum; wait this long after the last bar before scoring. */
const SETTLE_S = 0.7;

export type Ladder = StrumResult['ladder'];

export interface E5View {
  pattern: StrumPattern;
  bpm: number;
  bars: number;
  mode: E5Params['mode'];
  chords: readonly string[];
  cuesHidden: boolean;
  source: 'mic' | 'self';
  /** Current position (null before the grid starts or after the end). */
  bar: number | null;
  slot: number | null;
  analyzing: boolean;
  /** Scoring failed (worker did not answer); nothing is recorded. */
  analysisFailed: boolean;
  awaitingSelf: boolean;
  analysis: Pick<
    TimingAnalysis,
    'hits' | 'misses' | 'extras' | 'hitRate' | 'hitRateCorrected' | 'meanOffsetMs' | 'sdOffsetMs'
  > | null;
  ladder: Ladder | null;
  nextBpm: number | null;
}

export function ladderDecision(
  hitRate: number,
  misses: number,
  previousLow: boolean,
  bars: number = LADDER_MIN_BARS,
): Ladder {
  if (hitRate >= LADDER_UP_HIT_RATE && misses === 0 && bars >= LADDER_MIN_BARS) return 'up';
  if (hitRate < LADDER_DOWN_HIT_RATE && previousLow) return 'down';
  return 'stay';
}

export function nextBpmFor(bpm: number, ladder: Ladder): number {
  if (ladder === 'up') return clampBpm(bpm + LADDER_STEP_BPM);
  if (ladder === 'down') return clampBpm(bpm - LADDER_STEP_BPM);
  return bpm;
}

/** Metronome settings for a pattern: 4/4 clicks on quarters; 6/8 clicks on eighths (accents on 1 and 4). */
export function metronomeFor(
  pattern: StrumPattern,
  bpm: number,
  bars: number,
  visualOnly: boolean,
): MetronomeConfig {
  const sixEight = pattern.timeSignature === '6/8';
  return {
    ...DEFAULT_METRONOME_CONFIG,
    bpm: sixEight ? clampBpm(bpm * 3) : bpm,
    meter: sixEight ? '6/8' : '4/4',
    subdivision: 1,
    countInBars: 1,
    mutedBars: null,
    visualOnly,
    stopAfterBars: bars,
    stopAfterS: null,
  };
}

/** Eighth-note slot grid from the grid origin (bar 0, beat 0). `bpm` is the pattern's beat tempo. */
export function slotGrid(pattern: StrumPattern, bpm: number, bars: number, gridStart: number): TimingSlot[] {
  const slotS = 60 / bpm / slotsPerBeat(pattern);
  const slots: TimingSlot[] = [];
  for (let bar = 0; bar < bars; bar++) {
    pattern.slots.forEach((s, i) => {
      slots.push({ time: gridStart + (bar * pattern.slots.length + i) * slotS, expected: s !== '-' });
    });
  }
  return slots;
}

export class StrumLadderRunner extends BaseRunner<StrumResult, E5View> {
  private readonly pattern: StrumPattern;
  private readonly source: 'mic' | 'self';
  private readonly strums: number[] = [];
  private gridStart: number | null = null;
  private endTime: number | null = null;
  private analyzing = false;
  private analysisFailed = false;
  private analysis: E5View['analysis'] = null;
  private selfRate: number | null = null;
  private position: { bar: number; slot: number } | null = null;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E5Params,
  ) {
    super(ctx);
    this.pattern = patternById(params.patternId);
    this.source = ctx.audio ? 'mic' : 'self';
  }

  private get slotS(): number {
    return 60 / this.params.bpm / slotsPerBeat(this.pattern);
  }

  private ladder(): Ladder | null {
    if (this.analysis)
      return ladderDecision(
        this.analysis.hitRate,
        this.analysis.misses,
        this.params.previousLow,
        this.params.bars,
      );
    return null;
  }

  protected view(): E5View {
    const ladder = this.ladder();
    return {
      pattern: this.pattern,
      bpm: this.params.bpm,
      bars: this.params.bars,
      mode: this.params.mode,
      chords: this.params.chords,
      cuesHidden: this.params.cuesHidden,
      source: this.source,
      bar: this.position?.bar ?? null,
      slot: this.position?.slot ?? null,
      analyzing: this.analyzing,
      analysisFailed: this.analysisFailed,
      awaitingSelf: this.source === 'self' && this.phase === 'review' && this.selfRate === null,
      analysis: this.analysis,
      ladder,
      nextBpm: ladder === null ? null : nextBpmFor(this.params.bpm, ladder),
    };
  }

  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(
        mic.onCoarseOnset(() => {
          if (this.phase === 'armed') this.begin();
        }),
      );
      this.own(() => mic.setJob(null));
      this.own(mic.onJudged((e) => this.onJudged(e)));
    }
    this.setPhase(mic ? 'armed' : 'ready');
  }

  /** Count-in and bars start (first strum while armed, Space, or the start button). */
  private begin(): void {
    this.ctx.audio?.setJob({ kind: 'onsets' });
    const metronome = this.ctx.output.metronome;
    this.own(metronome.onEnd((t) => this.onBarsDone(t)));
    this.own(() => metronome.stop());
    const config = metronomeFor(
      this.pattern,
      this.params.bpm,
      this.params.bars,
      this.ctx.settings.visualOnlyMetronome,
    );
    this.setPhase('countIn');
    void metronome.start(config, { rttMs: this.ctx.calibration?.rttMs ?? 0 }).then(() => {
      this.gridStart = metronome.gridStartTime();
      this.publish();
    });
  }

  private onJudged(event: JudgedEvent): void {
    if (event.jobKind !== 'onsets' || this.gridStart === null) return;
    if (event.time < this.gridStart - this.slotS) return;
    if (this.endTime !== null && event.time > this.endTime + this.slotS) return;
    this.recordDsp(event);
    this.strums.push(event.time);
  }

  private onBarsDone(time: number): void {
    this.endTime = time;
    this.position = null;
    this.setPhase('review');
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.ctx.output.metronome.stop();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if ((this.phase === 'armed' || this.phase === 'ready') && (cmd === 'toggle' || cmd === 'next')) {
      this.begin();
      return;
    }
    if (this.phase === 'review' && this.source === 'self' && this.selfRate === null) {
      const rate = cmd === 'manual1' || cmd === 'manual2' || cmd === 'manual3' ? SELF_HIT_RATE[cmd] : null;
      if (rate === null) return;
      this.selfRate = rate;
      const expected = slotGrid(this.pattern, this.params.bpm, this.params.bars, 0).filter(
        (s) => s.expected,
      ).length;
      const hits = Math.round(rate * expected);
      this.analysis = {
        hits,
        misses: expected - hits,
        extras: 0,
        hitRate: rate,
        hitRateCorrected: rate,
        meanOffsetMs: null,
        sdOffsetMs: null,
      };
      this.setPhase('done');
    }
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    if (this.gridStart !== null && (this.phase === 'countIn' || this.phase === 'running')) {
      if (now >= this.gridStart && this.phase === 'countIn') this.setPhase('running');
      const index = Math.floor((now - this.gridStart) / this.slotS);
      const perBar = this.pattern.slots.length;
      const next = index >= 0 ? { bar: Math.floor(index / perBar), slot: index % perBar } : null;
      if (next?.bar !== this.position?.bar || next?.slot !== this.position?.slot) {
        this.position = next && next.bar < this.params.bars ? next : null;
        this.publish();
      }
    }
    if (
      this.phase === 'review' &&
      this.source === 'mic' &&
      !this.analyzing &&
      !this.analysis &&
      this.endTime !== null &&
      now >= this.endTime + SETTLE_S
    ) {
      this.score();
    }
  }

  private score(): void {
    const mic = this.ctx.audio;
    if (!mic || this.gridStart === null) return;
    this.analyzing = true;
    this.publish();
    void mic
      .analyzeTiming({
        slots: slotGrid(this.pattern, this.params.bpm, this.params.bars, this.gridStart),
        strumTimes: this.strums,
        rttS: (this.ctx.calibration?.rttMs ?? 0) / 1000,
        bpm: this.params.bpm,
        personalOffsetMs: this.ctx.personalOffsetMs ?? null,
      })
      .then((outcome) => {
        this.recordDsp(outcome);
        const r = outcome.result;
        this.analysis = {
          hits: r.hits,
          misses: r.misses,
          extras: r.extras,
          hitRate: r.hitRate,
          hitRateCorrected: r.hitRateCorrected,
          meanOffsetMs: r.meanOffsetMs,
          sdOffsetMs: r.sdOffsetMs,
        };
        this.analyzing = false;
        this.setPhase('done');
      })
      .catch(() => {
        this.analyzing = false;
        this.analysisFailed = true;
        this.setPhase('done');
      });
  }

  /** Only a scored (or self-rated) run is recorded; an aborted or unscored one is not. */
  hasResult(): boolean {
    return this.analysis !== null;
  }

  finish(): StrumResult {
    const a = this.analysis ?? {
      hits: 0,
      misses: 0,
      extras: 0,
      hitRate: 0,
      hitRateCorrected: 0,
      meanOffsetMs: null,
      sdOffsetMs: null,
    };
    const ladder = this.analysis
      ? ladderDecision(a.hitRate, a.misses, this.params.previousLow, this.params.bars)
      : 'stay';
    return {
      patternId: this.params.patternId,
      bpm: this.params.bpm,
      bars: this.params.bars,
      mode: this.params.mode,
      hits: a.hits,
      misses: a.misses,
      extras: a.extras,
      meanOffsetMs: a.meanOffsetMs,
      sdOffsetMs: a.sdOffsetMs,
      hitRate: a.hitRate,
      hitRateCorrected: a.hitRateCorrected,
      cuesHidden: this.params.cuesHidden,
      ladder,
      passed: this.analysis !== null && ladder === 'up',
      source: this.source,
    };
  }
}
