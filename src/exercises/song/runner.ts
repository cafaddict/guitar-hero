/**
 * S practice song (SPEC v1.1 §11.10): chord chart in a bar grid with the current bar highlighted, count-in,
 * metronome, tempo (↑/↓), section loop (L), hidden chart (H), synth "listen" (M). Stages: learn (stop and retry;
 * a section can loop), perform (keep going) and hidden (perform with the chart covered). In perform/hidden with
 * a microphone the beat-1 strums are timed and every run of two or more bars without one counts as a stop;
 * without a microphone the user reports the stops. Afterwards: played to the end, stops, played from memory.
 */
import { z } from 'zod';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import type { PracticeSong } from '../../content/schemas';
import { songById } from '../../content/songs';
import type { SongResult } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import { GridRecorder } from '../gridRecorder';
import type { ExerciseContext, RunnerCommand } from '../types';

export const songParamsSchema = z.object({
  songId: z.string().min(1),
  mode: z.enum(['learn', 'perform']),
  bpm: z.number().int().min(30).max(240),
  chartHidden: z.boolean(),
  /** Learn mode: loop this section index (null = whole song once). */
  loopSection: z.number().int().min(0).nullable(),
});
export type SongParams = z.infer<typeof songParamsSchema>;

export interface ChartBar {
  /** Position in the expanded chart (stable identity of a bar). */
  position: number;
  chord: string;
  section: number;
}

export type SongStageName = 'learn' | 'perform' | 'hidden';

/** Stage of a song run from its mode and chart setting (SPEC v1.1 §11.10). */
export function songStageOf(mode: SongParams['mode'], chartHidden: boolean): SongStageName {
  return mode === 'learn' ? 'learn' : chartHidden ? 'hidden' : 'perform';
}

/** Stops (§11.10): every run of ≥ 2 consecutive bars whose beat-1 strum is missing. */
export function beat1Stops(beat1Hit: readonly boolean[]): number {
  let stops = 0;
  let missing = 0;
  for (const hit of beat1Hit) {
    if (hit) {
      missing = 0;
      continue;
    }
    missing += 1;
    if (missing === 2) stops += 1;
  }
  return stops;
}

export const SONG_TEMPO_STEP = 5;

export interface SongView {
  song: PracticeSong;
  chart: ChartBar[];
  bpm: number;
  mode: SongParams['mode'];
  stage: SongStageName;
  chartHidden: boolean;
  loopSection: number | null;
  /** Index into `chart` (looping sections wrap). */
  bar: number | null;
  report: { completed: boolean; stops: number; memorized: boolean };
  analyzing: boolean;
}

/** Bars with repeats expanded, in playing order. */
export function expandChart(song: PracticeSong): ChartBar[] {
  const bars = song.sections.flatMap((s, section) =>
    Array.from({ length: s.repeat }, () => s.bars.map((chord) => ({ chord, section }))).flat(),
  );
  return bars.map((bar, position) => ({ ...bar, position }));
}

export class SongRunner extends BaseRunner<SongResult, SongView> {
  private readonly song: PracticeSong;
  private readonly chart: ChartBar[];
  private playBars: ChartBar[];
  private barS: number;
  private bpm: number;
  private chartHidden: boolean;
  private loopSection: number | null;
  /** Stops counted from the beat-1 strums (perform/hidden with a microphone). */
  private autoStops: number | null = null;
  /** The chart was visible at some point while playing (the take then is not "hidden"). */
  private chartShownWhilePlaying = false;
  private recorder: GridRecorder | null = null;
  private bar: number | null = null;
  private readonly report = { completed: false, stops: 0, memorized: false };
  private beat1HitRate: number | null = null;
  private analyzing = false;
  private scoreFailed = false;

  constructor(
    ctx: ExerciseContext,
    private readonly params: SongParams,
    /** Synth renderer for "들어 보기" (chords, bpm, beats per bar) → samples; injected so tests stay fast. */
    private readonly renderListen: (
      chords: readonly string[],
      bpm: number,
      beatsPerBar: number,
    ) => Float32Array,
  ) {
    super(ctx);
    this.song = songById(params.songId);
    this.chart = expandChart(this.song);
    this.bpm = params.bpm;
    this.chartHidden = params.chartHidden;
    this.loopSection = params.mode === 'learn' ? params.loopSection : null;
    this.playBars = this.chart;
    this.barS = 0;
    this.layout();
  }

