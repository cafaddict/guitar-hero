/**
 * Mode A — single-string pluck verification (SPEC §10.5), the v1 core judgement.
 *
 * 1. Pitch in [+30, +130 ms]: restricted MPM frames (range f0/1.5..f0·1.5) + harmonic refinement.
 * 2. cents = 1200·log2(f/f0); |cents| ≤ tol → note OK; near another semitone → WRONG_NOTE(semitones).
 * 3. Low clarity or level near the noise → WEAK (retry, not scored).
 * 4. Decay ratio "RMS[+250..350]/RMS[+30..80]" measured on the target's harmonic bands with the
 *    pre-onset spectrum subtracted (robust to noise and to previously plucked strings still ringing);
 *    far below the string's calibrated ratio (or the global default) → MUTED.
 * 5. Not a string (D-073): before a MUTED verdict the new energy must look like a string — a harmonic series
 *    near the expected note. A knock on the body (a few inharmonic resonances) is a retry ("NOT_STRING"),
 *    not a muted string.
 * 6. Ringing strings (D-074): when the strings plucked just before are given, the take is also judged on a
 *    copy with their periods comb-cancelled (the sequence verifier's cancellation, §10.10) and the better
 *    supported of the two judgements is kept. With nothing ringing the result is exactly the plain one.
 */
import { mpm, refineHarmonic } from './pitch';
import { cancellationStages, combFiltered, DEFAULT_SEQUENCE_PARAMS } from './sequence';
import { magnitudeSpectrum, msToSamples, partialPeak, peakAbs, type Spectrum } from './spectrum';
import {
  CLIP_LEVEL,
  type DspResultBase,
  type RetryReason,
  type Sensitivity,
  type Strictness,
  type StringStatus,
  type Verdict,
} from './types';
import { DETECTOR_VERSION } from './version';

export interface ModeAParams {
  pitchStartMs: number;
  pitchEndMs: number;
  /** Second pitch window used when the first is ambiguous (real attacks can blur the first 130 ms). */
  retryPitchStartMs: number;
  retryPitchEndMs: number;
  pitchFrameMs: number;
  pitchHopMs: number;
  clarityMin: number;
  toleranceCents: Record<Strictness, number>;
  /** Early harmonic power must exceed the pre-onset power by this much (dB), per sensitivity (D-075). */
  minLevelDb: Record<Sensitivity, number>;
  /** MUTED when ratio < template × mutedTemplateFactor, or < mutedGlobalRatio without a template. */
  mutedTemplateFactor: Record<Strictness, number>;
  mutedGlobalRatio: Record<Strictness, number>;
  decayPartials: number;
  /**
   * Not-a-string check (D-073): NOT_STRING when the best harmonic series near the expected note holds
   * ≤ maxPartials partials (≥ 1 % of the strongest) or < minHarmonicFraction of the new energy.
   */
  notString: Record<Sensitivity, { maxPartials: number; minHarmonicFraction: number }>;
  /** Candidate f0 search around the expected note (cents, same reach as the restricted MPM) and step. */
  notStringSearchCents: number;
  notStringStepCents: number;
  /** A RETRY whose overall new energy rises this much (dB) and fails the check is reported as NOT_STRING. */
  notStringRiseDb: number;
  /** Ringing strings (D-074): notes started within (minAgeS, maxAgeS] are cancelled, at most maxRinging. */
  ringingMinAgeS: number;
  ringingMaxAgeS: number;
  maxRinging: number;
  /** The cancelled copy is only eligible when its new energy is within this many dB of the raw take's. */
  cancelledMinPowerDb: number;
  /** The plain pitch counts as "a ringing string" within this many cents of a ringing f0. */
  ringingLockCents: number;
  /**
   * A sounding verdict of the cancelled copy needs a decay ratio ≥ this × the muted threshold: just above the
   * line, a weak (muted) take's ratio is noise the comb amplified, not a ringing string.
   */
  cancelledDecayMargin: number;
}

