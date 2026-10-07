import { describe, expect, it } from 'vitest';
import { energyOnset, selectTakeEvent } from './take';

const FS = 48000;
const ev = (ms: number) => ({
  sample: Math.round((ms / 1000) * FS),
  coarseSample: 0,
  strength: 1,
  members: 1,
});

describe('take selection (shared by app runners and benchmarks)', () => {
  it('takes the first onset after arming', () => {
    const r = selectTakeEvent([ev(100), ev(1200)], FS, Math.round(0.05 * FS));
    expect(r).toEqual({ ok: true, event: ev(100) });
  });

  it('RETRY(NO_ONSET) without events and RETRY(MULTIPLE_ONSETS) with a second onset inside +400 ms', () => {
    expect(selectTakeEvent([], FS)).toEqual({ ok: false, reason: 'NO_ONSET' });
    expect(selectTakeEvent([ev(100), ev(400)], FS)).toEqual({ ok: false, reason: 'MULTIPLE_ONSETS' });
    expect(selectTakeEvent([ev(100), ev(600)], FS).ok).toBe(true);
  });

  it('energy fallback finds a soft pluck and ignores steady noise', () => {
    const signal = new Float32Array(FS);
    let x = 7;
    for (let i = 0; i < signal.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      signal[i] = 1e-4 * ((x / 0x7fffffff) * 2 - 1);
    }
    expect(energyOnset(signal, FS, Math.round(0.3 * FS), FS)).toBeNull();
    const at = Math.round(0.5 * FS);
    for (let i = at; i < FS; i++)
      signal[i] =
        signal[i]! + 0.02 * Math.exp(-(i - at) / FS) * Math.sin((2 * Math.PI * 196 * (i - at)) / FS);
    const found = energyOnset(signal, FS, Math.round(0.3 * FS), FS);
    expect(found).not.toBeNull();
    expect(Math.abs(found! - at) / FS).toBeLessThan(0.015);
  });
});
