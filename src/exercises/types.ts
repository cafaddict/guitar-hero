/**
 * Exercise plugin contract (SPEC §11.1). The core (session runner, records, charts, routine) never knows
 * exercise types: a plugin bundles params/result schemas, a pure runner, its views and metric extraction.
 * Runners work without a microphone (manual mode) and are unit-tested with a fake clock and scripted events.
 */

import type { ComponentType } from 'react';
import type { z } from 'zod';
import type { MetronomeConfig, ScheduledClick } from '../audio/metronome';
import type { Job } from '../audio/worker/protocol';
import type { GVoicing } from '../content/voicings';
import type { Calibration, MetricSampleInput } from '../domain/records';
import type { ChordVoicing } from '../domain/voicing';
import type { TimingAnalysis, TimingSlot } from '../dsp/timing';
import type { Strictness } from '../dsp/types';

export type RunnerCommand =
  | 'toggle'
  | 'next'
  | 'prev'
  | 'inc'
  | 'dec'
  | 'abort'
  | 'mark'
  | 'manual1'
  | 'manual2'
  | 'manual3';

/**
 * ready: waiting for the user · armed: waiting for the first strum (auto start) · countIn · running ·
 * paused · review: timed part over, user confirms/corrects · done: result can be taken.
 */
export type RunnerPhase = 'ready' | 'armed' | 'countIn' | 'running' | 'paused' | 'review' | 'done';

export interface RunnerSnapshot<V> {
  phase: RunnerPhase;
  /** Remaining simulated ms of the timed part (null = untimed). */
  remainingMs: number | null;
  view: V;
}

export interface DspStats {
  detectorVersion: string | null;
  /** Mean processing time per judged event (0 when no DSP ran). */
  meanProcessingMs: number;
  events: number;
}

export interface ExerciseRunner<R, V> {
  start(): void;
  command(cmd: RunnerCommand): void;
  subscribe(listener: (snapshot: RunnerSnapshot<V>) => void): () => void;
  snapshot(): RunnerSnapshot<V>;
  /** Advances clock-driven state (timers); the UI calls it from requestAnimationFrame. */
  tick(): void;
  finish(): R;
  /**
   * False when nothing worth recording happened (stopped before starting, nothing answered, scoring never ran):
   * the host then stores no Attempt, so aborted runs never become metric samples.
   */
  hasResult(): boolean;
  dspStats(): DspStats;
  dispose(): void;
}

/** A judged onset as runners see it (audio-clock seconds). */
export interface JudgedEvent {
  time: number;
  result: unknown;
  jobKind: Job['kind'] | null;
  detectorVersion: string;
  processingMs: number;
}

export interface TimingRequest {
  slots: readonly TimingSlot[];
  strumTimes: readonly number[];
  rttS: number;
  bpm: number;
  personalOffsetMs: number | null;
}

/** Microphone side of the audio engine. `null` in the context = "no microphone" mode. */
export interface ExerciseMic {
  setJob(job: Job | null): void;
  onJudged(listener: (event: JudgedEvent) => void): () => void;
  /** Low-latency coarse onsets (first-strum auto start, multiple-onset detection). */
  onCoarseOnset(listener: (time: number) => void): () => void;
  setTuner(enabled: boolean, expectedF0: number | null): void;
  onTuner(listener: (reading: { f0: number | null; stableF0: number | null }) => void): () => void;
  /** Mode A fallback over [from, to] (audio s) when the onset detector found nothing. */
  pluckFallback(request: {
    from: number;
    to: number;
    expectedF0: number;
    templateDecayRatio?: number | undefined;
    strictness: Strictness;
  }): Promise<JudgedEvent | null>;
  analyzeTiming(
    request: TimingRequest,
  ): Promise<{ result: TimingAnalysis; detectorVersion: string; processingMs: number }>;
}

/** Output side (always available, also without a microphone). */
export interface ExerciseOutput {
  /** Audio-clock seconds. */
  now(): number;
  metronome: {
    start(config: MetronomeConfig, options?: { rttMs?: number }): Promise<void>;
    stop(): void;
    setBpm(bpm: number): void;
    onClick(listener: (click: ScheduledClick) => void): () => void;
    onEnd(listener: (time: number) => void): () => void;
    gridStartTime(): number | null;
  };
  /** Synth playback ("들어 보기", ear training). Throws while the microphone is judging. */
  playSamples(samples: Float32Array): void;
  /** Short audible cue that is never blocked (e.g. the end of a timed run: two accent clicks). */
  cue(kind: 'end'): void;
  sampleRate(): number;
}

export interface ContentContext {
  voicings: readonly ChordVoicing[];
  /** Chord classes unlocked so far (stage progression; both G voicings are class 'G'). */
  unlockedChordClasses: readonly string[];
  /** The user's current G voicing (SPEC §6.5). */
  gVoicing: GVoicing;
  stage: number;
}

export interface ExerciseSettings {
  strictness: Strictness;
  xStringCheck: boolean;
  leftHanded: boolean;
  visualOnlyMetronome: boolean;
}

export interface ExerciseContext {
  audio: ExerciseMic | null;
  output: ExerciseOutput;
  /** Simulated milliseconds (performance.now() × test rate; rate = 1 in production). */
  clock: { now(): number };
  content: ContentContext;
  calibration?: Calibration | undefined;
  settings: ExerciseSettings;
  /** Personal timing lead/lag (mean of recent runs, ≥ 3) for Mode D correction; null if unknown. */
  personalOffsetMs?: number | null;
}

export interface ExercisePlugin<P, R, V> {
  type: string;
  version: number;
  titleKey: ExerciseTitleKey;
  paramsSchema: z.ZodType<P>;
  resultSchema: z.ZodType<R>;
  defaultParams(ctx: ContentContext): P;
  createRunner(ctx: ExerciseContext, params: P): ExerciseRunner<R, V>;
  View: ComponentType<{ runner: ExerciseRunner<R, V>; params: P; ctx: ExerciseContext }>;
  Summary: ComponentType<{ result: R; params: P }>;
  toMetrics(result: R, params: P): MetricSampleInput[];
  /** Optional: adjusts params from this exercise's most recent results (newest first), e.g. ladder history. */
  withHistory?(params: P, recent: readonly R[]): P;
  /** Optional: the run again at the tempo its summary suggests (ladder up/down, passed → +5), or null. */
  suggestedTempoRetry?(params: P, result: R): { bpm: number; params: P } | null;
  usesMicrophone: boolean;
  migrateResult?(raw: unknown, fromVersion: number): R;
}

export type ExerciseTitleKey =
  | 'E0'
  | 'E1'
  | 'E2'
  | 'E4'
  | 'E5'
  | 'E6'
  | 'E7'
  | 'E8'
  | 'Q1'
  | 'Q2'
  | 'Q3'
  | 'Q4'
  | 'Q5'
  | 'S'
  | 'E3'
  | 'E9'
  | 'E10'
  | 'E11'
  | 'E12'
  | 'E16'
  | 'E17'
  | 'K1';
