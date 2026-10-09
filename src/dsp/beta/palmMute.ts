/**
 * Palm-mute probability (SPEC v1.1 §10.11, beta). A palm-muted strum or note dies fast and loses its top
 * end: the decay ratio RMS[+150..250 ms]/RMS[+20..60 ms] and the spectral centroid of [+20, +120 ms] are
 * compared with the player's open (unmuted) reference when one exists.
 */
import { magnitudeSpectrum, msToSamples, rms } from '../spectrum';
import { type BetaResult, beta } from './types';

export interface PalmMuteParams {
  /** Reference decay ratio / centroid (Hz) of an open strum when no reference is given (dev split). */
  defaultDecayRatio: number;
  defaultCentroidHz: number;
  /** log10(decay / reference) at which the decay evidence is half-way (logistic centre) and its width. */
  decayCentre: number;
  decayWidth: number;
  centroidWeight: number;
}

export const DEFAULT_PALM_MUTE_PARAMS: PalmMuteParams = {
  defaultDecayRatio: 0.5,
  defaultCentroidHz: 1200,
  decayCentre: -0.6,
  decayWidth: 0.2,
  centroidWeight: 0.3,
};

export interface PalmMuteInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  reference?: { decayRatio: number; centroidHz: number };
  params?: PalmMuteParams;
}

export function palmMuteFeatures(input: PalmMuteInput): { decayRatio: number; centroidHz: number } {
  const fs = input.sampleRate;
  const o = input.onsetSample;
  const ms = (v: number) => o + msToSamples(v, fs);
  const noise = rms(input.samples, ms(-220), ms(-20));
  const sub = (r: number) => Math.sqrt(Math.max(0, r * r - noise * noise));
  const decayRatio =
    sub(rms(input.samples, ms(150), ms(250))) / Math.max(1e-12, sub(rms(input.samples, ms(20), ms(60))));
  const spec = magnitudeSpectrum(input.samples, ms(20), msToSamples(100, fs), fs, 2);
  let sw = 0;
  let sf = 0;
  for (let k = 1; k < spec.mag.length; k++) {
    const hz = k * spec.binHz;
    if (hz < 60 || hz > 8000) continue;
    const e = spec.mag[k]! * spec.mag[k]!;
    sw += e;
    sf += e * hz;
  }
  return { decayRatio, centroidHz: sw > 0 ? sf / sw : 0 };
}

/** Probability (0..1) that the event was palm-muted (beta). */
export function palmMuteProbability(input: PalmMuteInput): BetaResult<number> & { muted: boolean } {
  const p = input.params ?? DEFAULT_PALM_MUTE_PARAMS;
  const f = palmMuteFeatures(input);
  const ref = input.reference ?? { decayRatio: p.defaultDecayRatio, centroidHz: p.defaultCentroidHz };
  const decayLog = Math.log10((f.decayRatio + 1e-6) / Math.max(1e-6, ref.decayRatio));
  const centroidLog = Math.log2((f.centroidHz + 1) / Math.max(1, ref.centroidHz));
  const z = (p.decayCentre - decayLog) / p.decayWidth - p.centroidWeight * centroidLog * 4;
  const prob = 1 / (1 + Math.exp(-z));
  return { ...beta(prob, Math.abs(prob - 0.5) * 2), muted: prob >= 0.5 };
}
