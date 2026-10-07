/** "들어 보기" for one chord: a down strum then the strings one by one, from the shared synthesizer. */
import { STANDARD_TUNING } from '../../domain/theory';
import { type ChordVoicing, expectedNotes } from '../../domain/voicing';
import { randomTimbre } from '../../dsp/synth/note';
import { normalizeNote, renderStrum } from '../../dsp/synth/strum';

export function renderChordPreview(voicing: ChordVoicing, sampleRate: number): Float32Array {
  const notes = expectedNotes(voicing, STANDARD_TUNING);
  const note = (f0: number, seed: number, durationS: number) => ({
    model: 'karplus-strong' as const,
    f0,
    sampleRate,
    durationS,
    inharmonicityB: 1e-4,
    muted: false,
    mutedDecayDb: 0,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    seed,
  });
  const strum = renderStrum({
    strings: notes.map((n) => ({ idx: n.idx, gainDb: 0, note: note(n.f0, 50 + n.idx, 2) })),
    direction: 'down',
    spreadMs: 25,
    sampleRate,
  }).signal;
  const plucks = notes.map(
    (n) =>
      renderStrum({
        strings: [{ idx: n.idx, gainDb: 0, note: note(n.f0, 60 + n.idx, 0.9) }],
        direction: 'down',
        spreadMs: 0,
        sampleRate,
      }).signal,
  );
  const gap = Math.round(0.45 * sampleRate);
  const out = new Float32Array(strum.length + gap * plucks.length + Math.round(0.6 * sampleRate));
  out.set(strum, 0);
  plucks.forEach((p, k) => {
    const start = strum.length + k * gap;
    for (let i = 0; i < p.length && start + i < out.length; i++) out[start + i] = out[start + i]! + p[i]!;
  });
  normalizeNote(out, sampleRate);
  return out;
}
