/**
 * Single string note synthesis: extended Karplus–Strong and additive (SPEC §14.2). Pure, seeded.
 */
import { mulberry32, uniform } from '../../domain/prng';
import { applyBiquad, peaking } from '../filters';

export type SynthModel = 'karplus-strong' | 'additive';

export interface NoteSpec {
  model: SynthModel;
  /** Actual sounding fundamental (Hz). */
  f0: number;
  sampleRate: number;
  durationS: number;
  /** Additive model stiffness B (f_h = h·f0·√(1+B·h²)). */
  inharmonicityB: number;
  /** Muted string: amplitude envelope reaching mutedDecayDb within mutedDecayMs. */
  muted: boolean;
  mutedDecayDb: number;
  mutedDecayMs: number;
  /** Attenuation of partial 1 in dB (0 = none; −20 = "weak fundamental"). */
  fundamentalDb: number;
  /** 0..1 excitation brightness. */
  brightness: number;
  /** Relative pluck position along the string (0.06..0.3). */
  pickPosition: number;
  /** Decay time (T60) of the fundamental in seconds. */
  t60S: number;
  seed: number;
  /** Additive model: add the pick-noise burst (default true; a hammer-on has none, SPEC v1.1 §14.2). */
  pickNoise?: boolean;
  /** Karplus–Strong: start the delay line from this waveform (resampled to the new period) instead of a
   * plucked noise burst — a hammer-on keeps the string's vibration and only changes its length. */
  excitation?: ArrayLike<number>;
}

/** Random but realistic timbre parameters for a note. */
export function randomTimbre(seed: number): Pick<NoteSpec, 'brightness' | 'pickPosition' | 't60S'> {
  const rng = mulberry32(seed);
  return {
    brightness: uniform(rng, 0.45, 0.9),
    pickPosition: uniform(rng, 0.08, 0.28),
    t60S: uniform(rng, 2.5, 6),
  };
}

/** Applies the muted-string envelope in place (no-op unless spec.muted). */
export function applyMuteEnvelope(out: Float32Array, spec: NoteSpec): void {
  if (!spec.muted) return;
  const perSample = 10 ** (spec.mutedDecayDb / 20 / ((spec.mutedDecayMs / 1000) * spec.sampleRate));
  let g = 1;
  for (let i = 0; i < out.length; i++) {
    out[i] = out[i]! * g;
    g *= perSample;
  }
}

