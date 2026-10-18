/**
 * Runs the pure MetronomeScheduler against the real audio clock: a Ticker wakes it up, audible clicks are
 * scheduled on the engine at their exact grid times, and the expected click arrivals (time + RTT) are handed
 * to the capture worklet so leaked clicks are not mistaken for strums (SPEC §8.4 "판정기와 공유").
 */
import { Emitter } from './engine';
import { type ClickLevel, type MetronomeConfig, MetronomeScheduler, type ScheduledClick } from './metronome';
import { createTicker, type Ticker } from './ticker/ticker';

export interface MetronomeOutput {
  ensureContext(): Promise<{ readonly currentTime: number }>;
  scheduleClick(time: number, level: ClickLevel): void;
  setClickTimes(times: readonly number[]): void;
}

/** A click whose time passed more than this long ago is not played (a stalled tab would otherwise burst). */
const LATE_PLAY_LIMIT_S = 0.05;
const RECENT_LIMIT = 64;
const MASK_LIMIT = 8;

export class MetronomeRuntime {
  readonly click = new Emitter<ScheduledClick>();
  readonly end = new Emitter<number>();
  readonly running = new Emitter<boolean>();
  private scheduler: MetronomeScheduler | null = null;
  private ticker: Ticker | null = null;
  private clock: { readonly currentTime: number } | null = null;
  private recent: ScheduledClick[] = [];
  private rttS = 0;
  /** Bumped by stop(): a start still awaiting the audio context is cancelled by a stop in between (D-085). */
  private generation = 0;

  constructor(
    private readonly output: MetronomeOutput,
    private readonly tickerFactory: () => Ticker = createTicker,
  ) {}

  get isRunning(): boolean {
    return this.scheduler?.isRunning ?? false;
  }

  get gridStartTime(): number | null {
    return this.scheduler?.gridStartTime ?? null;
  }

  get bpm(): number | null {
    return this.scheduler?.bpm ?? null;
  }

  /** Clicks scheduled so far (latest RECENT_LIMIT), sorted by time; read by the visual pulse. */
  recentClicks(): readonly ScheduledClick[] {
    return this.recent;
  }

  /** `startDelayS`: lead time before the first click (lets the UI settle; must cover the lookahead). */
  async start(
    config: MetronomeConfig,
    options: { rttMs?: number; startDelayS?: number } = {},
  ): Promise<void> {
    this.stop();
    const generation = this.generation;
    const clock = await this.output.ensureContext();
    if (generation !== this.generation) return;
    this.clock = clock;
    this.rttS = (options.rttMs ?? 0) / 1000;
    this.recent = [];
    const ticker = this.tickerFactory();
    this.ticker = ticker;
    const scheduler = new MetronomeScheduler({ now: () => clock.currentTime }, (c) => this.onClick(c), {
      lookaheadS: ticker.lookaheadS,
      onEnd: (t) => {
        this.stop();
        this.end.emit(t);
      },
    });
    this.scheduler = scheduler;
    scheduler.start(config, clock.currentTime + (options.startDelayS ?? 0.15));
    ticker.start(() => scheduler.tick());
    this.running.emit(true);
  }

  stop(): void {
    this.generation++;
    const wasRunning = this.scheduler !== null;
    this.ticker?.stop();
    this.ticker = null;
    this.scheduler?.stop();
    this.scheduler = null;
    this.output.setClickTimes([]);
    if (wasRunning) this.running.emit(false);
  }

  setBpm(bpm: number): void {
    this.scheduler?.setBpm(bpm);
  }

  setSound(update: Pick<MetronomeConfig, 'visualOnly' | 'mutedBars'>): void {
    this.scheduler?.setSound(update);
  }

  private onClick(click: ScheduledClick): void {
    const now = this.clock?.currentTime ?? 0;
    if (click.audible && now - click.time <= LATE_PLAY_LIMIT_S)
      this.output.scheduleClick(click.time, click.level);
    this.recent.push(click);
    if (this.recent.length > RECENT_LIMIT) this.recent.shift();
    if (click.audible) {
      const masks = this.recent
        .filter((c) => c.audible)
        .slice(-MASK_LIMIT)
        .map((c) => c.time + this.rttS);
      this.output.setClickTimes(masks);
    }
    this.click.emit(click);
  }
}
