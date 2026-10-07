/**
 * Metronome scheduling core (SPEC §8.4, "A Tale of Two Clocks"). Pure: the audio clock and the click sink are
 * injected, so the scheduler is tested with a fake clock and a jittery timer.
 *
 * Every click time is computed from an anchor (time, beat index) of the current tempo segment rather than by
 * adding durations, so ten minutes of scheduling has no accumulated rounding error. A tempo change re-anchors
 * at the next beat that has not been scheduled yet: already-scheduled clicks never move.
 */

export type Meter = '4/4' | '3/4' | '6/8';
export type Subdivision = 1 | 2 | 3 | 4;

export const MIN_BPM = 30;
export const MAX_BPM = 240;

export interface MetronomeConfig {
  bpm: number;
  meter: Meter;
  subdivision: Subdivision;
  /** Count-in bars before bar 0 (excluded from measurement). */
  countInBars: 0 | 1 | 2;
  /** Every `play` audible bars are followed by `mute` silent bars (grid continues). */
  mutedBars: { play: number; mute: number } | null;
  /** No sound at all, only the visual pulse (prevents clicks leaking into the microphone). */
  visualOnly: boolean;
  /** Stop after this many bars (after the count-in). */
  stopAfterBars: number | null;
  /** Stop this many seconds after bar 0. */
  stopAfterS: number | null;
}

export const DEFAULT_METRONOME_CONFIG: MetronomeConfig = {
  bpm: 60,
  meter: '4/4',
  subdivision: 1,
  countInBars: 1,
  mutedBars: null,
  visualOnly: false,
  stopAfterBars: null,
  stopAfterS: null,
};

export type ClickLevel = 'accent' | 'beat' | 'sub';

export interface ScheduledClick {
  /** Audio-clock time (s), exactly on the grid. */
  time: number;
  /** Sequential click number since start (0, 1, 2, …). */
  index: number;
  /** Bar number: count-in bars are negative, the first measured bar is 0. */
  bar: number;
  beat: number;
  sub: number;
  level: ClickLevel;
  countIn: boolean;
  /** Bar silenced by the muted-bars setting (still part of the grid). */
  muted: boolean;
  /** Whether a sound should be played (false for visual-only and muted bars). */
  audible: boolean;
  bpm: number;
}

export function beatsPerBar(meter: Meter): number {
  return meter === '4/4' ? 4 : meter === '3/4' ? 3 : 6;
}

