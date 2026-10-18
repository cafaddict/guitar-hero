/**
 * Metronome-grid recording used by the Mode D exercises (E6, E8): starts the metronome with the calibrated
 * RTT (click masking), collects judged strum/pick onsets around the grid, and reports when the last bar has
 * ended and late judgements (~0.4 s after each onset) have settled.
 *
 * Pause/resume (D-085): a pause stops the metronome and closes the timeline segment at the bar to replay; the
 * resume counts in one bar and continues from there on a new grid. The worker job stays on through the pause
 * (judgements arrive ~0.4–0.7 s after the strum and are tagged with the job then): instead, every event is kept
 * only inside a segment's time window, so late events of the bars before the cut still count while the
 * replayed bar's and the gap's do not.
 */
import { beatsPerBar, type MetronomeConfig } from '../audio/metronome';
import type { Job } from '../audio/worker/protocol';
import { timingWindowMs } from '../dsp/timing';
import { Timeline } from './timeline';
import type { ExerciseContext, JudgedEvent } from './types';

/** Judged onsets arrive ~0.4 s after the strum; wait this long after the last bar before scoring. */
export const SETTLE_S = 0.7;

export interface GridRecorderOptions {
  /** Events kept before each segment's first downbeat (default 0.3 s). */
  prePadS?: number;
  /** Events kept after the metronome's end (default 0.3 s). */
  postPadS?: number;
  /** Judging window: an event this close before the replayed bar's downbeat (+ RTT) is its own (default ±window). */
  windowS?: number;
  /** A pause this soon after a downbeat also replays the bar before (default one beat). */
  graceS?: number;
}

export type PauseOutcome =
  | { kind: 'ignored' }
  /** `counted`: false for a pause in a count-in (nothing of the segment was played, D-085). */
  | { kind: 'paused'; resumeBar: number; counted: boolean };

export class GridRecorder {
  /** Bars played so far, one segment per stretch between pauses (D-085). */
  readonly timeline: Timeline;
  private readonly strumList: number[] = [];
  private readonly eventList: JudgedEvent[] = [];
  endTime: number | null = null;
  private readonly disposers: (() => void)[] = [];
  private readonly prePadS: number;
  private readonly postPadS: number;
  private readonly windowS: number;
  private readonly graceS: number;
  /** Bumped when a pending metronome start must not open its segment any more (pause, dispose). */
  private epoch = 0;
  /** A metronome start was requested and its grid is not known yet. */
  private starting = false;
  private started = false;

  constructor(
    private readonly ctx: ExerciseContext,
    private readonly config: MetronomeConfig,
    private readonly onBarsDone: () => void,
    private readonly onEvent: (event: JudgedEvent) => void = () => {},
    /** Worker job for the strums: plain onsets, or a closed-set classification that also yields onsets. */
    private job: Job = { kind: 'onsets' },
    options: GridRecorderOptions = {},
  ) {
    const beatS = 60 / config.bpm;
    this.timeline = new Timeline(beatsPerBar(config.meter) * beatS);
    this.prePadS = options.prePadS ?? 0.3;
    this.postPadS = options.postPadS ?? 0.3;
    this.windowS = options.windowS ?? timingWindowMs(config.bpm) / 1000;
    this.graceS = options.graceS ?? beatS;
  }

  private disposed = false;

  /** Onset times kept so far (pruned in place by a pause). */
  get strums(): readonly number[] {
    return this.strumList;
  }

  /** The judged events behind `strums` (same order), e.g. Mode C classifications for a chord check. */
  get events(): readonly JudgedEvent[] {
    return this.eventList;
  }

  /** Grid of the first segment: bar 0's downbeat (null before it is known). */
  get gridStart(): number | null {
    return this.timeline.segments[0]?.grid ?? null;
  }

  /** Grid of the segment being played or counted in (null while paused and before the first grid). */
  get currentGrid(): number | null {
    return this.timeline.open?.grid ?? null;
  }

  /** Bars of the whole take (null = until stopped). */
  get totalBars(): number | null {
    return this.config.stopAfterBars;
  }

  /** Replaces the job mid-take (same kind, e.g. the song backing mask once its bleed gain is known). */
  updateJob(job: Job): void {
    if (job.kind !== this.job.kind) throw new Error('updateJob keeps the job kind');
    // A late async update (e.g. the bleed gain) must not re-arm the job after the take was left.
    if (this.disposed) return;
    this.job = job;
    this.ctx.audio?.setJob(job);
  }

  get rttS(): number {
    return (this.ctx.calibration?.rttMs ?? 0) / 1000;
  }

