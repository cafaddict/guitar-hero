/**
 * Single-note sequence synthesis (SPEC v1.1 §14.2): notes rendered one after another. A note on the same
 * string cuts the previous one (the pick re-strikes the string); a note on another string lets the previous
 * one ring and decay naturally. A legato note (hammer-on) has no pick attack: it takes over the string's
 * vibration at the previous note's level and only changes the pitch, with a short crossfade.
 */
import { applyBiquad, lowpass } from '../filters';
import { applyBuzz, applyPalmMute } from './effects';
import { type NoteSpec, renderNote } from './note';
import { normalizeNote } from './strum';

export interface SequenceNote {
  /** Onset in the dry signal (s). */
  time: number;
  /** Guitar string number 6 … 1. */
  string: number;
  note: NoteSpec;
  gainDb: number;
  /** Hammer-on from the previous note on the same string. */
  legato?: boolean;
  /** Palm-mute decay time (s), beta model. */
  palmMuteDecayS?: number;
  /** Fret-buzz strength 0..1, beta model. */
  buzz?: number;
}

export interface RenderedSequence {
  signal: Float32Array;
  /** Onset sample of every note (input order). */
  onsets: number[];
}

/** A re-picked string is damped over this long before the new note starts. */
export const REPICK_DAMP_MS = 5;
/** Hammer-on crossfade length. */
export const LEGATO_CROSSFADE_MS = 4;
/** Excitation brightness ceiling for a hammer-on (no pick: little 2–8 kHz attack energy). */
export const LEGATO_BRIGHTNESS = 0.05;
/** Low-pass corner (4th order) applied to a hammer-on the model cannot carry over (additive). */
export const LEGATO_LOWPASS_HZ = 1200;

function rmsOf(x: Float32Array, start: number, end: number): number {
  const s = Math.max(0, start);
  const e = Math.min(x.length, end);
  if (e <= s) return 0;
  let sum = 0;
  for (let i = s; i < e; i++) sum += x[i]! * x[i]!;
  return Math.sqrt(sum / (e - s));
}

interface Placed {
  onset: number;
  buffer: Float32Array;
}

export function renderSequence(
  notes: readonly SequenceNote[],
  sampleRate: number,
  totalSamples: number,
): RenderedSequence {
  const fs = sampleRate;
  const order = notes.map((_, i) => i).sort((a, b) => notes[a]!.time - notes[b]!.time);
  const placed: Placed[] = new Array(notes.length);
  const lastOnString = new Map<number, number>();
  const crossfade = Math.max(1, Math.round((LEGATO_CROSSFADE_MS / 1000) * fs));
  const damp = Math.max(1, Math.round((REPICK_DAMP_MS / 1000) * fs));
  for (const i of order) {
    const spec = notes[i]!;
    const onset = Math.round(spec.time * fs);
    const legato = spec.legato === true && lastOnString.has(spec.string);
    const previousIdx = lastOnString.get(spec.string);
    // A hammer-on keeps the string vibrating: Karplus–Strong restarts from the previous note's last period,
    // the additive model drops the pick noise and darkens the excitation.
    const carried = (() => {
      if (!legato || previousIdx === undefined || spec.note.model !== 'karplus-strong') return undefined;
      const prev = placed[previousIdx]!;
      const period = Math.max(2, Math.round(fs / notes[previousIdx]!.note.f0));
      const end = Math.min(prev.buffer.length, onset - prev.onset);
      return end > period ? prev.buffer.subarray(end - period, end) : undefined;
    })();
    const noteSpec: NoteSpec = legato
      ? {
          ...spec.note,
          brightness: Math.min(spec.note.brightness, LEGATO_BRIGHTNESS),
          pickNoise: false,
          ...(carried ? { excitation: carried } : {}),
        }
      : spec.note;
    let buffer = renderNote(noteSpec);
    // The additive model cannot carry the vibration over, so its hammer-on is darkened instead.
    if (legato && !carried)
      buffer = applyBiquad(
        applyBiquad(buffer, lowpass(LEGATO_LOWPASS_HZ, fs)),
        lowpass(LEGATO_LOWPASS_HZ, fs),
      );
    normalizeNote(buffer, fs);
    if (spec.palmMuteDecayS !== undefined) buffer = applyPalmMute(buffer, fs, spec.palmMuteDecayS);
    if (spec.buzz !== undefined) applyBuzz(buffer, fs, spec.buzz, spec.note.seed ^ 0x5bd1);
    if (legato && previousIdx !== undefined) {
      // Match the string's current level, then fade the new pitch in over the crossfade.
      const prev = placed[previousIdx]!;
      const at = onset - prev.onset;
      const level = rmsOf(prev.buffer, at - Math.round(0.02 * fs), at);
      const start = rmsOf(buffer, 0, Math.round(0.02 * fs));
      const g = start > 0 ? level / start : 0;
      for (let k = 0; k < buffer.length; k++)
        buffer[k] = buffer[k]! * g * (k < crossfade ? k / crossfade : 1);
    } else {
      const g = 10 ** (spec.gainDb / 20);
      for (let k = 0; k < buffer.length; k++) buffer[k] = buffer[k]! * g;
    }
    if (previousIdx !== undefined) {
      // The same string stops sounding its previous note: a pick re-strike damps it just before the new
      // attack; a hammer-on hands the vibration over during the crossfade.
      const prev = placed[previousIdx]!;
      const fade = legato ? crossfade : damp;
      const fadeStart = onset - prev.onset - (legato ? 0 : damp);
      for (let k = Math.max(0, fadeStart); k < prev.buffer.length; k++) {
        const into = k - fadeStart;
        prev.buffer[k] = into < fade ? prev.buffer[k]! * (1 - into / fade) : 0;
      }
    }
    placed[i] = { onset, buffer };
    lastOnString.set(spec.string, i);
  }
  const signal = new Float32Array(totalSamples);
  for (const p of placed) {
    const end = Math.min(totalSamples, p.onset + p.buffer.length);
    for (let k = Math.max(0, p.onset); k < end; k++) signal[k] = signal[k]! + p.buffer[k - p.onset]!;
  }
  return { signal, onsets: notes.map((n) => Math.round(n.time * fs)) };
}