/** First-order allpass coefficient whose phase delay at ω equals `delay` samples (bisection). */
export function allpassCoefficient(delay: number, omega: number): number {
  const phaseDelay = (c: number) => {
    const theta =
      -Math.atan2(Math.sin(omega), c + Math.cos(omega)) +
      Math.atan2(c * Math.sin(omega), 1 + c * Math.cos(omega));
    return -theta / omega;
  };
  // Phase delay decreases monotonically as c increases on (−1, 1).
  let lo = -0.999;
  let hi = 0.999;
  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (lo + hi);
    if (phaseDelay(mid) > delay) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/**
 * Extended Karplus–Strong: delay line + two-point averaging loss filter (linear phase, 0.5 sample) +
 * first-order allpass tuned so that the loop's phase delay at f0 equals fs/f0 exactly.
 * Excitation: seeded noise, one-pole low-passed (brightness), pick-position comb.
 */
export function karplusStrong(spec: NoteSpec): Float32Array {
  const fs = spec.sampleRate;
  const n = Math.max(1, Math.round(spec.durationS * fs));
  const out = new Float32Array(n);
  const period = fs / spec.f0;
  const omega = (2 * Math.PI * spec.f0) / fs;
  // Loop delay = D (buffer) + 0.5 (averager) + Δ (allpass), Δ kept in [0.1, 1.1) for a well-behaved allpass.
  const D = Math.floor(period - 0.5 - 0.1);
  const frac = period - 0.5 - D;
  const c = allpassCoefficient(frac, omega);
  const loopGain = 10 ** (-3 / (spec.f0 * spec.t60S)) / Math.cos(omega / 2);

  const buf = new Float64Array(D);
  let mean = 0;
  if (spec.excitation && spec.excitation.length > 1) {
    // Hammer-on: the previous vibration, linearly resampled to the new loop length.
    const src = spec.excitation;
    for (let i = 0; i < D; i++) {
      const pos = (i * (src.length - 1)) / Math.max(1, D - 1);
      const k = Math.floor(pos);
      const f = pos - k;
      buf[i] = (1 - f) * src[k]! + f * (src[Math.min(src.length - 1, k + 1)] ?? 0);
      mean += buf[i]!;
    }
  } else {
    const rng = mulberry32(spec.seed);
    const excitation = new Float64Array(D);
    const pole = 1 - spec.brightness * 0.9;
    let lp = 0;
    for (let i = 0; i < D; i++) {
      lp = (1 - pole) * (rng() * 2 - 1) + pole * lp;
      excitation[i] = lp;
    }
    const combDelay = Math.max(1, Math.round(spec.pickPosition * D));
    for (let i = 0; i < D; i++) {
      buf[i] = excitation[i]! - (i >= combDelay ? excitation[i - combDelay]! : 0);
      mean += buf[i]!;
    }
  }
  mean /= D;
  for (let i = 0; i < D; i++) buf[i] = buf[i]! - mean;

  let idx = 0;
  let prev = 0;
  let apIn = 0;
  let apOut = 0;
  for (let i = 0; i < n; i++) {
    const v = buf[idx]!;
    out[i] = v;
    const avg = loopGain * 0.5 * (v + prev);
    prev = v;
    const ap = c * avg + apIn - c * apOut;
    apIn = avg;
    apOut = ap;
    buf[idx] = ap;
    idx = idx + 1 === D ? 0 : idx + 1;
  }
  let shaped: Float32Array = out;
  if (spec.fundamentalDb !== 0) shaped = applyBiquad(out, peaking(spec.f0, fs, spec.fundamentalDb, 6));
  return shaped;
}

/** Fixed "guitar body" response: a few broad resonances (gain multiplier at frequency f). */
export function bodyResponse(f: number): number {
  const peaks: readonly [number, number, number][] = [
    [100, 1.6, 0.35],
    [205, 1.4, 0.3],
    [400, 1.25, 0.4],
    [2800, 0.8, 0.6],
  ];
  let g = 1;
  for (const [center, gain, width] of peaks) {
    const x = Math.log2(f / center) / width;
    g *= 1 + (gain - 1) * Math.exp(-0.5 * x * x);
  }
  return g;
}

/**
 * Additive string model: f_h = h·f0·√(1+B·h²), amplitude ∝ h^-α·|sin(π·h·β)|·body(f_h),
 * per-partial exponential decay (higher partials decay faster), 1 ms raised-cosine attack and a short
 * high-passed pick noise burst so onsets are broadband like a real pluck.
 */
export function additive(spec: NoteSpec): Float32Array {
  const fs = spec.sampleRate;
  const n = Math.max(1, Math.round(spec.durationS * fs));
  const out = new Float32Array(n);
  const rng = mulberry32(spec.seed);
  const alpha = 1.6 - spec.brightness;
  const maxHz = Math.min(0.45 * fs, 10_000);
  for (let h = 1; h < 200; h++) {
    const f = h * spec.f0 * Math.sqrt(1 + spec.inharmonicityB * h * h);
    if (f > maxHz) break;
    let amp =
      h ** -alpha * Math.max(0.05, Math.abs(Math.sin(Math.PI * h * spec.pickPosition))) * bodyResponse(f);
    if (h === 1) amp *= 10 ** (spec.fundamentalDb / 20);
    const t60 = spec.t60S / (1 + 0.12 * (h - 1) * (f / 1000 + 0.5));
    const decay = 10 ** (-3 / (t60 * fs));
    const phase = rng() * 2 * Math.PI;
    const w = (2 * Math.PI * f) / fs;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    let s = Math.sin(phase);
    let c = Math.cos(phase);
    let a = amp;
    const floor = amp * 1e-5;
    for (let i = 0; i < n; i++) {
      out[i] = out[i]! + a * s;
      const s2 = s * cw + c * sw;
      c = c * cw - s * sw;
      s = s2;
      a *= decay;
      if (a < floor) break;
    }
  }
  const attack = Math.max(1, Math.round(0.001 * fs));
  for (let i = 0; i < Math.min(attack, n); i++)
    out[i] = out[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / attack));
  if (spec.pickNoise === false) return out;
  // Pick noise: 4 ms decaying burst, first-difference high-passed, ~-18 dB re. the note's peak.
  let peak = 0;
  for (let i = 0; i < Math.min(n, Math.round(0.05 * fs)); i++) peak = Math.max(peak, Math.abs(out[i]!));
  const burst = Math.round(0.004 * fs);
  let prevNoise = 0;
  for (let i = 0; i < Math.min(burst, n); i++) {
    const noise = rng() * 2 - 1;
    out[i] = out[i]! + 0.12 * peak * (noise - prevNoise) * Math.exp(-i / (0.0012 * fs));
    prevNoise = noise;
  }
  return out;
}

/** Renders the note without the mute envelope (callers normalize first, then call applyMuteEnvelope). */
export function renderNote(spec: NoteSpec): Float32Array {
  return spec.model === 'karplus-strong' ? karplusStrong(spec) : additive(spec);
}