export const DEFAULT_MODE_A_PARAMS: ModeAParams = {
  pitchStartMs: 30,
  pitchEndMs: 130,
  retryPitchStartMs: 130,
  retryPitchEndMs: 330,
  pitchFrameMs: (2048 / 48000) * 1000,
  pitchHopMs: (512 / 48000) * 1000,
  clarityMin: 0.8,
  toleranceCents: { lenient: 35, normal: 30, strict: 25 },
  minLevelDb: { low: 9, normal: 7, high: 5 },
  mutedTemplateFactor: { lenient: 0.25, normal: 0.3, strict: 0.35 },
  mutedGlobalRatio: { lenient: 0.07, normal: 0.085, strict: 0.1 },
  decayPartials: 8,
  notString: {
    low: { maxPartials: 3, minHarmonicFraction: 0.7 },
    normal: { maxPartials: 3, minHarmonicFraction: 0.6 },
    high: { maxPartials: 2, minHarmonicFraction: 0.5 },
  },
  notStringSearchCents: 700,
  notStringStepCents: 5,
  notStringRiseDb: 10,
  ringingMinAgeS: 0.05,
  ringingMaxAgeS: 3,
  maxRinging: 3,
  cancelledMinPowerDb: -9,
  ringingLockCents: 50,
  cancelledDecayMargin: 2.5,
};

