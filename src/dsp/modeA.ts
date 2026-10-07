/**
 * Mode A — single-string pluck verification (SPEC §10.5), the v1 core judgement.
 *
 * 1. Pitch in [+30, +130 ms]: restricted MPM frames (range f0/1.5..f0·1.5) + harmonic refinement.
 * 2. cents = 1200·log2(f/f0); |cents| ≤ tol → note OK; near another semitone → WRONG_NOTE(semitones).
 * 3. Low clarity or level near the noise → WEAK (retry, not scored).
 * 4. Decay ratio "RMS[+250..350]/RMS[+30..80]" measured on the target's harmonic bands with the
 *    pre-onset spectrum subtracted (robust to noise and to previously plucked strings still ringing);
 *    far below the string's calibrated ratio (or the global default) → MUTED.
 */
import { mpm, refineHarmonic } from './pitch';
import { magnitudeSpectrum, msToSamples, partialPeak, peakAbs, type Spectrum } from './spectrum';
import {
  CLIP_LEVEL,
  type DspResultBase,
  type RetryReason,
  type Strictness,
  type StringStatus,
  type Verdict,
} from './types';
import { DETECTOR_VERSION } from './version';

export interface ModeAParams {
  pitchStartMs: number;
  pitchEndMs: number;
  pitchFrameMs: number;
  pitchHopMs: number;
  clarityMin: number;
  toleranceCents: Record<Strictness, number>;
  /** Early harmonic power must exceed the pre-onset power by this much (dB). */
  minLevelDb: number;
  /** MUTED when ratio < template × mutedTemplateFactor, or < mutedGlobalRatio without a template. */
  mutedTemplateFactor: Record<Strictness, number>;
  mutedGlobalRatio: Record<Strictness, number>;
  decayPartials: number;
}

export const DEFAULT_MODE_A_PARAMS: ModeAParams = {
  pitchStartMs: 30,
  pitchEndMs: 130,
  pitchFrameMs: (2048 / 48000) * 1000,
  pitchHopMs: (512 / 48000) * 1000,
  clarityMin: 0.85,
  toleranceCents: { lenient: 35, normal: 30, strict: 25 },
  minLevelDb: 10,
  mutedTemplateFactor: { lenient: 0.25, normal: 0.3, strict: 0.35 },
  mutedGlobalRatio: { lenient: 0.1, normal: 0.12, strict: 0.15 },
  decayPartials: 8,
};

export interface PluckInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  /** Onset index inside `samples` (from the onset detector). */
  onsetSample: number;
  /** Expected f0 including the calibration offset δ. */
  expectedF0: number;
  /** Calibrated normal decay ratio for this string, if any. */
  templateDecayRatio?: number | undefined;
  strictness?: Strictness;
  params?: ModeAParams;
}

export interface PluckResult extends DspResultBase {
  status: StringStatus;
  verdict: Verdict;
  f0: number | null;
  cents: number | null;
  semitones: number | null;
  clarity: number;
  decayRatio: number | null;
  levelDb: number;
}

function harmonicPower(spec: Spectrum, f0: number, partials: number): number {
  let p = 0;
  for (let h = 1; h <= partials; h++) {
    const f = h * f0 * Math.sqrt(1 + 5e-5 * h * h);
    if (f > 5000) break;
    const m = partialPeak(spec, f, 30).mag;
    p += m * m;
  }
  return p;
}

/** Harmonic-band power in [startMs, endMs) after the onset minus the same-length pre-onset power. */
function bandPower(
  input: PluckInput,
  f0: number,
  startMs: number,
  endMs: number,
  partials: number,
): { signal: number; pre: number } {
  const fs = input.sampleRate;
  const len = msToSamples(endMs - startMs, fs);
  const post = magnitudeSpectrum(input.samples, input.onsetSample + msToSamples(startMs, fs), len, fs, 2);
  const pre = magnitudeSpectrum(input.samples, input.onsetSample - msToSamples(20, fs) - len, len, fs, 2);
  return { signal: harmonicPower(post, f0, partials), pre: harmonicPower(pre, f0, partials) };
}

/** Median pitch over restricted MPM frames, then harmonic refinement on the whole window. */
export function measurePitch(input: PluckInput, params: ModeAParams): { f0: number | null; clarity: number } {
  const fs = input.sampleRate;
  const frame = msToSamples(params.pitchFrameMs, fs);
  const hop = msToSamples(params.pitchHopMs, fs);
  const start = input.onsetSample + msToSamples(params.pitchStartMs, fs);
  const end = input.onsetSample + msToSamples(params.pitchEndMs, fs);
  const lo = input.expectedF0 / 1.5;
  const hi = input.expectedF0 * 1.5;
  const estimates: { f0: number; clarity: number }[] = [];
  for (let s = start; s + frame <= end; s += hop) {
    const est = mpm(input.samples, s, frame, fs, lo, hi, { restricted: true });
    if (est) estimates.push(est);
  }
  if (estimates.length === 0) return { f0: null, clarity: 0 };
  const clarities = estimates.map((e) => e.clarity).sort((a, b) => a - b);
  const clarity = clarities[clarities.length >> 1]!;
  const good = estimates.filter((e) => e.clarity >= 0.5);
  const pool = good.length > 0 ? good : estimates;
  const f0s = pool.map((e) => e.f0).sort((a, b) => a - b);
  const coarse = f0s[f0s.length >> 1]!;
  const spec = magnitudeSpectrum(input.samples, start, end - start, fs, 4);
  const fit = refineHarmonic(spec, coarse, { maxPartials: 10, minMag: 0 });
  // Keep the refinement only if it stays close to the time-domain estimate (guards against bad peaks).
  const f0 = fit.partialsUsed > 0 && Math.abs(1200 * Math.log2(fit.f0 / coarse)) < 60 ? fit.f0 : coarse;
  return { f0, clarity };
}