  private layout(): void {
    this.playBars =
      this.loopSection === null ? this.chart : this.chart.filter((b) => b.section === this.loopSection);
    const beats = this.song.timeSignature === '6/8' ? 2 : 4;
    this.barS = (beats * 60) / this.bpm;
  }

  /** The take counts as "hidden" (memorization, §7.6-5, §11.10) only if the chart stayed hidden while playing. */
  private get hiddenThroughout(): boolean {
    return this.chartHidden && !this.chartShownWhilePlaying;
  }

  /** Tempo, chart and loop as recorded for this run (option keys, SPEC v1.1 §12.3). */
  effectiveParams(): SongParams {
    return {
      ...this.params,
      bpm: this.bpm,
      chartHidden: this.hiddenThroughout,
      loopSection: this.loopSection,
    };
  }

  protected view(): SongView {
    const playIndex = this.bar === null ? null : this.bar % this.playBars.length;
    const chartIndex = playIndex === null ? null : this.chart.indexOf(this.playBars[playIndex]!);
    return {
      song: this.song,
      chart: this.chart,
      bpm: this.bpm,
      mode: this.params.mode,
      stage: songStageOf(this.params.mode, this.chartHidden),
      chartHidden: this.chartHidden,
      loopSection: this.loopSection,
      bar: chartIndex,
      report: { ...this.report },
      analyzing: this.analyzing,
    };
  }

