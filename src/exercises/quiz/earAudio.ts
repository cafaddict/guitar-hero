/** Ear-training chord audio from the shared synthesizer (SPEC §8.6: the same synth as the test fixtures). */
import { randomTimbre } from '../../dsp/synth/note';
import { normalizeNote, renderStrum } from '../../dsp/synth/strum';
import { type EarPrompt, earChordHz } from './questions';

export function renderEarChord(prompt: EarPrompt, sampleRate: number): Float32Array {
  const strum = renderStrum({
    strings: earChordHz(prompt).map((f0, k) => ({
      idx: k,
      gainDb: 0,
      note: {
        model: 'karplus-strong',
        f0,
        sampleRate,
        durationS: 2,
        inharmonicityB: 1e-4,
        muted: false,
        mutedDecayDb: 0,
        mutedDecayMs: 120,
        fundamentalDb: 0,
        ...randomTimbre(prompt.seed * 10 + k),
        t60S: 2.5,
        seed: prompt.seed * 10 + k,
      },
    })),
    direction: 'down',
    spreadMs: 30,
    sampleRate,
  });
  normalizeNote(strum.signal, sampleRate);
  return strum.signal;
}
