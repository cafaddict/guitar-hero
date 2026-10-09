/**
 * Playing-technique models for the v1.1 beta detectors (SPEC v1.1 §14.2): fret buzz and palm mute. Pure,
 * in place on a rendered (normalized) note.
 */
import { mulberry32 } from '../../domain/prng';
import { applyBiquad, highpass, highshelf } from '../filters';

/** Palm mute: high frequencies −12 dB above 4 kHz, then an exponential decay reaching −60 dB at `decayS`. */
export const PALM_MUTE_SHELF_HZ = 4000;
export const PALM_MUTE_SHELF_DB = -12;

export function applyPalmMute(note: Float32Array, sampleRate: number, decayS: number): Float32Array {
  const shelved = applyBiquad(note, highshelf(PALM_MUTE_SHELF_HZ, sampleRate, PALM_MUTE_SHELF_DB));
  const perSample = 10 ** (-3 / (decayS * sampleRate));
  let g = 1;
  for (let i = 0; i < shelved.length; i++) {
    shelved[i] = shelved[i]! * g;
    g *= perSample;
  }
  return shelved;
}

/** Buzz noise level re. the note's RMS over its first 200 ms at strength 1 (dB), and its slope per decade. */
export const BUZZ_LEVEL_DB = -20;
export const BUZZ_LEVEL_SLOPE_DB = 14;

/**
 * Fret buzz of strength 0..1 (02:367): the string slapping the next fret. Modelled as a soft clip of the
 * waveform (contact non-linearity) plus high-passed noise gated by the string's positive excursion (it hits
 * the fret once per period), decaying over ~0.3 s. At strength 1 the rattle sits BUZZ_LEVEL_DB below the
 * note (≈ −30 dB at 0.2).
 */
export function applyBuzz(note: Float32Array, sampleRate: number, strength: number, seed: number): void {
  if (strength <= 0) return;
  let peak = 0;
  for (let i = 0; i < note.length; i++) peak = Math.max(peak, Math.abs(note[i]!));
  if (peak <= 0) return;
  const head = Math.min(note.length, Math.round(0.2 * sampleRate));
  let sum = 0;
  for (let i = 0; i < head; i++) sum += note[i]! * note[i]!;
  const noteRms = Math.sqrt(sum / Math.max(1, head));
  const drive = 1 + 3 * strength;
  const rng = mulberry32(seed);
  const raw = new Float32Array(note.length);
  for (let i = 0; i < raw.length; i++) raw[i] = rng() * 2 - 1;
  const hiss = applyBiquad(raw, highpass(2000, sampleRate));
  const decay = Math.exp(-1 / (0.3 * sampleRate));
  const rattle = new Float32Array(note.length);
  let env = 1;
  let rattleSum = 0;
  for (let i = 0; i < note.length; i++) {
    rattle[i] = env * Math.max(0, note[i]! / peak) * hiss[i]!;
    if (i < head) rattleSum += rattle[i]! * rattle[i]!;
    env *= decay;
  }
  const rattleRms = Math.sqrt(rattleSum / Math.max(1, head));
  const level = 10 ** ((BUZZ_LEVEL_DB + BUZZ_LEVEL_SLOPE_DB * Math.log10(strength)) / 20);
  const g = rattleRms > 0 ? (noteRms * level) / rattleRms : 0;
  for (let i = 0; i < note.length; i++) {
    const x = note[i]! / peak;
    const clipped = Math.tanh(drive * x) / Math.tanh(drive);
    note[i] = peak * ((1 - strength) * x + strength * clipped) + g * rattle[i]!;
  }
}