/** A string plucked before the take that may still be sounding. */
export interface RingingString {
  /** Its sounding (measured) fundamental. */
  f0: number;
  /** Seconds from its onset to the take's onset. */
  ageS: number;
}

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
  /** Default 'normal' (the benchmark's setting, D-075). */
  sensitivity?: Sensitivity;
  /** Strings plucked just before the take (D-074); none = the plain judgement only. */
  ringing?: readonly RingingString[];
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
  /** The expected f0 the take was judged against (lets a caller drop a verdict for a superseded job). */
  expectedF0?: number;
  /**
   * NOT_STRING that decayed like a muted string: a caller that keeps hearing it on the same string may treat
   * it as MUTED (a real dead thud can look like a knock, D-073).
   */
  fastDecay?: boolean;
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
export function measurePitch(
  input: PluckInput,
  params: ModeAParams,
  span: { startMs: number; endMs: number } = { startMs: params.pitchStartMs, endMs: params.pitchEndMs },
): { f0: number | null; clarity: number } {
  const fs = input.sampleRate;
  const frame = msToSamples(params.pitchFrameMs, fs);
  const hop = msToSamples(params.pitchHopMs, fs);
  const start = input.onsetSample + msToSamples(span.startMs, fs);
  const end = Math.min(input.samples.length, input.onsetSample + msToSamples(span.endMs, fs));
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

/** What the new energy after the onset looks like (D-073). */
export interface StringEvidence {
  /** Share of the new energy inside the best candidate's harmonic bands. */
  harmonicFraction: number;
  /** Partials of that series with ≥ 1 % of its strongest partial's power. */
  partials: number;
  /** Overall new energy rise over the pre-onset window (dB). */
  riseDb: number;
  /** Total new energy in 60–5000 Hz (linear power). */
  newPower: number;
}

/**
 * New-energy spectrum P = max(0, |after|² − |before|²) of [+30, +130 ms] vs [−120, −20 ms], then the best
 * harmonic series among candidate f0s within ±notStringSearchCents of the expected note: a wrong fret is still
 * a string, a body knock (a few inharmonic resonances) is not. Subtracting the pre-onset spectrum keeps strings
 * that were already ringing out of the picture.
 */
export function stringEvidence(
  input: PluckInput,
  params: ModeAParams = DEFAULT_MODE_A_PARAMS,
): StringEvidence {
  const fs = input.sampleRate;
  const len = msToSamples(100, fs);
  const after = magnitudeSpectrum(input.samples, input.onsetSample + msToSamples(30, fs), len, fs, 2);
  const before = magnitudeSpectrum(input.samples, input.onsetSample - msToSamples(120, fs), len, fs, 2);
  const bins = after.mag.length;
  const binHz = after.binHz;
  const prefix = new Float64Array(bins + 1);
  let rise = 0;
  let base = 0;
  let newPower = 0;
  const lo60 = Math.ceil(60 / binHz);
  const hi5k = Math.min(bins - 1, Math.floor(5000 / binHz));
  for (let k = 0; k < bins; k++) {
    const a = after.mag[k]! * after.mag[k]!;
    const b = before.mag[k]! * before.mag[k]!;
    prefix[k + 1] = prefix[k]! + Math.max(0, a - b);
    if (k >= lo60 && k <= hi5k) {
      rise += a;
      base += b;
      newPower += Math.max(0, a - b);
    }
  }
  const sum = (fromHz: number, toHz: number) => {
    const lo = Math.max(0, Math.ceil(fromHz / binHz));
    const hi = Math.min(bins - 1, Math.floor(toHz / binHz));
    return hi >= lo ? prefix[hi + 1]! - prefix[lo]! : 0;
  };
  let best = { harmonicFraction: 0, partials: 0 };
  const steps = Math.round(params.notStringSearchCents / params.notStringStepCents);
  const bandRatio = 2 ** (25 / 1200) - 1;
  for (let m = -steps; m <= steps; m++) {
    const c = input.expectedF0 * 2 ** ((m * params.notStringStepCents) / 1200);
    const hmax = Math.max(1, Math.min(10, Math.floor(5000 / c)));
    const total = sum(0.5 * c, (hmax + 0.5) * c);
    if (total <= 0) continue;
    const powers: number[] = [];
    for (let h = 1; h <= hmax; h++) {
      const centre = h * c * Math.sqrt(1 + 5e-5 * h * h);
      const half = Math.max(12, centre * bandRatio);
      powers.push(sum(centre - half, centre + half));
    }
    const harmonicFraction = Math.min(1, powers.reduce((x, y) => x + y, 0) / total);
    if (harmonicFraction <= best.harmonicFraction) continue;
    const strongest = Math.max(...powers);
    best = { harmonicFraction, partials: powers.filter((p) => p >= 0.01 * strongest).length };
  }
  return { ...best, riseDb: 10 * Math.log10((rise + 1e-20) / (base + 1e-20)), newPower };
}

function looksLikeString(evidence: StringEvidence, params: ModeAParams, sensitivity: Sensitivity): boolean {
  const rule = params.notString[sensitivity];
  return evidence.partials > rule.maxPartials && evidence.harmonicFraction >= rule.minHarmonicFraction;
}

/**
 * Steps 1–5 on one signal (the raw take or its ringing-cancelled copy). `evidence` always describes the raw
 * take: its pre-onset subtraction already removes ringing strings, while the comb would also notch the take's
 * own partials that coincide with theirs.
 */
function judgeTake(
  input: PluckInput,
  params: ModeAParams,
  strictness: Strictness,
  sensitivity: Sensitivity,
  evidence: () => StringEvidence,
): PluckResult {
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
    expectedF0: input.expectedF0,
    ...extra,
  });
  const early = bandPower(input, input.expectedF0, 30, 80, params.decayPartials);
  // A retry that is loud overall but is no string at all gets the right reason (the verdict stays RETRY).
  const retry = (reason: RetryReason, extra: Partial<PluckResult>): PluckResult => {
    const e = evidence();
    const notString = e.riseDb >= params.notStringRiseDb && !looksLikeString(e, params, sensitivity);
    return base('WEAK', 'RETRY', [notString ? 'NOT_STRING' : reason], extra);
  };
  const levelDb = 10 * Math.log10((early.signal + 1e-20) / (early.pre + 1e-20));
  if (levelDb < params.minLevelDb[sensitivity]) return retry('LOW_LEVEL', { levelDb });

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
    // A fast decay is a muted string only if a string sounded at all (a body knock decays just as fast).
    if (!looksLikeString(evidence(), params, sensitivity))
      return base('WEAK', 'RETRY', ['NOT_STRING'], { ...common, fastDecay: true });
    const confidence = Math.min(1, 1 - decayRatio / mutedBelow);
    return { ...base('MUTED', 'FAIL', [], common), confidence };
  }
  const tol = params.toleranceCents[strictness];
  type PitchDecision =
    | { kind: 'ok'; cents: number }
    | { kind: 'wrong'; cents: number; semitones: number }
    | { kind: 'retry'; reason: RetryReason; cents: number | null };
  const decide = (p: { f0: number | null; clarity: number }): PitchDecision => {
    if (p.f0 === null || p.clarity < params.clarityMin)
      return { kind: 'retry', reason: 'AMBIGUOUS', cents: null };
    const cents = 1200 * Math.log2(p.f0 / input.expectedF0);
    if (Math.abs(cents) <= tol) return { kind: 'ok', cents };
    const semitones = Math.round(cents / 100);
    if (Math.abs(semitones) >= 12) return { kind: 'retry', reason: 'AMBIGUOUS', cents };
    if (semitones !== 0 && Math.abs(cents - 100 * semitones) <= tol)
      return { kind: 'wrong', cents, semitones };
    return { kind: 'retry', reason: 'DETUNED', cents };
  };
  let decision = decide(pitch);
  let used = pitch;
  if (decision.kind === 'retry') {
    // The first window can still hold the attack (pick noise, finger slide); the string usually settles
    // into a clear pitch a little later, well inside the +400 ms segment.
    const later = measurePitch(input, params, {
      startMs: params.retryPitchStartMs,
      endMs: params.retryPitchEndMs,
    });
    const second = decide(later);
    if (second.kind !== 'retry') {
      decision = second;
      used = later;
    }
  }
  const measured = { ...common, clarity: used.clarity, f0: used.f0 };
  switch (decision.kind) {
    case 'ok':
      return {
        ...base('OK', 'PASS', [], { ...measured, cents: decision.cents, semitones: 0 }),
        confidence: Math.min(1, used.clarity),
      };
    case 'wrong':
      return {
        ...base('WRONG_NOTE', 'FAIL', [], {
          ...measured,
          cents: decision.cents,
          semitones: decision.semitones,
        }),
        confidence: used.clarity,
      };
    case 'retry':
      if (decision.reason === 'AMBIGUOUS') return retry('AMBIGUOUS', { ...measured, cents: decision.cents });
      return base('WEAK', 'RETRY', [decision.reason], { ...measured, cents: decision.cents });
  }
}

