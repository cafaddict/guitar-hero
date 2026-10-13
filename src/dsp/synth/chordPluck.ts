/**
 * String-by-string chord check take (E1 pluck mode, D-074): the chord's strings are plucked one after another
 * from low to high and keep ringing while the next one is judged. The last pluck is the take under test:
 * the expected note, a wrong fret, a muted string, the previous string plucked again, or a body knock.
 * Pure, seeded; returns the dry signal (callers add the channel).
 */
import { deriveSeed } from '../../domain/prng';
import { midiToHz } from '../../domain/theory';
import { renderKnock } from './knock';
import { applyMuteEnvelope, type NoteSpec, randomTimbre, renderNote, type SynthModel } from './note';
import { normalizeNote } from './strum';

export type ChordPluckTarget = 'clean' | 'wrong-up' | 'wrong-down' | 'muted' | 'replucked' | 'knock';

export interface ChordPluckSpec {
  sampleRate: number;
  /** Sounding MIDI note per string idx (0 = 6th string); null = not played (x). */
  midi: readonly (number | null)[];
  /** The string under test; every played string below it is plucked first. */
  targetIdx: number;
  target: ChordPluckTarget;
  /** Seconds between consecutive plucks. */
  intervalS: number;
  /** Level of the earlier (ringing) strings relative to the take (dB). */
  ringingGainDb: number;
  model: SynthModel;
  seed: number;
  /** Knock level relative to a note (dB), target 'knock' only. */
  knockGainDb?: number;
}

export interface ChordPluck {
  signal: Float32Array;
  /** Onset of the take (sample). */
  targetOnset: number;
  /** The note the take is judged against. */
  expectedF0: number;
  /** Strings sounding before the take, oldest first (onset sample). */
  ringing: { idx: number; f0: number; onset: number }[];
}

const PRE_ROLL_S = 0.6;
const TAIL_S = 1;
/** A re-picked string is damped over this long before the new attack (same as the sequence synth). */
const REPICK_DAMP_MS = 5;

function noteSpec(spec: ChordPluckSpec, f0: number, label: string, durationS: number): NoteSpec {
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

function render(spec: NoteSpec, gainDb: number, muted = false): Float32Array {
  const buffer = renderNote(spec);
  normalizeNote(buffer, spec.sampleRate);
  if (muted) applyMuteEnvelope(buffer, { ...spec, muted: true });
  const g = 10 ** (gainDb / 20);
  for (let i = 0; i < buffer.length; i++) buffer[i] = buffer[i]! * g;
  return buffer;
}

export function renderChordPluck(spec: ChordPluckSpec): ChordPluck {
  const fs = spec.sampleRate;
  const targetMidi = spec.midi[spec.targetIdx];
  if (targetMidi === null || targetMidi === undefined) throw new Error('the target string must be played');
  const earlier = spec.midi
    .map((m, idx) => ({ idx, m }))
    .filter((s): s is { idx: number; m: number } => s.idx < spec.targetIdx && s.m !== null);
  if (spec.target === 'replucked' && earlier.length === 0)
    throw new Error('replucked needs an earlier string');
  const targetOnset = Math.round((PRE_ROLL_S + earlier.length * spec.intervalS) * fs);
  const total = targetOnset + Math.round(TAIL_S * fs);
  const signal = new Float32Array(total);
  const add = (buffer: Float32Array, onset: number, until = total) => {
    for (let k = 0; k < buffer.length && onset + k < until; k++)
      signal[onset + k] = signal[onset + k]! + buffer[k]!;
  };
  const ringing = earlier.map((s, i) => ({
    idx: s.idx,
    f0: midiToHz(s.m),
    onset: Math.round((PRE_ROLL_S + i * spec.intervalS) * fs),
  }));
  const damp = Math.round((REPICK_DAMP_MS / 1000) * fs);
  for (const r of ringing) {
    const buffer = render(noteSpec(spec, r.f0, `s${r.idx}`, (total - r.onset) / fs), spec.ringingGainDb);
    if (spec.target === 'replucked' && r === ringing[ringing.length - 1]) {
      // The same string is picked again: its old vibration stops just before the new attack.
      const stopAt = targetOnset - r.onset;
      for (let k = Math.max(0, stopAt - damp); k < buffer.length; k++)
        buffer[k] = k < stopAt ? buffer[k]! * (1 - (k - (stopAt - damp)) / damp) : 0;
    }
    add(buffer, r.onset);
  }
  const expectedF0 = midiToHz(targetMidi);
  const takeS = (total - targetOnset) / fs;
  switch (spec.target) {
    case 'knock':
      add(
        (() => {
          const k = renderKnock({ sampleRate: fs, durationS: takeS, seed: deriveSeed(spec.seed, 'knock') });
          const g = 10 ** ((spec.knockGainDb ?? 0) / 20);
          return k.map((x) => x * g);
        })(),
        targetOnset,
      );
      break;
    case 'replucked': {
      const prev = ringing[ringing.length - 1]!;
      add(render(noteSpec(spec, prev.f0, 'take', takeS), 0), targetOnset);
      break;
    }
    default: {
      const shift = spec.target === 'wrong-up' ? 1 : spec.target === 'wrong-down' ? -1 : 0;
      add(
        render(noteSpec(spec, midiToHz(targetMidi + shift), 'take', takeS), 0, spec.target === 'muted'),
        targetOnset,
      );
    }
  }
  return { signal, targetOnset, expectedF0, ringing };
}
