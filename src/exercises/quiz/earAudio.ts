/** Ear-training audio from the shared synthesizer (SPEC §8.6: the same synth as the test fixtures). */
import { midiToHz } from '../../domain/theory';
import { randomTimbre } from '../../dsp/synth/note';
import { normalizeNote, renderStrum } from '../../dsp/synth/strum';
import { type EarPrompt, earSounds } from './questions';

/** Seconds between the sounds of a question (interval notes, progression chords). */
export const EAR_SOUND_GAP_S = 0.9;

function renderSound(midis: readonly number[], seed: number, sampleRate: number): Float32Array {
  const strum = renderStrum({
    strings: midis.map((midi, k) => ({
      idx: k,
      gainDb: 0,
      note: {
        model: 'karplus-strong',
        f0: midiToHz(midi),
        sampleRate,
        durationS: 2,
        inharmonicityB: 1e-4,
        muted: false,
        mutedDecayDb: 0,
        mutedDecayMs: 120,
        fundamentalDb: 0,
        ...randomTimbre(seed * 10 + k),
        t60S: 2.5,
        seed: seed * 10 + k,
      },
    })),
    direction: 'down',
    spreadMs: midis.length > 1 ? 30 : 0,
    sampleRate,
  });
  normalizeNote(strum.signal, sampleRate);
  return strum.signal;
}

export function renderEarChord(prompt: EarPrompt, sampleRate: number): Float32Array {
  const sounds = earSounds(prompt).map((midis, k) => renderSound(midis, prompt.seed * 7 + k, sampleRate));
  const gap = Math.round(EAR_SOUND_GAP_S * sampleRate);
  const out = new Float32Array(gap * (sounds.length - 1) + Math.max(...sounds.map((x) => x.length)));
  sounds.forEach((x, k) => {
    // The previous sound is damped when the next one starts (a played progression, not a wash).
    if (k > 0) out.fill(0, k * gap);
    out.set(x, k * gap);
  });
  return out;
}