  start(onGrid: () => void): void {
    if (this.started) return;
    this.started = true;
    const mic = this.ctx.audio;
    if (mic) {
      mic.setJob(this.job);
      this.disposers.push(
        () => mic.setJob(null),
        mic.onJudged((e) => this.collect(e)),
      );
    }
    const metronome = this.ctx.output.metronome;
    this.disposers.push(
      metronome.onEnd((t) => {
        this.endTime = t;
        const open = this.timeline.open;
        if (open) this.timeline.close(Math.round(this.timeline.position(t) ?? open.first));
        this.onBarsDone();
      }),
      () => metronome.stop(),
    );
    this.launch(this.config, 0, onGrid);
  }

  /**
   * Pause at `now` (D-085): the metronome stops and the bar to replay is returned. Ignored once the last bar is
   * over (the end is on its way) or with nothing to pause. In a count-in nothing was played: its segment is
   * dropped and the pause is not counted. Otherwise the interrupted bar is replayed — or the one before, when the
   * pause came within `graceS` of a downbeat — and the events already kept for it are dropped.
   */
  pause(now: number): PauseOutcome {
    if (!this.started || this.disposed || this.endTime !== null) return { kind: 'ignored' };
    const open = this.timeline.open;
    if (!open && !this.starting) return { kind: 'ignored' };
    const total = this.totalBars;
    const scheduledEnd = total === null ? null : this.timeline.start(total);
    if (open && scheduledEnd !== null && now >= scheduledEnd) return { kind: 'ignored' };
    this.epoch++;
    this.starting = false;
    this.ctx.output.metronome.stop();
    if (!open || now < open.grid) {
      this.timeline.discardOpen();
      this.prune();
      return { kind: 'paused', resumeBar: this.timeline.nextUnit, counted: false };
    }
    const at = this.timeline.position(now - this.graceS);
    const resumeBar = Math.max(open.first, Math.floor(at ?? open.first));
    this.timeline.close(resumeBar);
    this.prune();
    return { kind: 'paused', resumeBar, counted: true };
  }

  /** Continues after a pause: one count-in bar, then the bars left from the replayed one on. */
  resume(onGrid: () => void): void {
    if (!this.started || this.disposed || this.endTime !== null || this.starting || this.timeline.open)
      return;
    const first = this.timeline.nextUnit;
    const total = this.totalBars;
    this.launch(
      { ...this.config, countInBars: 1, stopAfterBars: total === null ? null : total - first },
      first,
      onGrid,
    );
  }

  private launch(config: MetronomeConfig, first: number, onGrid: () => void): void {
    const metronome = this.ctx.output.metronome;
    const epoch = ++this.epoch;
    this.starting = true;
    void metronome.start(config, { rttMs: this.ctx.calibration?.rttMs ?? 0 }).then(() => {
      // Paused, restarted or left while the audio context was starting: that start is not this take's.
      if (this.disposed || epoch !== this.epoch) return;
      this.starting = false;
      const grid = metronome.gridStartTime();
      if (grid === null) return;
      this.timeline.begin(grid, first);
      onGrid();
    });
  }

  /** Where events are kept, per segment: from just before its grid to its cut (or the end, or open). */
  private keptWindows(): { from: number; to: number }[] {
    const segments = this.timeline.segments;
    return segments.map((s, i) => {
      const from = s.grid - this.prePadS;
      if (s.end === null) return { from, to: Number.POSITIVE_INFINITY };
      if (i === segments.length - 1 && this.endTime !== null)
        return { from, to: this.endTime + this.postPadS };
      // Cut by a pause: the replayed bar's events (its downbeat window on the recording timeline) are not kept.
      const cut = s.grid + (s.end - s.first) * this.timeline.unitS;
      return { from, to: cut + this.rttS - this.windowS };
    });
  }

  private kept(time: number, windows: readonly { from: number; to: number }[]): boolean {
    return windows.some((w) => time >= w.from && time <= w.to);
  }

  private prune(): void {
    const windows = this.keptWindows();
    let n = 0;
    for (let i = 0; i < this.eventList.length; i++) {
      const event = this.eventList[i]!;
      if (!this.kept(event.time, windows)) continue;
      this.eventList[n] = event;
      this.strumList[n] = this.strumList[i]!;
      n++;
    }
    this.eventList.length = n;
    this.strumList.length = n;
  }

  private collect(event: JudgedEvent): void {
    if (event.jobKind !== this.job.kind || !this.kept(event.time, this.keptWindows())) return;
    this.strumList.push(event.time);
    this.eventList.push(event);
    this.onEvent(event);
  }

  /** True once the bars are over and late judgements had time to arrive. */
  settled(now: number): boolean {
    return this.endTime !== null && now >= this.endTime + SETTLE_S;
  }

  stop(): void {
    this.ctx.output.metronome.stop();
  }

  dispose(): void {
    this.disposed = true;
    for (const d of this.disposers.splice(0)) d();
  }
}
