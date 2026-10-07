/**
 * Test doubles for runners: a manual clock (simulated ms and audio seconds move together), a scripted
 * microphone and an output whose metronome runs the real MetronomeScheduler on the fake clock.
 */

import { Emitter } from '../../audio/engine';
import { type MetronomeConfig, MetronomeScheduler, type ScheduledClick } from '../../audio/metronome';
import type { Job } from '../../audio/worker/protocol';
import { SEED_VOICINGS } from '../../content/voicings';
import { analyzeTiming } from '../../dsp/timing';
import { DETECTOR_VERSION } from '../../dsp/version';
import type {
  ContentContext,
  ExerciseContext,
  ExerciseMic,
  ExerciseOutput,
  ExerciseSettings,
  JudgedEvent,
} from '../types';

export class FakeClock {
  /** Audio seconds; simulated ms = seconds × 1000. */
  t = 10;
  now = (): number => this.t * 1000;
  audio = (): number => this.t;
  advance(seconds: number): void {
    this.t += seconds;
  }
}

export class FakeMic implements ExerciseMic {
  job: Job | null = null;
  readonly jobs: (Job | null)[] = [];
  tunerOn = false;
  tunerTarget: number | null = null;
  readonly judged = new Emitter<JudgedEvent>();
  readonly coarse = new Emitter<number>();
  readonly tuner = new Emitter<{ f0: number | null; stableF0: number | null }>();
  readonly fallbackRequests: { from: number; to: number; expectedF0: number }[] = [];
  fallbackResult: JudgedEvent | null = null;

  setJob(job: Job | null): void {
    this.job = job;
    this.jobs.push(job);
  }
  onJudged(listener: (event: JudgedEvent) => void): () => void {
    return this.judged.on(listener);
  }
  onCoarseOnset(listener: (time: number) => void): () => void {
    return this.coarse.on(listener);
  }
  setTuner(enabled: boolean, expectedF0: number | null): void {
    this.tunerOn = enabled;
    this.tunerTarget = expectedF0;
  }
  onTuner(listener: (reading: { f0: number | null; stableF0: number | null }) => void): () => void {
    return this.tuner.on(listener);
  }
  async pluckFallback(request: {
    from: number;
    to: number;
    expectedF0: number;
  }): Promise<JudgedEvent | null> {
    this.fallbackRequests.push(request);
    return this.fallbackResult;
  }
  async analyzeTiming(request: Parameters<ExerciseMic['analyzeTiming']>[0]) {
    return {
      result: analyzeTiming(
        request.slots,
        request.strumTimes,
        request.rttS,
        request.bpm,
        request.personalOffsetMs,
      ),
      detectorVersion: DETECTOR_VERSION,
      processingMs: 0.5,
    };
  }

  /** Emits a coarse onset and the judged event for it (with the current job kind). */
  strike(time: number, result: unknown, processingMs = 2): void {
    this.coarse.emit(time);
    this.judged.emit({
      time,
      result,
      jobKind: this.job?.kind ?? null,
      detectorVersion: DETECTOR_VERSION,
      processingMs,
    });
  }
}

export class FakeOutput implements ExerciseOutput {
  readonly clicks: ScheduledClick[] = [];
  readonly played: Float32Array[] = [];
  readonly cues: string[] = [];
  private scheduler: MetronomeScheduler | null = null;
  private readonly clickEmitter = new Emitter<ScheduledClick>();
  private readonly endEmitter = new Emitter<number>();
  lastConfig: MetronomeConfig | null = null;
  lastRttMs: number | undefined;

  constructor(private readonly clock: FakeClock) {}

  now = (): number => this.clock.audio();
  readonly metronome = {
    start: async (config: MetronomeConfig, options?: { rttMs?: number }) => {
      this.lastConfig = config;
      this.lastRttMs = options?.rttMs;
      this.scheduler = new MetronomeScheduler(
        { now: () => this.clock.audio() },
        (c) => {
          this.clicks.push(c);
          this.clickEmitter.emit(c);
        },
        { lookaheadS: 0.1, onEnd: (t) => this.endEmitter.emit(t) },
      );
      this.scheduler.start(config, this.clock.audio() + 0.1);
    },
    stop: () => this.scheduler?.stop(),
    setBpm: (bpm: number) => this.scheduler?.setBpm(bpm),
    onClick: (listener: (click: ScheduledClick) => void) => this.clickEmitter.on(listener),
    onEnd: (listener: (time: number) => void) => this.endEmitter.on(listener),
    gridStartTime: () => this.scheduler?.gridStartTime ?? null,
  };
  playSamples(samples: Float32Array): void {
    this.played.push(samples);
  }
  cue(kind: 'end'): void {
    this.cues.push(kind);
  }
  sampleRate(): number {
    return 48000;
  }
  /** Advances the fake clock in 25 ms ticks, running the metronome scheduler. */
  run(clock: FakeClock, seconds: number, onStep?: () => void): void {
    const end = clock.t + seconds;
    while (clock.t < end) {
      clock.advance(0.025);
      this.scheduler?.tick();
      onStep?.();
    }
  }
}

export const TEST_SETTINGS: ExerciseSettings = {
  strictness: 'lenient',
  xStringCheck: false,
  leftHanded: false,
  visualOnlyMetronome: false,
};

export const TEST_CONTENT: ContentContext = {
  voicings: SEED_VOICINGS,
  unlockedChordClasses: ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G'],
  gVoicing: 'G-3f',
  stage: 3,
};

export function testContext(options: { mic?: boolean } = {}): {
  ctx: ExerciseContext;
  clock: FakeClock;
  mic: FakeMic;
  output: FakeOutput;
} {
  const clock = new FakeClock();
  const mic = new FakeMic();
  const output = new FakeOutput(clock);
  const ctx: ExerciseContext = {
    audio: options.mic === false ? null : mic,
    output,
    clock: { now: clock.now },
    content: TEST_CONTENT,
    settings: TEST_SETTINGS,
    personalOffsetMs: null,
  };
  return { ctx, clock, mic, output };
}
