/**
 * Play-along backing (SPEC v1.1 §8.6): a synthesized bass (root on beats 1 and 3) plus the song pattern
 * strummed with the bar's chord. The same renderer feeds the app's AudioBuffer and the benchmark's
 * speaker-bleed model; it returns every event time so the detector can mask the backing (§10.12).
 */
import { isPlayedSlot, patternSlotTimes, type StrumPattern, slotsPerBeat } from '../../content/patterns';
import { deriveSeed, mulberry32, uniform } from '../../domain/prng';
import { STANDARD_TUNING, symbolRootPitchClass } from '../../domain/theory';
import type { ChordVoicing } from '../../domain/voicing';
import { type NoteSpec, randomTimbre, renderNote, type SynthModel } from './note';
import { normalizeNote, renderStrum } from './strum';

export interface BackingSpec {
  /** One chord per bar (repeats when shorter than `bars`). */
  chords: readonly ChordVoicing[];
  /** Chord at a time (s, buffer time) — overrides `chords` for every event (a chart that changes mid-bar). */
  chordAt?: (timeS: number) => ChordVoicing;
  pattern: StrumPattern;
  bpm: number;
  bars: number;
  sampleRate: number;
  model: SynthModel;
  seed: number;
  swingRatio?: number;
  /** Bass level relative to a strum (dB). */
  bassDb?: number;
  /** Silence before the first beat (s). */
  leadS?: number;
}

export type BackingEventKind = 'bass' | 'strum' | 'both';

export interface BackingEvent {
  /** Onset in the backing buffer (s). */
  time: number;
  kind: BackingEventKind;
}

export interface RenderedBacking {
  signal: Float32Array;
  /** Distinct event times (bass and strum at the same instant merge into 'both'). */
  events: BackingEvent[];
}

/** Bass note: the chord root in the E2–D#3 octave. */
export function bassMidi(voicing: ChordVoicing): number {
  const pc = symbolRootPitchClass(voicing.symbol) ?? 4;
  return 40 + ((pc - 4 + 12) % 12);
}

function timbre(spec: BackingSpec, label: string, f0: number, durationS: number): NoteSpec {
  const seed = deriveSeed(spec.seed, label);
  return {
    model: spec.model,
    f0,
    sampleRate: spec.sampleRate,
    durationS,
    inharmonicityB: 5e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    seed,
  };
}

function mixAt(target: Float32Array, source: Float32Array, at: number, gain: number): void {
  const end = Math.min(target.length, at + source.length);
  for (let i = Math.max(0, at); i < end; i++) target[i] = target[i]! + gain * source[i - at]!;
}

export function renderBacking(spec: BackingSpec): RenderedBacking {
  const fs = spec.sampleRate;
  const lead = spec.leadS ?? 0;
  const beatS = 60 / spec.bpm;
  const beatsPerBar = spec.pattern.slots.length / slotsPerBeat(spec.pattern);
  const barS = beatsPerBar * beatS;
  const total = Math.round((lead + spec.bars * barS + 2) * fs);
  const signal = new Float32Array(total);
  const rng = mulberry32(deriveSeed(spec.seed, 'backing'));
  const slots = patternSlotTimes(spec.pattern, lead, spec.bpm, spec.bars, spec.swingRatio);
  const bassGain = 10 ** ((spec.bassDb ?? 0) / 20);
  const times = new Map<number, BackingEventKind>();
  const mark = (time: number, kind: 'bass' | 'strum') => {
    const key = Math.round(time * 1e6);
    const prev = times.get(key);
    times.set(key, prev && prev !== kind ? 'both' : kind);
  };
  for (let bar = 0; bar < spec.bars; bar++) {
    const barChord = spec.chords[bar % spec.chords.length]!;
    const chordFor = (time: number) => spec.chordAt?.(time) ?? barChord;
    // Bass on beats 1 and 3 (4/4) or on beat 1 (other meters), held until the next bass note.
    const bassBeats = beatsPerBar >= 4 ? [0, 2] : [0];
    for (const b of bassBeats) {
      const t = lead + bar * barS + b * beatS;
      const dur = Math.min(2 * beatS, 2.5);
      const note = renderNote(
        timbre(spec, `bass:${bar}:${b}`, 440 * 2 ** ((bassMidi(chordFor(t)) - 69) / 12), dur),
      );
      normalizeNote(note, fs);
      // The bass player damps the note at the end of its value.
      const fade = Math.round(0.02 * fs);
      for (let i = Math.max(0, note.length - fade); i < note.length; i++)
        note[i] = note[i]! * ((note.length - i) / fade);
      mixAt(signal, note, Math.round(t * fs), bassGain);
      mark(t, 'bass');
    }
    spec.pattern.slots.forEach((symbol, j) => {
      if (!isPlayedSlot(symbol)) return;
      const slot = slots[bar * spec.pattern.slots.length + j]!;
      const chord = chordFor(slot.time);
      const strings = chord.frets.flatMap((fret, idx) =>
        fret === 'x'
          ? []
          : [
              {
                idx,
                note: timbre(
                  spec,
                  `strum:${bar}:${j}:${idx}`,
                  440 * 2 ** ((STANDARD_TUNING.openMidi[idx]! + fret - 69) / 12),
                  Math.min(1.5, 2 * beatS),
                ),
                gainDb: uniform(rng, -2, 2),
              },
            ],
      );
      const strum = renderStrum({
        strings,
        direction: symbol === 'U' ? 'up' : 'down',
        spreadMs: uniform(rng, 10, 25),
        sampleRate: fs,
      });
      mixAt(signal, strum.signal, Math.round(slot.time * fs), 1);
      mark(slot.time, 'strum');
    });
  }
  const events = [...times.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, kind]) => ({ time: key / 1e6, kind }));
  return { signal, events };
}