/** The ringing strings to cancel: recent enough, at most maxRinging, oldest first. */
function ringingToCancel(input: PluckInput, params: ModeAParams): RingingString[] {
  return (input.ringing ?? [])
    .filter((r) => r.ageS > params.ringingMinAgeS && r.ageS <= params.ringingMaxAgeS && r.f0 > 0)
    .sort((a, b) => b.ageS - a.ageS)
    .slice(-params.maxRinging);
}

/** The take with the ringing strings' periods comb-cancelled, on the same sample timeline. */
function cancelledCopy(input: PluckInput, ringing: readonly RingingString[]): Float64Array | null {
  const fs = input.sampleRate;
  const stages = cancellationStages(input.expectedF0, ringing, fs, DEFAULT_SEQUENCE_PARAMS);
  if (stages.length === 0) return null;
  const start = Math.max(0, input.onsetSample - msToSamples(300, fs));
  const filtered = combFiltered(input.samples, start, input.samples.length, stages);
  const copy = new Float64Array(input.samples.length);
  copy.set(filtered.samples.subarray(start - filtered.offset), start);
  return copy;
}

/** D-074: keep the plain judgement unless the cancelled one is better supported. */
function chooseJudgement(
  plain: PluckResult,
  judgedCancelled: PluckResult,
  ringing: readonly RingingString[],
  params: ModeAParams,
  mutedBelow: number,
): PluckResult {
  const sounding = judgedCancelled.status === 'OK' || judgedCancelled.status === 'WRONG_NOTE';
  const cancelled =
    sounding && (judgedCancelled.decayRatio ?? 0) < mutedBelow * params.cancelledDecayMargin
      ? {
          ...judgedCancelled,
          status: 'WEAK' as const,
          verdict: 'RETRY' as const,
          reasons: ['AMBIGUOUS' as const],
          confidence: 0,
        }
      : judgedCancelled;
  const f0 = plain.f0;
  if (f0 !== null && ringing.some((r) => Math.abs(1200 * Math.log2(f0 / r.f0)) <= params.ringingLockCents))
    return cancelled;
  if (plain.verdict === 'RETRY') return cancelled.verdict === 'RETRY' ? plain : cancelled;
  if (cancelled.verdict === 'RETRY' || cancelled.status === plain.status) return plain;
  return cancelled.clarity > plain.clarity ? cancelled : plain;
}