  /** With a microphone the song waits "armed": the first strum (or Space) starts the count-in (SPEC §12.3). */
  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(
        mic.onCoarseOnset(() => {
          if (this.phase === 'armed') this.play();
        }),
      );
    }
    this.setPhase(mic ? 'armed' : 'ready');
  }

  /** "들어 보기" (key M): synthesized strums of the bars to play (first 8 bars at most). */
  private listen(): void {
    const beatsPerBar = this.song.timeSignature === '6/8' ? 2 : 4;
    this.ctx.output.playSamples(
      this.renderListen(
        this.playBars.slice(0, 8).map((b) => b.chord),
        this.bpm,
        beatsPerBar,
      ),
    );
  }

  private play(): void {
    if (!this.chartHidden) this.chartShownWhilePlaying = true;
    this.recorder?.dispose();
    this.scoreFailed = false;
    const looping = this.params.mode === 'learn' && this.loopSection !== null;
    const sixEight = this.song.timeSignature === '6/8';
    this.recorder = new GridRecorder(
      this.params.mode === 'perform' ? this.ctx : { ...this.ctx, audio: null },
      {
        ...DEFAULT_METRONOME_CONFIG,
        bpm: sixEight ? this.bpm * 3 : this.bpm,
        meter: sixEight ? '6/8' : '4/4',
        countInBars: 1,
        stopAfterBars: looping ? null : this.playBars.length,
        visualOnly: this.ctx.settings.visualOnlyMetronome,
      },
      () => this.toReview(),
      (event) => this.recordDsp(event),
    );
    this.own(() => this.recorder?.dispose());
    this.setPhase('countIn');
    this.recorder.start(() => this.publish());
  }

  private toReview(): void {
    this.bar = null;
    this.recorder?.stop();
    this.report.completed = this.recorder?.endTime !== null && this.loopSection === null;
    this.setPhase('review');
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.recorder?.stop();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    const waiting = this.phase === 'ready' || this.phase === 'armed';
    if (waiting && (cmd === 'toggle' || cmd === 'next')) {
      this.play();
      return;
    }
    if (cmd === 'hide' && this.phase !== 'review' && this.phase !== 'done') {
      this.chartHidden = !this.chartHidden;
      if (!this.chartHidden && (this.phase === 'countIn' || this.phase === 'running'))
        this.chartShownWhilePlaying = true;
      this.publish();
      return;
    }
    if ((waiting || (this.phase === 'review' && this.params.mode === 'learn')) && cmd === 'loop') {
      if (this.params.mode !== 'learn') return;
      const sections = this.song.sections.length;
      this.loopSection =
        this.loopSection === null ? 0 : this.loopSection + 1 < sections ? this.loopSection + 1 : null;
      this.layout();
      this.publish();
      return;
    }
    if (waiting && (cmd === 'inc' || cmd === 'dec')) {
      const step = cmd === 'inc' ? SONG_TEMPO_STEP : -SONG_TEMPO_STEP;
      this.bpm = Math.min(240, Math.max(this.song.bpmMin, this.bpm + step));
      this.layout();
      this.publish();
      return;
    }
    if (waiting && cmd === 'mark') {
      this.listen();
      return;
    }
    // Learn mode: "stop and try again" — Space in the review starts the song (or loop) over.
    if (this.phase === 'review' && this.params.mode === 'learn' && cmd === 'toggle') {
      this.play();
      return;
    }
    if ((this.phase === 'running' || this.phase === 'countIn') && cmd === 'toggle') {
      // Learn mode: stopping is fine (counted as a stop); perform mode ends the take.
      if (this.params.mode === 'learn') this.report.stops++;
      this.toReview();
      return;
    }
    if (this.phase !== 'review') return;
    if (cmd === 'manual1') this.report.completed = !this.report.completed;
    else if (cmd === 'manual2') this.report.memorized = !this.report.memorized;
    else if (cmd === 'inc') this.report.stops++;
    else if (cmd === 'dec') this.report.stops = Math.max(0, this.report.stops - 1);
    else if ((cmd === 'next' || (cmd === 'toggle' && this.params.mode === 'perform')) && !this.analyzing) {
      this.setPhase('done');
      return;
    }
    this.publish();
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    const grid = this.recorder?.gridStart ?? null;
    if (grid !== null && (this.phase === 'countIn' || this.phase === 'running')) {
      if (this.phase === 'countIn' && now >= grid) this.setPhase('running');
      const bar = now >= grid ? Math.floor((now - grid) / this.barS) : null;
      if (bar !== this.bar) {
        this.bar = bar;
        this.publish();
      }
    }
    const mic = this.ctx.audio;
    const rec = this.recorder;
    if (
      mic &&
      rec &&
      grid !== null &&
      this.params.mode === 'perform' &&
      this.phase === 'review' &&
      this.beat1HitRate === null &&
      !this.analyzing &&
      !this.scoreFailed &&
      rec.settled(now)
    ) {
      this.analyzing = true;
      const bars = Math.max(
        1,
        Math.min(this.playBars.length, Math.round(((rec.endTime ?? now) - grid) / this.barS)),
      );
      void mic
        .analyzeTiming({
          slots: Array.from({ length: bars }, (_, b) => ({ time: grid + b * this.barS, expected: true })),
          strumTimes: rec.strums,
          rttS: rec.rttS,
          bpm: this.bpm,
          personalOffsetMs: this.ctx.personalOffsetMs ?? null,
        })
        .then((outcome) => {
          this.recordDsp(outcome);
          this.beat1HitRate = outcome.result.hitRate;
          // A bar is "played" when its beat-1 strum hit; the user can still correct the count (↑/↓).
          this.autoStops = beat1Stops(outcome.result.judgements.map((j) => j === 'hit'));
          this.report.stops = this.autoStops;
          this.analyzing = false;
          this.publish();
        })
        .catch(() => {
          // Without the beat-1 measurement the self-report is still recorded.
          this.analyzing = false;
          this.scoreFailed = true;
          this.publish();
        });
    }
  }

  /** Recorded once the song was played (at least the count-in started). */
  hasResult(): boolean {
    return this.recorder !== null;
  }

  finish(): SongResult {
    return {
      songId: this.song.id,
      mode: this.params.mode,
      stage: songStageOf(this.params.mode, this.hiddenThroughout),
      chartHidden: this.hiddenThroughout,
      bpm: this.bpm,
      completed: this.report.completed,
      stops: this.report.stops,
      memorized: this.report.memorized,
      beat1HitRate: this.beat1HitRate,
      chordCorrectRatio: null,
      backingOn: false,
      backingAudible: false,
      ...(this.ctx.audio ? {} : { memorizedSelfReport: this.report.memorized }),
    };
  }
}
