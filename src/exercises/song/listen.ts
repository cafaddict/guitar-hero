/** "들어 보기" audio: one down strum per beat of each bar's chord, from the shared synthesizer. */
import { type GVoicing, voicingById, voicingForClass } from '../../content/voicings';
import { STANDARD_TUNING } from '../../domain/theory';
import { expectedNotes } from '../../domain/voicing';
import { randomTimbre } from '../../dsp/synth/note';
import { normalizeNote, renderStrum } from '../../dsp/synth/strum';

export function renderChordProgression(
  chords: readonly string[],
  bpm: number,
  sampleRate: number,
  gVoicing: GVoicing,
  beatsPerBar = 4,
): Float32Array {
  const beatS = 60 / bpm;
  const total = Math.round((chords.length * beatsPerBar * beatS + 1.5) * sampleRate);
  const out = new Float32Array(total);
  chords.forEach((chord, bar) => {
    const voicing = voicingById(voicingForClass(chord, gVoicing));
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const seed = bar * 16 + beat + 1;
      const strum = renderStrum({
        strings: expectedNotes(voicing, STANDARD_TUNING).map((n) => ({
          idx: n.idx,
          gainDb: beat === 0 ? 0 : -4,
          note: {
            model: 'karplus-strong',
            f0: n.f0,
            sampleRate,
            durationS: beatS + 0.3,
            inharmonicityB: 1e-4,
            muted: false,
            mutedDecayDb: 0,
            mutedDecayMs: 120,
            fundamentalDb: 0,
            ...randomTimbre(seed * 7 + n.idx),
            seed: seed * 7 + n.idx,
          },
        })),
        direction: 'down',
        spreadMs: 20,
        sampleRate,
      }).signal;
      const start = Math.round((bar * beatsPerBar + beat) * beatS * sampleRate);
      for (let i = 0; i < strum.length && start + i < out.length; i++)
        out[start + i] = out[start + i]! + strum[i]! * 0.5;
    }
  });
  normalizeNote(out, sampleRate);
  return out;
}