export function verifyPluck(input: PluckInput): PluckResult {
  const t0 = performance.now();
  const params = input.params ?? DEFAULT_MODE_A_PARAMS;
  const strictness = input.strictness ?? 'lenient';
  const fs = input.sampleRate;
  const base = (
    status: StringStatus,
    verdict: Verdict,
    reasons: RetryReason[],
    extra: Partial<PluckResult>,
  ): PluckResult => ({
    detectorVersion: DETECTOR_VERSION,
    confidence: 0,
    reasons,
    processingMs: 0,
    status,
    verdict,
    f0: null,
    cents: null,
    semitones: null,
    clarity: 0,
    decayRatio: null,
    levelDb: 0,
    ...extra,
  });
  const finish = (r: PluckResult): PluckResult => ({
    ...r,
    processingMs: Math.max(1e-3, performance.now() - t0),
  });

  if (peakAbs(input.samples, input.onsetSample, input.onsetSample + msToSamples(400, fs)) > CLIP_LEVEL) {
    return finish(base('WEAK', 'RETRY', ['CLIPPING'], {}));
  }
  const early = bandPower(input, input.expectedF0, 30, 80, params.decayPartials);
  const levelDb = 10 * Math.log10((early.signal + 1e-20) / (early.pre + 1e-20));
  if (levelDb < params.minLevelDb) return finish(base('WEAK', 'RETRY', ['LOW_LEVEL'], { levelDb }));

  const pitch = measurePitch(input, params);
  const late = bandPower(input, pitch.f0 ?? input.expectedF0, 250, 350, params.decayPartials);
  const earlyAtPitch = pitch.f0 ? bandPower(input, pitch.f0, 30, 80, params.decayPartials) : early;
  const decayRatio = Math.sqrt(
    Math.max(0, late.signal - late.pre) / Math.max(1e-20, earlyAtPitch.signal - earlyAtPitch.pre),
  );
  const mutedBelow =
    input.templateDecayRatio !== undefined
      ? input.templateDecayRatio * params.mutedTemplateFactor[strictness]
      : params.mutedGlobalRatio[strictness];
  const common = { clarity: pitch.clarity, decayRatio, levelDb, f0: pitch.f0 };
  if (decayRatio < mutedBelow) {
    const confidence = Math.min(1, 1 - decayRatio / mutedBelow);
    return finish({ ...base('MUTED', 'FAIL', [], common), confidence });
  }
  if (pitch.f0 === null || pitch.clarity < params.clarityMin) {
    return finish(base('WEAK', 'RETRY', ['AMBIGUOUS'], common));
  }
  const cents = 1200 * Math.log2(pitch.f0 / input.expectedF0);
  const tol = params.toleranceCents[strictness];
  if (Math.abs(cents) <= tol) {
    return finish({
      ...base('OK', 'PASS', [], { ...common, cents, semitones: 0 }),
      confidence: Math.min(1, pitch.clarity),
    });
  }
  const semitones = Math.round(cents / 100);
  if (Math.abs(semitones) >= 12) return finish(base('WEAK', 'RETRY', ['AMBIGUOUS'], { ...common, cents }));
  if (semitones !== 0 && Math.abs(cents - 100 * semitones) <= tol) {
    return finish({
      ...base('WRONG_NOTE', 'FAIL', [], { ...common, cents, semitones }),
      confidence: pitch.clarity,
    });
  }
  return finish(base('WEAK', 'RETRY', ['DETUNED'], { ...common, cents }));
}

/** Optional x-string check (SPEC §10.5): the muted string was plucked; any sustained pitched sound → UNEXPECTED. */
export function verifySilentString(input: PluckInput): PluckResult {
  const result = verifyPluck(input);
  if (result.status === 'OK' || result.status === 'WRONG_NOTE') {
    return { ...result, status: 'UNEXPECTED', verdict: 'FAIL', reasons: [] };
  }
  if (result.status === 'MUTED' || (result.status === 'WEAK' && result.reasons.includes('LOW_LEVEL'))) {
    return { ...result, status: 'OK', verdict: 'PASS', reasons: [] };
  }
  return result;
}