export function clampBpm(bpm: number): number {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** 6/8 is felt in two groups of three eighths: beat 3 gets a secondary accent (louder beat click). */
function levelOf(meter: Meter, beat: number, sub: number): ClickLevel {
  if (sub > 0) return 'sub';
  if (beat === 0) return 'accent';
  return meter === '6/8' && beat !== 3 ? 'sub' : 'beat';
}

export interface SchedulerClock {
  /** Current audio-clock time in seconds. */
  now(): number;
}

export interface SchedulerOptions {
  lookaheadS: number;
  onEnd?: (endTime: number) => void;
}

export class MetronomeScheduler {
  private config: MetronomeConfig = DEFAULT_METRONOME_CONFIG;
  private running = false;
  /** False once the stop condition is reached: no more clicks, but `onEnd` still waits for the end time. */
  private scheduling = false;
  private anchorTime = 0;
  private anchorBeat = 0;
  private beatDur = 1;
  private nextBeat = 0;
  private nextSub = 0;
  private nextIndex = 0;
  private pendingBpm: number | null = null;
  private gridStart = 0;
  private endTime: number | null = null;
  private ended = false;

  constructor(
    private readonly clock: SchedulerClock,
    private readonly sink: (click: ScheduledClick) => void,
    private readonly options: SchedulerOptions,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  get currentConfig(): MetronomeConfig {
    return this.config;
  }

  /** Time of bar 0, beat 0 (after the count-in) — the measurement grid origin. */
  get gridStartTime(): number {
    return this.gridStart;
  }

  get bpm(): number {
    return this.pendingBpm ?? this.config.bpm;
  }

  start(config: MetronomeConfig, startAt: number = this.clock.now() + 0.1): void {
    this.config = { ...config, bpm: clampBpm(config.bpm) };
    this.running = true;
    this.scheduling = true;
    this.ended = false;
    this.anchorTime = startAt;
    this.anchorBeat = 0;
    this.beatDur = 60 / this.config.bpm;
    this.nextBeat = 0;
    this.nextSub = 0;
    this.nextIndex = 0;
    this.pendingBpm = null;
    const countInBeats = this.config.countInBars * beatsPerBar(this.config.meter);
    this.gridStart = startAt + countInBeats * this.beatDur;
    this.endTime = this.config.stopAfterS !== null ? this.gridStart + this.config.stopAfterS : null;
    this.tick();
  }

  stop(): void {
    this.running = false;
    this.scheduling = false;
    this.pendingBpm = null;
  }

  /** Tempo change: takes effect from the next beat that has not been scheduled yet. */
  setBpm(bpm: number): void {
    this.pendingBpm = clampBpm(bpm);
    if (!this.running) this.config = { ...this.config, bpm: this.pendingBpm };
  }

  /** Visual-only and muted-bar settings apply to every click not yet scheduled. */
  setSound(update: Pick<MetronomeConfig, 'visualOnly' | 'mutedBars'>): void {
    this.config = { ...this.config, ...update };
  }

  private beatTime(beat: number): number {
    return this.anchorTime + (beat - this.anchorBeat) * this.beatDur;
  }

  private applyPendingTempo(): void {
    if (this.pendingBpm === null || this.nextSub !== 0) return;
    // Count-in beats keep the original tempo so the grid origin stays where it was announced.
    if (this.nextBeat < this.config.countInBars * beatsPerBar(this.config.meter)) return;
    this.anchorTime = this.beatTime(this.nextBeat);
    this.anchorBeat = this.nextBeat;
    this.beatDur = 60 / this.pendingBpm;
    this.config = { ...this.config, bpm: this.pendingBpm };
    this.pendingBpm = null;
  }

  /** Called by the timer: schedules every click inside [now, now + lookahead) (late ones keep grid times). */
  tick(): void {
    if (!this.running) return;
    const now = this.clock.now();
    const horizon = now + this.options.lookaheadS;
    const perBar = beatsPerBar(this.config.meter);
    while (this.scheduling) {
      this.applyPendingTempo();
      const time = this.beatTime(this.nextBeat) + (this.nextSub * this.beatDur) / this.config.subdivision;
      if (time >= horizon) break;
      const bar = Math.floor(this.nextBeat / perBar) - this.config.countInBars;
      const stopByBars = this.config.stopAfterBars !== null && bar >= this.config.stopAfterBars;
      const stopByTime = this.endTime !== null && time >= this.endTime - 1e-9;
      if (stopByBars || stopByTime) {
        if (stopByBars && (this.endTime === null || time < this.endTime)) this.endTime = time;
        this.scheduling = false;
        break;
      }
      const countIn = bar < 0;
      const cycle = this.config.mutedBars ? this.config.mutedBars.play + this.config.mutedBars.mute : 0;
      const muted =
        !countIn && this.config.mutedBars !== null && cycle > 0 && bar % cycle >= this.config.mutedBars.play;
      const beat = this.nextBeat % perBar;
      this.sink({
        time,
        index: this.nextIndex++,
        bar,
        beat,
        sub: this.nextSub,
        level: levelOf(this.config.meter, beat, this.nextSub),
        countIn,
        muted,
        audible: !this.config.visualOnly && !muted,
        bpm: 60 / this.beatDur,
      });
      this.nextSub++;
      if (this.nextSub >= this.config.subdivision) {
        this.nextSub = 0;
        this.nextBeat++;
      }
    }
    this.checkEnd(now);
  }

  private checkEnd(now: number): void {
    if (this.ended || this.endTime === null || now < this.endTime) return;
    this.ended = true;
    this.running = false;
    this.options.onEnd?.(this.endTime);
  }
}

/** Tap tempo (SPEC §8.4): mean of the last 4 intervals; 2 s without a tap starts over. */
export class TapTempo {
  private taps: number[] = [];

  /** `nowMs` from performance.now(); returns the BPM once two taps exist. */
  tap(nowMs: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && nowMs - last > 2000) this.taps = [];
    this.taps.push(nowMs);
    if (this.taps.length > 5) this.taps.shift();
    if (this.taps.length < 2) return null;
    const intervals = this.taps.slice(1).map((t, i) => t - this.taps[i]!);
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return clampBpm(60_000 / mean);
  }

  reset(): void {
    this.taps = [];
  }
}

export interface TempoLadder {
  startBpm: number;
  targetBpm: number;
  stepBpm: number;
}

/** Tempo ladder step: up by `stepBpm` after a passed round (capped at the target); unchanged otherwise. */
export function nextLadderBpm(ladder: TempoLadder, currentBpm: number, passed: boolean): number {
  if (!passed) return currentBpm;
  const up = ladder.targetBpm >= ladder.startBpm;
  const next = currentBpm + (up ? ladder.stepBpm : -ladder.stepBpm);
  return clampBpm(up ? Math.min(next, ladder.targetBpm) : Math.max(next, ladder.targetBpm));
}

/**
 * Visual pulse: the most recent click whose time has passed (`clicks` sorted by time). The pulse is drawn
 * from requestAnimationFrame by comparing with the audio clock, never from timer callbacks.
 */
export function latestPassedClick(clicks: readonly ScheduledClick[], now: number): ScheduledClick | null {
  let lo = 0;
  let hi = clicks.length - 1;
  let found: ScheduledClick | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const click = clicks[mid]!;
    if (click.time <= now) {
      found = click;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}
