/**
 * Fret-buzz suspicion (SPEC v1.1 §10.11, beta). Buzz leaves broadband energy *between* the partials. Fixed
 * notches at the expected partials do not work above 2 kHz: a low string's partials there are only f0 apart
 * and the unknown stiffness B moves them by tens of cents, so ±30-cent notches would cover the whole band.
 * The partials are removed instead by taking the spectral floor (a low percentile of the 2–8 kHz bins, which
 * peaks never reach). The floor rise over the pre-onset noise, relative to the note's level, is compared with
 * the player's clean-sound template when one exists (02:224–225).
 */
import { magnitudeSpectrum, msToSamples } from '../spectrum';
import { type BetaResult, beta } from './types';

export interface BuzzParams {
  startMs: number;
  lengthMs: number;
  /** Percentile of the 2–8 kHz bin energies taken as the floor between partials. */
  floorPercentile: number;
  bandLoHz: number;
  bandHiHz: number;
  /** Residual ratio of a clean note when no template is given (dev split). */
  defaultTemplate: number;
  /** log10(residual / template) that maps to score 0 and 1. */
  logLo: number;
  logHi: number;
  /** Score ≥ this → "버징 의심". */
  suspectScore: number;
}

export const DEFAULT_BUZZ_PARAMS: BuzzParams = {
  startMs: 20,
  lengthMs: 200,
  floorPercentile: 0.3,
  bandLoHz: 2000,
  bandHiHz: 8000,
  defaultTemplate: 1e-3,
  logLo: 0,
  logHi: 0.5,
  suspectScore: 0.6,
};

export interface BuzzInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  /** Expected f0 (with calibration δ). */
  f0: number;
  /** The player's clean residual ratio for this note (calibration), if known. */
  template?: number;
  params?: BuzzParams;
}

/** Low-percentile bin energy of 2–8 kHz (the floor between partials) and the total 60 Hz–8 kHz energy. */
function floorParts(input: BuzzInput, start: number, p: BuzzParams): { floor: number; total: number } {
  const fs = input.sampleRate;
  const spec = magnitudeSpectrum(input.samples, start, msToSamples(p.lengthMs, fs), fs, 1);
  const band: number[] = [];
  let total = 0;
  for (let k = 1; k < spec.mag.length; k++) {
    const hz = k * spec.binHz;
    if (hz < 60 || hz > p.bandHiHz) continue;
    const e = spec.mag[k]! * spec.mag[k]!;
    total += e;
    if (hz >= p.bandLoHz) band.push(e);
  }
  band.sort((a, b) => a - b);
  const floor = band.length ? band[Math.floor(p.floorPercentile * (band.length - 1))]! * band.length : 0;
  return { floor, total };
}

/** Floor rise between the partials (pre-onset noise removed) ÷ the note's total energy. */
export function buzzResidual(input: BuzzInput): number {
  const p = input.params ?? DEFAULT_BUZZ_PARAMS;
  const fs = input.sampleRate;
  const post = floorParts(input, input.onsetSample + msToSamples(p.startMs, fs), p);
  const pre = floorParts(input, input.onsetSample - msToSamples(20 + p.lengthMs, fs), p);
  return Math.max(0, post.floor - pre.floor) / Math.max(1e-20, post.total - pre.total);
}

/** Buzz suspicion score 0..1 (beta). `value` ≥ suspectScore → suspected buzz. */
export function buzzScore(input: BuzzInput): BetaResult<number> & { residual: number; suspected: boolean } {
  const p = input.params ?? DEFAULT_BUZZ_PARAMS;
  const residual = buzzResidual(input);
  const template = input.template ?? p.defaultTemplate;
  const x = Math.log10((residual + 1e-12) / Math.max(1e-12, template));
  const score = Math.max(0, Math.min(1, (x - p.logLo) / (p.logHi - p.logLo)));
  return { ...beta(score, Math.abs(score - 0.5) * 2), residual, suspected: score >= p.suspectScore };
}
