import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../domain/prng';
import { inverseRealFft, naiveDft, realFft } from './fft';
import { applyBiquad, biquadGain, fftConvolve, highpass, lowpass } from './filters';
import { magnitudeSpectrum, partialPeak } from './spectrum';

describe('FFT (SPEC §10.2)', () => {
  it.each([8, 64, 1024, 4096])('realFft matches a naive DFT within 1e-6 relative error (n=%i)', (n) => {
    const rng = mulberry32(n);
    const x = Float64Array.from({ length: n }, () => rng() * 2 - 1);
    const re = new Float64Array(n / 2 + 1);
    const im = new Float64Array(n / 2 + 1);
    realFft(x, n, re, im);
    const ref = naiveDft(x, n);
    let maxRef = 0;
    let maxErr = 0;
    for (let k = 0; k <= n / 2; k++) {
      maxRef = Math.max(maxRef, Math.hypot(ref.re[k]!, ref.im[k]!));
      maxErr = Math.max(maxErr, Math.hypot(re[k]! - ref.re[k]!, im[k]! - ref.im[k]!));
    }
    expect(maxErr / maxRef).toBeLessThanOrEqual(1e-6);
  });

  it('inverseRealFft round-trips', () => {
    const n = 512;
    const rng = mulberry32(9);
    const x = Float64Array.from({ length: n }, () => rng() - 0.5);
    const re = new Float64Array(n / 2 + 1);
    const im = new Float64Array(n / 2 + 1);
    realFft(x, n, re, im);
    const back = new Float64Array(n);
    inverseRealFft(re, im, n, back);
    for (let i = 0; i < n; i++) expect(back[i]!).toBeCloseTo(x[i]!, 10);
  });

  it('zero-pads short input', () => {
    const re = new Float64Array(5);
    const im = new Float64Array(5);
    realFft([1, 1], 8, re, im);
    expect(re[0]).toBeCloseTo(2, 12);
  });
});

describe('spectrum', () => {
  it('measures a sinusoid amplitude and frequency', () => {
    const fs = 48000;
    const f = 1234.5;
    const x = Float32Array.from({ length: 8192 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * f * i) / fs));
    const spec = magnitudeSpectrum(x, 0, 8192, fs, 2);
    const peak = partialPeak(spec, 1230, 50);
    expect(peak.hz).toBeCloseTo(f, 0);
    expect(peak.mag).toBeGreaterThan(0.45);
    expect(peak.mag).toBeLessThan(0.55);
  });
});

describe('filters', () => {
  it('Butterworth HPF/LPF have −3 dB at the cutoff', () => {
    const fs = 48000;
    expect(biquadGain(highpass(150, fs), 150, fs)).toBeCloseTo(Math.SQRT1_2, 3);
    expect(biquadGain(highpass(150, fs), 5000, fs)).toBeCloseTo(1, 2);
    expect(biquadGain(lowpass(8000, fs), 8000, fs)).toBeCloseTo(Math.SQRT1_2, 3);
    const dc = applyBiquad(new Float32Array(2000).fill(1), highpass(100, fs));
    expect(Math.abs(dc[1999]!)).toBeLessThan(1e-3);
  });

  it('fftConvolve equals direct convolution', () => {
    const rng = mulberry32(3);
    const a = Float32Array.from({ length: 3000 }, () => rng() - 0.5);
    const b = Float32Array.from({ length: 700 }, () => rng() - 0.5);
    const fast = fftConvolve(a, b);
    for (const i of [0, 1, 500, 2999, 3500, 3698]) {
      let s = 0;
      for (let j = 0; j < b.length; j++) if (i - j >= 0 && i - j < a.length) s += a[i - j]! * b[j]!;
      expect(fast[i]!).toBeCloseTo(s, 4);
    }
    expect(fast.length).toBe(3699);
  });
});
