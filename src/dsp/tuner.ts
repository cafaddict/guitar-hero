/**
 * Tuner (SPEC §9.2): MPM over ~85 ms frames (4096 @ 48 kHz), octave guard via sub-harmonic evidence,
 * harmonic-regression refinement (removes string inharmonicity bias), stability = 5 consecutive frames
 * within ±3 cents of their median. String mode restricts the search to the expected note.
 */
import { midiToHz } from '../domain/theory';
import { mpm, refineHarmonic } from './pitch';
import { magnitudeSpectrum, msToSamples, partialPeak, rms, type Spectrum } from './spectrum';

export interface TunerParams {
  frameMs: number;
  hopMs: number;
  stableFrames: number;
  stableCents: number;
  minClarity: number;
  minHz: number;
  maxHz: number;
  /** Prefer f/2 when odd half-harmonics are within this many dB of the integer harmonics. */
  subharmonicDb: number;
  /** Skip frames with an attack inside: first-quarter RMS more than this many dB below the last quarter. */
  maxRiseDb: number;
}

export const DEFAULT_TUNER_PARAMS: TunerParams = {
  frameMs: (4096 / 48000) * 1000,
  hopMs: (512 / 48000) * 1000,
  stableFrames: 5,
  stableCents: 3,
  minClarity: 0.8,
  minHz: 70,
  maxHz: 1400,
  subharmonicDb: -12,
  maxRiseDb: 6,
};

export interface TunerReading {
  f0: number;
  /** Nearest equal-tempered MIDI note. */
  midi: number;
  /** Deviation from that note in cents. */
  cents: number;
  clarity: number;
}

export type TunerMode = { kind: 'chromatic' } | { kind: 'string'; expectedF0: number };

function harmonicMean(spec: Spectrum, f: number, multiples: readonly number[]): number {
  let s = 0;
  for (const m of multiples) s += partialPeak(spec, f * m, 30).mag;
  return s / multiples.length;
}

/** Single-frame pitch reading (null when the frame is not clearly periodic). */
export function tunerFrame(
  samples: ArrayLike<number>,
  start: number,
  sampleRate: number,
  mode: TunerMode,
  params: TunerParams = DEFAULT_TUNER_PARAMS,
): TunerReading | null {
  const length = msToSamples(params.frameMs, sampleRate);
  // A frame that still contains the pluck's attack (or the silence before it) gives a biased reading.
  const quarter = Math.floor(length / 4);
  const head = rms(samples, start, start + quarter);
  const tail = rms(samples, start + length - quarter, start + length);
  if (tail > 0 && 20 * Math.log10((tail + 1e-12) / (head + 1e-12)) > params.maxRiseDb) return null;
  const lo = mode.kind === 'string' ? mode.expectedF0 / 1.5 : params.minHz;
  const hi = mode.kind === 'string' ? mode.expectedF0 * 1.5 : params.maxHz;
  const est = mpm(samples, start, length, sampleRate, lo, hi, { restricted: mode.kind === 'string', k: 0.9 });
  if (!est || est.clarity < params.minClarity) return null;
  const spec = magnitudeSpectrum(samples, start, length, sampleRate, 4);
  let coarse = est.f0;
  if (mode.kind === 'chromatic' && coarse / 2 >= params.minHz * 0.95) {
    const half = coarse / 2;
    const odd = harmonicMean(spec, half, [1, 3, 5]);
    const even = harmonicMean(spec, half, [2, 4, 6]);
    if (20 * Math.log10((odd + 1e-12) / (even + 1e-12)) > params.subharmonicDb) coarse = half;
  }
  const fit = refineHarmonic(spec, coarse, { maxPartials: 12, maxHz: 5000 });
  const f0 = fit.partialsUsed > 0 && Math.abs(1200 * Math.log2(fit.f0 / coarse)) < 50 ? fit.f0 : coarse;
  const midiFloat = 69 + 12 * Math.log2(f0 / 440);
  const midi = Math.round(midiFloat);
  return { f0, midi, cents: 1200 * Math.log2(f0 / midiToHz(midi)), clarity: est.clarity };
}

/** Tracks consecutive readings and reports stability (SPEC §9.2: 5 frames within ±3 cents). */
export class TunerStability {
  private readonly recent: number[] = [];

  constructor(private readonly params: TunerParams = DEFAULT_TUNER_PARAMS) {}

  /** Returns the stable frequency (median of the window) or null. */
  push(reading: TunerReading | null): number | null {
    if (!reading) {
      this.recent.length = 0;
      return null;
    }
    this.recent.push(reading.f0);
    if (this.recent.length > this.params.stableFrames) this.recent.shift();
    if (this.recent.length < this.params.stableFrames) return null;
    const sorted = [...this.recent].sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1]!;
    const within = this.recent.every(
      (f) => Math.abs(1200 * Math.log2(f / median)) <= this.params.stableCents,
    );
    return within ? median : null;
  }

  reset(): void {
    this.recent.length = 0;
  }
}

export interface TuningAnalysis {
  stableF0: number | null;
  /** Time from the onset to the end of the frame that made the reading stable (ms). */
  timeToStableMs: number | null;
}

/**
 * Offline: runs the tuner from `startSample` (frame by frame, like the live tuner) until it becomes stable or
 * `maxMs` after `referenceSample` (the pluck) has passed. Time-to-stable is measured from `referenceSample`.
 */
export function analyzeTuning(
  samples: ArrayLike<number>,
  sampleRate: number,
  startSample: number,
  mode: TunerMode,
  maxMs = 2000,
  params: TunerParams = DEFAULT_TUNER_PARAMS,
  referenceSample = startSample,
): TuningAnalysis {
  const length = msToSamples(params.frameMs, sampleRate);
  const hop = (params.hopMs / 1000) * sampleRate;
  const stability = new TunerStability(params);
  for (let i = 0; ; i++) {
    const start = Math.round(startSample + i * hop);
    const end = start + length;
    if (end > samples.length || end - referenceSample > (maxMs / 1000) * sampleRate) break;
    const stable = stability.push(tunerFrame(samples, start, sampleRate, mode, params));
    if (stable !== null)
      return { stableF0: stable, timeToStableMs: ((end - referenceSample) / sampleRate) * 1000 };
  }
  return { stableF0: null, timeToStableMs: null };
}
