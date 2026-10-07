/**
 * Strum assembly (SPEC §14.2): per-string notes delayed in down (6→1) or up (1→6) order across a
 * spread of 0–40 ms, with per-string gain jitter.
 */
import { applyMuteEnvelope, type NoteSpec, renderNote } from './note';

export interface StrumString {
  idx: number;
  note: NoteSpec;
  gainDb: number;
}

export interface StrumSpec {
  strings: StrumString[];
  direction: 'down' | 'up';
  spreadMs: number;
  sampleRate: number;
}

export interface RenderedStrum {
  signal: Float32Array;
  /** Onset sample of each string relative to the strum start. */
  stringOnsets: { idx: number; sample: number }[];
  /** First string onset (the strum's ground-truth time) — always 0 here. */
  firstOnset: number;
}

/** Normalizes an (un-muted) note so its RMS over the first 500 ms (or its length) is 0.1. */
export function normalizeNote(x: Float32Array, sampleRate: number): void {
  const len = Math.min(x.length, Math.round(0.5 * sampleRate));
  let sum = 0;
  for (let i = 0; i < len; i++) sum += x[i]! * x[i]!;
  const r = Math.sqrt(sum / Math.max(1, len));
  if (r <= 0) return;
  const g = 0.1 / r;
  for (let i = 0; i < x.length; i++) x[i] = x[i]! * g;
}

export function renderStrum(spec: StrumSpec, totalSamples?: number): RenderedStrum {
  const ordered = [...spec.strings].sort((a, b) =>
    spec.direction === 'down' ? a.idx - b.idx : b.idx - a.idx,
  );
  const count = ordered.length;
  const spreadSamples = (spec.spreadMs / 1000) * spec.sampleRate;
  const onsets = ordered.map((s, j) => ({
    idx: s.idx,
    sample: count > 1 ? Math.round((spreadSamples * j) / (count - 1)) : 0,
  }));
  const notes = ordered.map((s) => {
    const x = renderNote(s.note);
    // Normalize before muting so a muted string starts exactly as loud as a ringing one would.
    normalizeNote(x, spec.sampleRate);
    applyMuteEnvelope(x, s.note);
    const g = 10 ** (s.gainDb / 20);
    for (let i = 0; i < x.length; i++) x[i] = x[i]! * g;
    return x;
  });
  const length = totalSamples ?? Math.max(...notes.map((x, j) => x.length + onsets[j]!.sample));
  const signal = new Float32Array(length);
  notes.forEach((x, j) => {
    const offset = onsets[j]!.sample;
    const end = Math.min(length, offset + x.length);
    for (let i = offset; i < end; i++) signal[i] = signal[i]! + x[i - offset]!;
  });
  return { signal, stringOnsets: onsets, firstOnset: 0 };
}
