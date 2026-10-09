import { describe, expect, it } from 'vitest';
import { patternById, patternSlotTimes } from '../../content/patterns';
import { voicingById } from '../../content/voicings';
import { applyBiquad, highpass, lowpass } from '../filters';
import { magnitudeSpectrum, rms } from '../spectrum';
import { bassMidi, renderBacking } from './backing';
import { applyBuzz, applyPalmMute, BUZZ_LEVEL_DB } from './effects';
import { type NoteSpec, randomTimbre, renderNote } from './note';
import { renderSequence } from './sequence';
import { normalizeNote } from './strum';

const FS = 48000;

function note(f0: number, seed: number, model: NoteSpec['model'] = 'karplus-strong'): NoteSpec {
  return {
    model,
    f0,
    sampleRate: FS,
    durationS: 1.5,
    inharmonicityB: 5e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    seed,
  };
}

/** Energy of x[start, start+len) in the 2–8 kHz band. */
function bandEnergy(x: Float32Array, start: number, len: number): number {
  const band = applyBiquad(applyBiquad(x, highpass(2000, FS)), lowpass(8000, FS));
  let e = 0;
  for (let i = start; i < start + len; i++) e += band[i]! ** 2;
  return e;
}

describe('SPEC v1.1 §14.2 single-note sequence synthesis', () => {
  it('a note on the same string cuts the previous one; another string lets it ring', () => {
    const at = Math.round(0.5 * FS);
    const same = renderSequence(
      [
        { time: 0, string: 6, note: note(110, 1), gainDb: 0 },
        { time: 0.5, string: 6, note: { ...note(110, 2), f0: 1e-9 + 110 }, gainDb: -120 },
      ],
      FS,
      FS,
    );
    const other = renderSequence(
      [
        { time: 0, string: 6, note: note(110, 1), gainDb: 0 },
        { time: 0.5, string: 5, note: note(110, 2), gainDb: -120 },
      ],
      FS,
      FS,
    );
    // After the cut only the (silent) new note remains on that string.
    expect(rms(same.signal, at + 100, at + 4800)).toBeLessThan(1e-4);
    expect(rms(other.signal, at + 100, at + 4800)).toBeGreaterThan(0.02);
    expect(same.onsets).toEqual([0, at]);
  });

  it.each(['karplus-strong', 'additive'] as const)(
    '%s: the 2–8 kHz energy a hammer-on adds is ≤ −20 dB of a picked attack',
    (model) => {
      const at = Math.round(0.5 * FS);
      const attack = Math.round(0.01 * FS);
      for (const [a, b] of [
        [1, 3],
        [5, 7],
        [11, 13],
        [21, 2],
        [31, 37],
      ] as const) {
        const render = (legato: boolean) =>
          renderSequence(
            [
              { time: 0, string: 6, note: note(110, a, model), gainDb: 0 },
              { time: 0.5, string: 6, note: note(146.83, b, model), gainDb: 0, legato },
            ],
            FS,
            FS,
          ).signal;
        const hammered = render(true);
        // The string already rings before the hammer: only what the hammer adds is its attack.
        const added = bandEnergy(hammered, at, attack) - bandEnergy(hammered, at - attack, attack);
        const picked = bandEnergy(render(false), at, attack);
        expect(10 * Math.log10(Math.max(1e-30, added) / picked), `${a},${b}`).toBeLessThanOrEqual(-20);
      }
    },
  );

  it('a hammer-on continues at the string level and sounds the new pitch', () => {
    const at = Math.round(0.5 * FS);
    const { signal } = renderSequence(
      [
        { time: 0, string: 5, note: note(110, 1), gainDb: 0 },
        { time: 0.5, string: 5, note: note(130.81, 4), gainDb: 0, legato: true },
      ],
      FS,
      Math.round(1.2 * FS),
    );
    const before = rms(signal, at - 960, at);
    const after = rms(signal, at + 480, at + 1440);
    expect(after / before).toBeGreaterThan(0.5);
    expect(after / before).toBeLessThan(2);
    const spec = magnitudeSpectrum(signal, at + 2400, 9600, FS, 4);
    const bin = (f: number) => spec.mag[Math.round(f / spec.binHz)]!;
    expect(bin(130.81)).toBeGreaterThan(5 * bin(110));
  });
});

describe('SPEC v1.1 §14.2 beta technique models', () => {
  it('buzz adds a rattle near BUZZ_LEVEL_DB at strength 1 and ~10 dB less at 0.2', () => {
    const rattleDb = (strength: number) => {
      const clean = renderNote(note(82.41, 5));
      normalizeNote(clean, FS);
      const buzzed = clean.slice();
      applyBuzz(buzzed, FS, strength, 9);
      const head = Math.round(0.2 * FS);
      return 20 * Math.log10(bandEnergy(buzzed, 0, head) ** 0.5 / rms(clean, 0, head) / Math.sqrt(head));
    };
    const full = rattleDb(1);
    expect(full).toBeGreaterThan(BUZZ_LEVEL_DB - 6);
    expect(full - rattleDb(0.2)).toBeGreaterThan(6);
  });

  it('palm mute decays to −60 dB at its decay time and darkens the top end', () => {
    const x = renderNote(note(110, 6));
    normalizeNote(x, FS);
    const pm = applyPalmMute(x, FS, 0.2);
    const early = rms(pm, 0, 2400);
    expect(20 * Math.log10(rms(pm, 9600, 12000) / early)).toBeLessThan(-40);
    expect(bandEnergy(pm, 0, 2400)).toBeLessThan(bandEnergy(x, 0, 2400) * 10 ** (-6 / 10));
  });
});

describe('SPEC v1.1 §8.6 backing', () => {
  it('plays the bass on beats 1 and 3 and the pattern strums, merging same-instant events', () => {
    const b = renderBacking({
      chords: [voicingById('C'), voicingById('G-3f')],
      pattern: patternById('P3'),
      bpm: 80,
      bars: 2,
      sampleRate: FS,
      model: 'additive',
      seed: 3,
    });
    const beat = 60 / 80;
    // P3 = D - D U - U D U → strums on slots 0,2,3,5,6,7; bass on beats 1 (slot 0) and 3 (slot 4).
    const bar1 = b.events.filter((e) => e.time < 4 * beat - 1e-6);
    expect(bar1.map((e) => e.kind)).toEqual(['both', 'strum', 'strum', 'bass', 'strum', 'strum', 'strum']);
    expect(bar1[3]!.time).toBeCloseTo(2 * beat, 9);
    expect(b.events).toHaveLength(14);
    expect(rms(b.signal, 0, FS)).toBeGreaterThan(0);
    expect(bassMidi(voicingById('C'))).toBe(48);
    expect(bassMidi(voicingById('E'))).toBe(40);
  });

  it('swing slots sit at r/(1+r) of the beat; straight patterns split it evenly', () => {
    const swing = patternSlotTimes(patternById('P8'), 1, 60, 1, 2);
    expect(swing[1]!.time - swing[0]!.time).toBeCloseTo(2 / 3, 9);
    expect(swing[2]!.time - swing[0]!.time).toBeCloseTo(1, 9);
    const straight = patternSlotTimes(patternById('P2'), 0, 60, 1);
    expect(straight[1]!.time).toBeCloseTo(0.5, 9);
    expect(straight.map((s) => s.expected)).toEqual([true, false, true, true, true, true, true, false]);
    expect(patternSlotTimes(patternById('P6'), 0, 60, 1)[4]!.expected).toBe(true);
  });
});
