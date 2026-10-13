/** "들어 보기" for a riff (D-080): one pass through it at the run's tempo, from the shared synthesizer. */
import { type Riff, riffNotes } from '../../content/riffs';
import { positionMidi } from '../../content/scales';
import { midiToHz } from '../../domain/theory';
import { randomTimbre } from '../../dsp/synth/note';
import { renderSequence } from '../../dsp/synth/sequence';
import { normalizeNote } from '../../dsp/synth/strum';

/** Silence after the last note so it rings out. */
const TAIL_S = 1;
/** A palm-muted riff (R4) sounds short. */
const PALM_MUTE_DECAY_S = 0.15;

export function renderRiffDemo(riff: Riff, bpm: number, sampleRate: number): Float32Array {
  const slotS = 60 / bpm / (riff.value === 'e' ? 2 : 1);
  const notes = riffNotes(riff);
  const total = Math.round((notes.length * slotS + TAIL_S) * sampleRate);
  const { signal } = renderSequence(
    notes.map((n, i) => ({
      time: i * slotS,
      string: n.string,
      gainDb: 0,
      ...(riff.palmMute ? { palmMuteDecayS: PALM_MUTE_DECAY_S } : {}),
      note: {
        model: 'karplus-strong',
        f0: midiToHz(positionMidi(n)),
        sampleRate,
        durationS: slotS + TAIL_S,
        inharmonicityB: 1e-4,
        muted: false,
        mutedDecayDb: 0,
        mutedDecayMs: 120,
        fundamentalDb: 0,
        ...randomTimbre(i * 7 + n.string),
        seed: i * 7 + n.string,
      },
    })),
    sampleRate,
    total,
  );
  normalizeNote(signal, sampleRate);
  return signal;
}
