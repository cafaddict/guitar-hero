import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../domain/prng';
import { magnitudeSpectrum, partialPeak, rms } from '../spectrum';
import { applyChannel, smallRoomIr } from './channel';
import { renderClick } from './click';
import { applyMuteEnvelope, type NoteSpec, renderNote } from './note';
import { renderStrum } from './strum';

function note(overrides: Partial<NoteSpec>): NoteSpec {
  return {
    model: 'karplus-strong',
    f0: 110,
    sampleRate: 48000,
    durationS: 1.2,
    inharmonicityB: 1e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    brightness: 0.7,
    pickPosition: 0.15,
    t60S: 4,
    seed: 1,
    ...overrides,
  };
}

/** High-resolution f0 measurement: 1 s Hann window, ~0.05 Hz bins, log-parabolic interpolation. */
function measureF0(x: Float32Array, fs: number, nominal: number): number {
  const spec = magnitudeSpectrum(x, Math.round(0.05 * fs), fs, fs, 20);
  return partialPeak(spec, nominal, 30).hz;
}

describe('synth f0 accuracy (thresholds.matrix.synthF0ErrorCentsMax = 0.5)', () => {
  const cases: [string, number, number][] = [];
  for (const fs of [44100, 48000])
    for (const f0 of [82.41, 110, 146.83, 196, 246.94, 329.63, 523.25, 659.26])
      cases.push([`${f0}@${fs}`, f0, fs]);

  it.each(cases)('karplus-strong %s', (_label, f0, fs) => {
    const x = renderNote(note({ f0, sampleRate: fs }));
    const cents = 1200 * Math.log2(measureF0(x, fs, f0) / f0);
    expect(Math.abs(cents)).toBeLessThanOrEqual(0.5);
  });

  it.each(cases)('additive %s', (_label, f0, fs) => {
    const x = renderNote(note({ model: 'additive', f0, sampleRate: fs, inharmonicityB: 1.5e-4 }));
    const cents = 1200 * Math.log2(measureF0(x, fs, f0) / f0);
    expect(Math.abs(cents)).toBeLessThanOrEqual(0.5);
  });
});

describe('synth models', () => {
  it('additive partials follow f_h = h·f0·√(1+B·h²)', () => {
    const fs = 48000;
    const B = 1e-4;
    const x = renderNote(note({ model: 'additive', f0: 110, inharmonicityB: B, durationS: 1.5 }));
    const spec = magnitudeSpectrum(x, 2400, fs, fs, 8);
    for (const h of [3, 7]) {
      const expected = h * 110 * Math.sqrt(1 + B * h * h);
      expect(Math.abs(1200 * Math.log2(partialPeak(spec, expected, 20).hz / expected))).toBeLessThan(0.5);
    }
  });

  it('weak fundamental lowers partial 1 by about 20 dB', () => {
    for (const model of ['karplus-strong', 'additive'] as const) {
      const fs = 48000;
      const ref = magnitudeSpectrum(renderNote(note({ model })), 2400, 8192, fs, 2);
      const weak = magnitudeSpectrum(renderNote(note({ model, fundamentalDb: -20 })), 2400, 8192, fs, 2);
      const drop = 20 * Math.log10(partialPeak(weak, 110, 30).mag / partialPeak(ref, 110, 30).mag);
      const drop2 = 20 * Math.log10(partialPeak(weak, 220, 30).mag / partialPeak(ref, 220, 30).mag);
      expect(drop, model).toBeLessThan(-15);
      expect(drop2, model).toBeGreaterThan(-4);
    }
  });

  it('muted envelope reaches −30 dB in 120 ms', () => {
    const x = new Float32Array(48000).fill(1);
    applyMuteEnvelope(x, note({ muted: true }));
    expect(20 * Math.log10(x[Math.round(0.12 * 48000)]!)).toBeCloseTo(-30, 1);
  });

  it('is deterministic for a seed', () => {
    expect(renderNote(note({ seed: 5 }))).toEqual(renderNote(note({ seed: 5 })));
  });
});

describe('strum and channel', () => {
  it('orders string onsets down 6→1 / up 1→6 across the spread', () => {
    const strings = [0, 2, 4].map((idx) => ({
      idx,
      note: note({ f0: 100 + idx * 50, durationS: 0.3 }),
      gainDb: 0,
    }));
    const down = renderStrum({ strings, direction: 'down', spreadMs: 40, sampleRate: 48000 });
    expect(down.stringOnsets).toEqual([
      { idx: 0, sample: 0 },
      { idx: 2, sample: 960 },
      { idx: 4, sample: 1920 },
    ]);
    const up = renderStrum({ strings, direction: 'up', spreadMs: 40, sampleRate: 48000 });
    expect(up.stringOnsets[0]).toEqual({ idx: 4, sample: 0 });
  });

  it('adds noise at the requested SNR as measured on the final recording (all noise colours, LPF on/off)', () => {
    const fs = 48000;
    const dry = renderNote(note({ durationS: 1 }));
    for (const snrDb of [15, 25, 40]) {
      for (const micHighpassHz of [0, 150]) {
        for (const noiseColor of ['white', 'pink'] as const) {
          for (const lowpass8k of [false, true]) {
            const spec = {
              sampleRate: fs,
              snrDb,
              noiseColor,
              micHighpassHz,
              reverb: 'small-room' as const,
              rt60S: 0.3,
              drrDb: 3,
              lowpass8k,
              snrRef: { start: 0, end: fs / 2 },
              targetPeak: 0.5,
              seed: 3,
            };
            const out = applyChannel(dry, spec);
            const noiseless = applyChannel(dry, { ...spec, snrDb: null });
            const residual = out.signal.map((x, i) => x - noiseless.signal[i]!);
            const measured =
              20 * Math.log10(rms(noiseless.signal, 0, fs / 2) / rms(residual, 0, residual.length));
            expect(measured, `${noiseColor} lpf=${lowpass8k} hpf=${micHighpassHz}`).toBeCloseTo(snrDb, 1);
          }
        }
      }
    }
  });

  it('small-room IR has the requested direct-to-reverberant ratio', () => {
    const ir = smallRoomIr(48000, 0.3, 3, mulberry32(1));
    let tail = 0;
    for (let i = 1; i < ir.length; i++) tail += ir[i]! * ir[i]!;
    expect(10 * Math.log10(1 / tail)).toBeCloseTo(3, 5);
  });

  it('click is ≤ 15 ms with energy in 2–4 kHz', () => {
    const click = renderClick(48000, false);
    expect(click.length).toBeLessThanOrEqual(0.015 * 48000);
    const spec = magnitudeSpectrum(click, 0, click.length, 48000, 8);
    const peak = partialPeak(spec, 3000, 600);
    expect(peak.hz).toBeGreaterThan(2000);
    expect(peak.hz).toBeLessThan(4000);
  });
});
