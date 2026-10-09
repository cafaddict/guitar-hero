/**
 * Recording channel model (SPEC §14.2, §14.3 "지표 정의" 2): small-room reverb, metronome click bleed,
 * microphone high-pass, optional 8 kHz low-pass and stationary white/pink noise at a defined SNR.
 *
 * SNR = RMS of the (reverberated, high-passed) signal over onset + 0..500 ms ÷ RMS of the (high-passed)
 * noise, both measured as the detector would see them.
 */
import { mulberry32, type Rng } from '../../domain/prng';
import { applyBiquad, fftConvolve, highpass, lowpass } from '../filters';
import { rms } from '../spectrum';

export type ReverbKind = 'none' | 'small-room';
export type NoiseColor = 'white' | 'pink';

export interface ChannelSpec {
  sampleRate: number;
  /** null = no noise at all. */
  snrDb: number | null;
  noiseColor: NoiseColor;
  micHighpassHz: number;
  reverb: ReverbKind;
  rt60S: number;
  drrDb: number;
  lowpass8k: boolean;
  /** Sample range used as the SNR reference (onset .. onset + 500 ms). */
  snrRef: { start: number; end: number };
  /** Several reference ranges (single-note sequences, SPEC v1.1 §14.8): the signal RMS is their mean RMS. */
  snrRefs?: readonly { start: number; end: number }[];
  /** Peak level of the final mix (before noise) for normalization. */
  targetPeak: number;
  seed: number;
}

export function smallRoomIr(sampleRate: number, rt60S: number, drrDb: number, rng: Rng): Float32Array {
  const n = Math.round(rt60S * 1.2 * sampleRate);
  const ir = new Float32Array(n);
  ir[0] = 1;
  const start = Math.round(0.002 * sampleRate);
  const decayPerSample = Math.log(1000) / (rt60S * sampleRate);
  let energy = 0;
  for (let i = start; i < n; i++) {
    const v = (rng() * 2 - 1) * Math.exp(-decayPerSample * (i - start));
    ir[i] = v;
    energy += v * v;
  }
  // DRR = direct energy / reverberant energy.
  const scale = Math.sqrt(1 / (energy * 10 ** (drrDb / 10)));
  for (let i = start; i < n; i++) ir[i] = ir[i]! * scale;
  return ir;
}

export function noise(length: number, color: NoiseColor, rng: Rng): Float32Array {
  const out = new Float32Array(length);
  if (color === 'white') {
    for (let i = 0; i < length; i++) out[i] = rng() * 2 - 1;
    return out;
  }
  // Paul Kellet's economy pink filter.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const w = rng() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = b0 + b1 + b2 + w * 0.1848;
  }
  return out;
}

export interface ChannelOutput {
  /** Final recording. */
  signal: Float32Array;
  /** Signal without noise (for diagnostics). */
  clean: Float32Array;
  /** Applied gain on the dry signal (for aligning auxiliary layers). */
  gain: number;
  noiseRms: number;
}

/** Applies room, mic filter and noise. `extra` (e.g. click bleed) is mixed in before the room. */
export function applyChannel(dry: Float32Array, spec: ChannelSpec, extra?: Float32Array): ChannelOutput {
  const rng = mulberry32(spec.seed);
  let wet = dry;
  if (extra) {
    wet = new Float32Array(Math.max(dry.length, extra.length));
    wet.set(dry);
    for (let i = 0; i < extra.length; i++) wet[i] = wet[i]! + extra[i]!;
  }
  if (spec.reverb === 'small-room') {
    const convolved = fftConvolve(wet, smallRoomIr(spec.sampleRate, spec.rt60S, spec.drrDb, rng));
    wet = convolved.subarray(0, wet.length).slice();
  }
  if (spec.micHighpassHz > 0) wet = applyBiquad(wet, highpass(spec.micHighpassHz, spec.sampleRate));
  // The optional 8 kHz low-pass (device anti-alias/EQ) filters signal and noise alike *before* the SNR is
  // measured, so the labelled SNR is exactly what the detector sees.
  if (spec.lowpass8k) wet = applyBiquad(wet, lowpass(8000, spec.sampleRate));
  let peak = 0;
  for (let i = 0; i < wet.length; i++) peak = Math.max(peak, Math.abs(wet[i]!));
  const gain = peak > 0 ? spec.targetPeak / peak : 1;
  for (let i = 0; i < wet.length; i++) wet[i] = wet[i]! * gain;
  const clean = wet.slice();
  let noiseRms = 0;
  if (spec.snrDb !== null) {
    let n = noise(wet.length, spec.noiseColor, rng);
    if (spec.micHighpassHz > 0) n = applyBiquad(n, highpass(spec.micHighpassHz, spec.sampleRate));
    if (spec.lowpass8k) n = applyBiquad(n, lowpass(8000, spec.sampleRate));
    const signalRms = spec.snrRefs?.length
      ? spec.snrRefs.reduce((sum, r) => sum + rms(wet, r.start, r.end), 0) / spec.snrRefs.length
      : rms(wet, spec.snrRef.start, spec.snrRef.end);
    const rawNoiseRms = rms(n, 0, n.length);
    const scale = rawNoiseRms > 0 ? signalRms / 10 ** (spec.snrDb / 20) / rawNoiseRms : 0;
    for (let i = 0; i < wet.length; i++) wet[i] = wet[i]! + n[i]! * scale;
    noiseRms = rawNoiseRms * scale;
  }
  return { signal: wet, clean, gain, noiseRms };
}
