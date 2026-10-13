/**
 * Guitar body knock (D-073): a hand, pick or ring hitting the top or side excites a few body resonances
 * (air ≈ 100 Hz, top plate ≈ 205 Hz, ≈ 400 Hz — the centres of `bodyResponse`) and some higher plate modes,
 * each a damped sinusoid, after a ~2 ms contact burst. There are no string partials: it is the sound a Mode A
 * take must not judge as a string. Pure, seeded.
 */
import { mulberry32, randInt, uniform } from '../../domain/prng';

export interface KnockSpec {
  sampleRate: number;
  durationS: number;
  seed: number;
}

/** Body resonance centres (Hz) and their spread (±fraction). */
const BODY_MODES = [100, 205, 400] as const;
const BODY_SPREAD = 0.1;

/** A knock normalized like a note (RMS 0.1 over its first 100 ms). */
export function renderKnock(spec: KnockSpec): Float32Array {
  const fs = spec.sampleRate;
  const n = Math.max(1, Math.round(spec.durationS * fs));
  const out = new Float32Array(n);
  const rng = mulberry32(spec.seed);
  const modes: { hz: number; amp: number; tauS: number }[] = BODY_MODES.map((centre) => ({
    hz: centre * uniform(rng, 1 - BODY_SPREAD, 1 + BODY_SPREAD),
    amp: uniform(rng, 0.5, 1),
    tauS: uniform(rng, 0.015, 0.06),
  }));
  const plates = randInt(rng, 2, 4);
  for (let i = 0; i < plates; i++)
    modes.push({ hz: uniform(rng, 600, 1500), amp: uniform(rng, 0.2, 0.6), tauS: uniform(rng, 0.005, 0.02) });
  for (const mode of modes) {
    const phase = uniform(rng, 0, 2 * Math.PI);
    const w = (2 * Math.PI * mode.hz) / fs;
    const decay = Math.exp(-1 / (mode.tauS * fs));
    let a = mode.amp;
    for (let i = 0; i < n && a > mode.amp * 1e-5; i++) {
      out[i] = out[i]! + a * Math.sin(w * i + phase);
      a *= decay;
    }
  }
  // Contact burst: 2 ms of one-pole low-passed noise, as loud as the modes' sum at the start.
  const burst = Math.round(0.002 * fs);
  let lp = 0;
  for (let i = 0; i < Math.min(burst, n); i++) {
    lp = 0.6 * (rng() * 2 - 1) + 0.4 * lp;
    out[i] = out[i]! + 1.5 * lp * (1 - i / burst);
  }
  const len = Math.min(n, Math.round(0.1 * fs));
  let sum = 0;
  for (let i = 0; i < len; i++) sum += out[i]! * out[i]!;
  const r = Math.sqrt(sum / Math.max(1, len));
  if (r > 0) for (let i = 0; i < n; i++) out[i] = (out[i]! * 0.1) / r;
  return out;
}
