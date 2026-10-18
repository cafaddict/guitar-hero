/**
 * E5 strumming pattern ladder (SPEC §11.6). One count-in bar, then `bars` bars of the pattern against the
 * metronome; missed strums do not stop anything. Mode D scores strums (judged onset times) against the
 * eighth-note slot grid shifted by the calibrated RTT; strums in rest slots count as extra. Direction is not
 * judged (v2). Ladder: hit rate ≥ 90 % and no miss → +5 BPM; a second run in a row below 70 % → −5 BPM.
 * Without a microphone the user rates the run (1 nothing missed / 2 sometimes missed / 3 often missed).
 * With a microphone the run waits "armed": the first strum (or Space) starts the count-in (SPEC §12.3).
 * P pauses: the interrupted bar is replayed after a one-bar count-in; a paused run is recorded but keeps the
 * ladder where it is (D-085).
 */
import { z } from 'zod';
import { clampBpm, DEFAULT_METRONOME_CONFIG, type MetronomeConfig } from '../../audio/metronome';
import type { Job } from '../../audio/worker/protocol';
import { patternById, patternSlotTimes, type StrumPattern, slotsPerBeat } from '../../content/patterns';
import { voicingById, voicingForClass } from '../../content/voicings';
import { countsForCriteria, type StrumResult } from '../../domain/exerciseResults';
import { barDynamics } from '../../dsp/beta/dynamics';
import type { TimingAnalysis, TimingSlot } from '../../dsp/timing';
import { BaseRunner } from '../baseRunner';
import { GridRecorder } from '../gridRecorder';
import { type BarSlots, barsOf, type LiveBar, settleBars } from '../liveTiming';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e5ParamsSchema = z.object({
  patternId: z.enum(['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']),
  bpm: z.number().int().min(30).max(240),
  bars: z.number().int().min(1).max(32),
  mode: z.enum(['mute', 'single', 'progression']),
  /** Chord classes shown per bar (single = one chord; progression cycles). */
  chords: z.array(z.string()).max(8),
  cuesHidden: z.boolean(),
  /** The previous run of this pattern was below 70 % (two in a row → step down). */
  previousLow: z.boolean(),
  /** Dynamics mode (SPEC v1.1 §11.6, Stage 7): 4 bars soft → 4 bars loud, then a self evaluation. */
  dynamics: z.boolean().optional(),
  /** Palm-mute instruction (Stage 10; judged by the beta detector only). */
  palmMute: z.boolean().optional(),
  /**
   * The ladder's tempo when a "−10 BPM" prescription started (SPEC v1.1 §7.4): a slowed run never lowers the
   * stored ladder below it ("사다리 상태는 보존").
   */
  ladderBase: z.number().int().optional(),
});
export type E5Params = z.infer<typeof e5ParamsSchema>;

export const LADDER_UP_HIT_RATE = 0.9;
export const LADDER_DOWN_HIT_RATE = 0.7;
export const LADDER_STEP_BPM = 5;
/** The ladder only steps up on a full 8-bar run (SPEC §11.6 "8마디"). */
export const LADDER_MIN_BARS = 8;
/** Phases in which bars are judged live (D-077); bars before a pause's cut settle while paused (D-085). */
const LIVE_PHASES: ReadonlySet<string> = new Set(['countIn', 'running', 'paused', 'review']);
/** Self ratings (no microphone): 1 nothing missed, 2 sometimes missed, 3 often missed. */
const SELF_HIT_RATE = { manual1: 1, manual2: 0.8, manual3: 0.5 } as const;

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
  /** Beat number (1-based) under the play head, count-in included (SPEC v1.1 §11.6 "박 번호를 크게"). */
  beat: number | null;
  beatsPerBar: number;
  dynamics: boolean;
  /** Dynamics mode: the current bar is played softly (true) or loudly (false); null outside the bars. */
  soft: boolean | null;
  awaitingDynamics: boolean;
  /** Bars judged so far while playing (microphone only, view-only feedback, D-077). */
  liveBars: readonly LiveBar[];
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

/** The same run at `nextBpm` (the tempo a summary suggests), or null when that is the current tempo. */
/** E5 beta readings summary (stored in StrumResult.beta). */
export type E5Beta = {
  direction: { down: number; up: number; unknown: number };
  palmMuteShare?: number;
  dynamics?: ('soft' | 'loud' | 'even')[];
};