export function verifyPluck(input: PluckInput): PluckResult {
  const t0 = performance.now();
  const params = input.params ?? DEFAULT_MODE_A_PARAMS;
  const strictness = input.strictness ?? 'lenient';
  const sensitivity = input.sensitivity ?? 'normal';
  const fs = input.sampleRate;
  const finish = (r: PluckResult): PluckResult => ({
    ...r,
    processingMs: Math.max(1e-3, performance.now() - t0),
  });

  if (peakAbs(input.samples, input.onsetSample, input.onsetSample + msToSamples(400, fs)) > CLIP_LEVEL) {
    return finish({
      detectorVersion: DETECTOR_VERSION,
      confidence: 0,
      reasons: ['CLIPPING'],
      processingMs: 0,
      status: 'WEAK',
      verdict: 'RETRY',
      f0: null,
      cents: null,
      semitones: null,
      clarity: 0,
      decayRatio: null,
      levelDb: 0,
      expectedF0: input.expectedF0,
    });
  }
  let evidence: StringEvidence | null = null;
  const rawEvidence = () => {
    evidence ??= stringEvidence(input, params);
    return evidence;
  };
  const plain = judgeTake(input, params, strictness, sensitivity, rawEvidence);
  const ringing = ringingToCancel(input, params);
  const copy = ringing.length > 0 ? cancelledCopy(input, ringing) : null;
  if (!copy) return finish(plain);
  const copyInput = { ...input, samples: copy };
  // Too little new sound left after cancelling: the take is (mostly) a ringing string plucked again, which
  // only the plain judgement can name (a wrong note).
  const eligible =
    stringEvidence(copyInput, params).newPower >=
    rawEvidence().newPower * 10 ** (params.cancelledMinPowerDb / 10);
  if (!eligible) return finish(plain);
  const cancelled = judgeTake(copyInput, params, strictness, sensitivity, rawEvidence);
  const mutedBelow =
    input.templateDecayRatio !== undefined
      ? input.templateDecayRatio * params.mutedTemplateFactor[strictness]
      : params.mutedGlobalRatio[strictness];
  return finish(chooseJudgement(plain, cancelled, ringing, params, mutedBelow));
}

/** Optional x-string check (SPEC §10.5): the muted string was plucked; any sustained pitched sound → UNEXPECTED. */
export function verifySilentString(input: PluckInput): PluckResult {
  const result = verifyPluck(input);
  if (result.status === 'OK' || result.status === 'WRONG_NOTE') {
    return { ...result, status: 'UNEXPECTED', verdict: 'FAIL', reasons: [] };
  }
  // A dead thud (or a knock) on the x string is exactly the expected "no string sound".
  if (
    result.status === 'MUTED' ||
    (result.status === 'WEAK' &&
      (result.reasons.includes('LOW_LEVEL') || result.reasons.includes('NOT_STRING')))
  ) {
    return { ...result, status: 'OK', verdict: 'PASS', reasons: [] };
  }
  return result;
}
