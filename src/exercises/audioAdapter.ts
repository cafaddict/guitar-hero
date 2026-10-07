/**
 * Binds the exercise contract (ExerciseMic / ExerciseOutput) to the real AudioEngine and MetronomeRuntime.
 */
import type { AudioEngine } from '../audio/engine';
import type { MetronomeRuntime } from '../audio/metronomeRuntime';
import type { PluckFallbackResult } from '../audio/worker/protocol';
import type { ExerciseMic, ExerciseOutput, JudgedEvent } from './types';

/** Seconds of audio the capture ring keeps (the fallback window must fit in it). */
const RING_S = 3.9;

export function createExerciseMic(engine: AudioEngine): ExerciseMic {
  return {
    setJob: (job) => engine.setJob(job),
    onJudged: (listener) =>
      engine.onset.on((o) =>
        listener({
          time: o.time,
          result: o.result,
          jobKind: o.jobKind,
          detectorVersion: o.detectorVersion,
          processingMs: o.processingMs,
        }),
      ),
    onCoarseOnset: (listener) => engine.coarseOnset.on((o) => listener(o.time)),
    setTuner: (enabled, expectedF0) => engine.setTuner(enabled, expectedF0),
    onTuner: (listener) =>
      engine.tuner.on((u) => listener({ f0: u.reading?.f0 ?? null, stableF0: u.stableF0 })),
    async pluckFallback(request): Promise<JudgedEvent | null> {
      const from = Math.max(request.from, request.to - RING_S);
      const outcome = await engine.analyzeRange(from, request.to, {
        kind: 'pluck',
        expectedF0: request.expectedF0,
        ...(request.templateDecayRatio === undefined
          ? {}
          : { templateDecayRatio: request.templateDecayRatio }),
        strictness: request.strictness,
        silent: false,
      });
      const result = outcome.result as PluckFallbackResult | null;
      if (!result) return null;
      return {
        time: from + result.onsetOffset / engine.sampleRate,
        result: result.pluck,
        jobKind: 'pluck',
        detectorVersion: outcome.detectorVersion,
        processingMs: outcome.processingMs,
      };
    },
    analyzeTiming: (request) => engine.analyzeTiming(request),
  };
}

export function createExerciseOutput(engine: AudioEngine, metronome: MetronomeRuntime): ExerciseOutput {
  return {
    now: () => engine.context?.currentTime ?? 0,
    metronome: {
      start: (config, options) => metronome.start(config, options),
      stop: () => metronome.stop(),
      setBpm: (bpm) => metronome.setBpm(bpm),
      onClick: (listener) => metronome.click.on(listener),
      onEnd: (listener) => metronome.end.on(listener),
      gridStartTime: () => metronome.gridStartTime,
    },
    playSamples: (samples) => {
      engine.playSynth(samples);
    },
    cue: () => {
      const now = engine.context?.currentTime ?? 0;
      engine.scheduleClick(now + 0.05, 'accent');
      engine.scheduleClick(now + 0.2, 'accent');
    },
    sampleRate: () => engine.sampleRate,
  };
}