export function tempoRetry<P extends { bpm: number }>(
  params: P,
  nextBpm: number,
): { bpm: number; params: P } | null {
  return nextBpm === params.bpm ? null : { bpm: nextBpm, params: { ...params, bpm: nextBpm } };
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
  // Swing patterns (P7, P8) put the off-beat eighth at t + T·r/(1+r) (§6.10); the chop X is a timed strum.
  return patternSlotTimes(pattern, gridStart, bpm, bars);
}

export class StrumLadderRunner extends BaseRunner<StrumResult, E5View> {
  private readonly pattern: StrumPattern;
  private readonly source: 'mic' | 'self';
  /** Metronome, strum collection (one slot before the grid to one slot after the end) and the settle wait. */
  private readonly recorder: GridRecorder;
  private analyzing = false;
  private analysisFailed = false;
  private analysis: E5View['analysis'] = null;
  private selfRate: number | null = null;
  private position: { bar: number; slot: number } | null = null;
  private countInBeat: number | null = null;
  private cuesHidden: boolean;
  /** The cues were visible at some point while the bars ran (the run then does not count as "hidden"). */
  private cuesShownWhilePlaying = false;
  private dynamicsRating: 1 | 2 | 3 | null = null;
  private liveBars: LiveBar[] = [];
  /** Slot grid of the bars played so far, per segment, and its bars; rebuilt when the timeline changes (D-085). */
  private slotCache: { version: number; slots: TimingSlot[]; bars: BarSlots[] } | null = null;
  /** After a pause: the bar to replay, shown through the resume's count-in (D-085). */
  private replayBar: number | null = null;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E5Params,
  ) {
    super(ctx);
    this.pattern = patternById(params.patternId);
    this.source = ctx.audio ? 'mic' : 'self';
    this.cuesHidden = params.cuesHidden;
    this.recorder = new GridRecorder(
      ctx,
      metronomeFor(this.pattern, params.bpm, params.bars, ctx.settings.visualOnlyMetronome),
      () => {
        this.position = null;
        this.setPhase('review');
      },
      (event) => this.recordDsp(event),
      this.job(),
      { prePadS: this.slotS, postPadS: this.slotS },
    );
  }

  /** Plain onsets plus the beta readings: direction, palm mute (Stage 10), level (dynamics), §10.11. */
  private job(): Job {
    const chord = this.params.mode === 'mute' ? undefined : this.params.chords?.[0];
    return {
      kind: 'onsets',
      beta: {
        direction: true,
        palmMute: this.params.palmMute === true,
        level: this.params.dynamics === true,
        ...(chord ? { voicing: voicingById(voicingForClass(chord, this.ctx.content.gVoicing)) } : {}),
      },
    };
  }

  private get strums(): readonly number[] {
    return this.recorder.strums;
  }

  /** Beta readings per strum (direction, palm-mute probability, level) — "참고(베타)" only (§10.11). */
  private get betaReadings(): { time: number; direction?: string; palmMute?: number; levelDb?: number }[] {
    return this.recorder.events.flatMap((event) => {
      const beta = (
        event.result as { beta?: { direction?: string; palmMute?: number; levelDb?: number } } | null
      )?.beta;
      return beta ? [{ time: event.time, ...beta }] : [];
    });
  }

  private get gridStart(): number | null {
    return this.recorder.gridStart;
  }

  /** The run counts as "visual cues hidden" only when they stayed hidden while the bars ran (§7.6-4, §11.6). */
  private get hiddenThroughout(): boolean {
    return this.cuesHidden && !this.cuesShownWhilePlaying;
  }

  /** Visual cues as recorded for this run (V key, SPEC v1.1 §11.6 / §12.3). */
  effectiveParams(): E5Params {
    return { ...this.params, cuesHidden: this.hiddenThroughout };
  }

  /** The dynamics run asks for a self evaluation after scoring (1 clear / 2 a little / 3 not heard). */
  private get needsDynamics(): boolean {
    return this.params.dynamics === true && this.dynamicsRating === null;
  }

  private get slotS(): number {
    return 60 / this.params.bpm / slotsPerBeat(this.pattern);
  }

  /**
   * Bar and slot sounding `elapsed` seconds after a segment's grid whose first bar is `first` (swing-aware,
   * §6.10).
   */
  private positionAt(elapsed: number, first: number): { bar: number; slot: number } | null {
    if (elapsed < 0) return null;
    const oneBar = slotGrid(this.pattern, this.params.bpm, 1, 0);
    const barS = (this.pattern.slots.length / slotsPerBeat(this.pattern)) * (60 / this.params.bpm);
    const bar = Math.floor(elapsed / barS);
    const within = elapsed - bar * barS;
    let slot = 0;
    while (slot + 1 < oneBar.length && oneBar[slot + 1]!.time <= within) slot++;
    return { bar: first + bar, slot };
  }

  /** The pattern's slots of every bar played so far, each segment on its own grid (D-085). */
  private played(): { slots: TimingSlot[]; bars: BarSlots[] } {
    const timeline = this.recorder.timeline;
    if (this.slotCache?.version !== timeline.version) {
      const slots = timeline.segments.flatMap((segment) =>
        slotGrid(
          this.pattern,
          this.params.bpm,
          Math.min(segment.end ?? this.params.bars, this.params.bars) - segment.first,
          segment.grid,
        ),
      );
      this.slotCache = { version: timeline.version, slots, bars: barsOf(slots, this.pattern.slots.length) };
    }
    return this.slotCache;
  }

  private ladder(): Ladder | null {
    // A paused run is recorded but does not move the ladder (D-085).
    if (this.analysis && !countsForCriteria({ pauses: this.pauses })) return 'stay';
    if (this.analysis)
      return ladderDecision(
        // The ladder and pattern passes use the personal-lead-corrected hit rate (SPEC v1.1 §7.1, §11.6).
        this.analysis.hitRateCorrected,
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
      cuesHidden: this.cuesHidden,
      source: this.source,
      bar: this.position?.bar ?? this.replayBar,
      slot: this.position?.slot ?? null,
      analyzing: this.analyzing,
      analysisFailed: this.analysisFailed,
      awaitingSelf: this.source === 'self' && this.phase === 'review' && this.selfRate === null,
      analysis: this.analysis,
      ladder,
      nextBpm: ladder === null ? null : nextBpmFor(this.params.bpm, ladder),
      beat: this.position
        ? Math.floor(this.position.slot / slotsPerBeat(this.pattern)) + 1
        : this.countInBeat,
      beatsPerBar: this.pattern.slots.length / slotsPerBeat(this.pattern),
      dynamics: this.params.dynamics === true,
      soft:
        this.params.dynamics === true && this.position ? Math.floor(this.position.bar / 4) % 2 === 0 : null,
      awaitingDynamics:
        this.phase === 'review' && this.needsDynamics && (this.analysis !== null || this.selfRate !== null),
      liveBars: this.liveBars,
    };
  }

  start(): void {
    const mic = this.ctx.audio;
    this.own(() => this.recorder.dispose());
    if (mic) {
      this.own(
        mic.onCoarseOnset(() => {
          if (this.phase === 'armed') this.begin();
        }),
      );
      this.own(() => mic.setJob(null));
    }
    this.setPhase(mic ? 'armed' : 'ready');
  }

  /** Count-in and bars start (first strum while armed, Space, or the start button). */
  private begin(): void {
    this.setPhase('countIn');
    this.recorder.start(() => this.publish());
  }

  /** Pause (D-085): the interrupted bar is replayed, its live verdict (and later ones) dropped. */
  protected override pauseTake(): { counted: boolean } | null {
    const outcome = this.recorder.pause(this.ctx.output.now());
    if (outcome.kind === 'ignored') return null;
    this.position = null;
    this.countInBeat = null;
    if (outcome.counted) {
      this.liveBars = this.liveBars.slice(0, outcome.resumeBar);
      this.replayBar = outcome.resumeBar;
    }
    return { counted: outcome.counted };
  }

  protected override resumeTake(): void {
    this.recorder.resume(() => this.publish());
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.recorder.stop();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.handlePause(cmd)) return;
    if (cmd === 'cues' && this.phase !== 'review' && this.phase !== 'done') {
      this.cuesHidden = !this.cuesHidden;
      // Shown while paused counts as shown while playing (the run goes on afterwards, D-085).
      if (!this.cuesHidden && (this.phase === 'running' || this.phase === 'paused'))
        this.cuesShownWhilePlaying = true;
      this.publish();
      return;
    }
    if (this.phase === 'review' && this.needsDynamics && (this.analysis !== null || this.selfRate !== null)) {
      const rating = cmd === 'manual1' ? 1 : cmd === 'manual2' ? 2 : cmd === 'manual3' ? 3 : null;
      if (rating === null) return;
      this.dynamicsRating = rating;
      this.setPhase('done');
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
      if (this.needsDynamics) this.publish();
      else this.setPhase('done');
    }
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    // The segment being played (D-085): after a pause its count-in comes first, on a new grid.
    const open = this.recorder.timeline.open;
    if (open && (this.phase === 'countIn' || this.phase === 'running')) {
      const grid = open.grid;
      if (now >= grid && this.phase === 'countIn') {
        if (!this.cuesHidden) this.cuesShownWhilePlaying = true;
        this.replayBar = null;
        this.setPhase('running');
      }
      if (now < grid) {
        // Count-in: beats of the bar before bar 1 (or the replayed bar), counted aloud too.
        const beatS = 60 / this.params.bpm;
        const beatsPerBar = this.pattern.slots.length / slotsPerBeat(this.pattern);
        const beat = beatsPerBar - Math.ceil((grid - now) / beatS) + 1;
        if (beat !== this.countInBeat) {
          this.countInBeat = beat >= 1 ? beat : null;
          this.publish();
        }
      } else this.countInBeat = null;
      const next = this.positionAt(now - grid, open.first);
      if (next?.bar !== this.position?.bar || next?.slot !== this.position?.slot) {
        this.position = next && next.bar < this.params.bars ? next : null;
        this.publish();
      }
    }
    this.settleLiveBars(now);
    if (
      this.phase === 'review' &&
      this.source === 'mic' &&
      !this.analyzing &&
      !this.analysis &&
      this.recorder.settled(now)
    ) {
      this.score();
    }
  }

  /** Live feedback (D-077): bars whose strums have all been judged, same verdicts as the final analysis. */
  private settleLiveBars(now: number): void {
    if (this.source !== 'mic' || this.gridStart === null || this.analysis !== null) return;
    if (!LIVE_PHASES.has(this.phase)) return;
    const rttS = (this.ctx.calibration?.rttMs ?? 0) / 1000;
    const bars = this.played().bars;
    const settled = settleBars(bars, this.strums, rttS, this.params.bpm, now, this.liveBars);
    if (settled.length === this.liveBars.length) return;
    this.liveBars = settled;
    this.publish();
  }

  private score(): void {
    const mic = this.ctx.audio;
    if (!mic || this.gridStart === null) return;
    this.analyzing = true;
    this.publish();
    void mic
      .analyzeTiming({
        slots: this.played().slots,
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
        if (this.needsDynamics) this.publish();
        else this.setPhase('done');
      })
      .catch(() => {
        this.analyzing = false;
        this.analysisFailed = true;
        this.setPhase('done');
      });
  }

  /** Beta summary (SPEC v1.1 §10.11): down/up counts, palm-mute share, bar dynamics — "참고(베타)", never a metric. */
  betaSummary(): E5Beta {
    const r = this.betaReadings;
    const count = (d: string) => r.filter((x) => x.direction === d).length;
    const out: E5Beta = { direction: { down: count('down'), up: count('up'), unknown: count('unknown') } };
    const palm = r.flatMap((x) => (x.palmMute === undefined ? [] : [x.palmMute]));
    if (palm.length) out.palmMuteShare = palm.filter((p) => p >= 0.5).length / palm.length;
    const levels = r.flatMap((x) => (x.levelDb === undefined ? [] : [x]));
    if (levels.length && this.gridStart !== null) {
      const rtt = (this.ctx.calibration?.rttMs ?? 0) / 1000;
      // The absolute bar on the recording timeline (replayed bars keep their number, D-085); −1 = no bar.
      const barOf = levels.map((x) => {
        const at = this.recorder.timeline.position(x.time - rtt + 0.1);
        return at === null ? -1 : Math.floor(at);
      });
      out.dynamics = barDynamics(
        levels.map((x) => x.levelDb!),
        barOf,
        this.params.bars,
      ).map((b) => b.value);
    }
    return out;
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
    const ladder = this.ladder() ?? 'stay';
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
      cuesHidden: this.hiddenThroughout,
      ladder,
      passed: this.analysis !== null && ladder === 'up',
      source: this.source,
      ...(this.params.dynamics ? { dynamics: { selfRating: this.dynamicsRating } } : {}),
      ...(this.params.palmMute ? { palmMute: true } : {}),
      ...(this.betaReadings.length > 0 ? { beta: this.betaSummary() } : {}),
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
      ...(this.pauses > 0 ? { pauses: this.pauses } : {}),
    };
  }
}
