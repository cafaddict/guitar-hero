/**
 * IIR filters and FFT convolution (synth channel model, SPEC §14.2). Pure.
 */
import { inverseRealFft, nextPow2, realFft } from './fft';

export interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** RBJ cookbook 2nd-order Butterworth high-pass (Q = 1/√2). */
export function highpass(cutoffHz: number, sampleRate: number, q = Math.SQRT1_2): Biquad {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** RBJ cookbook 2nd-order Butterworth low-pass. */
export function lowpass(cutoffHz: number, sampleRate: number, q = Math.SQRT1_2): Biquad {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/** RBJ peaking EQ. */
export function peaking(centerHz: number, sampleRate: number, gainDb: number, q: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * centerHz) / sampleRate;
  const alpha = Math.sin(w0) / (2 * q);
  const cos = Math.cos(w0);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cos) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha / A) / a0,
  };
}

/** RBJ high shelf (slope S = 1): gain `gainDb` above `cornerHz` (palm-mute model, SPEC v1.1 §14.2). */
export function highshelf(cornerHz: number, sampleRate: number, gainDb: number): Biquad {
  const A = 10 ** (gainDb / 40);
  const w0 = (2 * Math.PI * cornerHz) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = (Math.sin(w0) / 2) * Math.SQRT2;
  const k = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 - (A - 1) * cos + k;
  return {
    b0: (A * (A + 1 + (A - 1) * cos + k)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - k)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - k) / a0,
  };
}

/** Applies a biquad (direct form II transposed) and returns a new array. */
export function applyBiquad(input: ArrayLike<number>, f: Biquad): Float32Array {
  const out = new Float32Array(input.length);
  let z1 = 0;
  let z2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i]!;
    const y = f.b0 * x + z1;
    z1 = f.b1 * x - f.a1 * y + z2;
    z2 = f.b2 * x - f.a2 * y;
    out[i] = y;
  }
  return out;
}

/** Magnitude response |H(e^{jw})| of a biquad at `hz`. */
export function biquadGain(f: Biquad, hz: number, sampleRate: number): number {
  const w = (2 * Math.PI * hz) / sampleRate;
  const cr = (c: number, a: number, b: number) =>
    [c + a * Math.cos(-w) + b * Math.cos(-2 * w), a * Math.sin(-w) + b * Math.sin(-2 * w)] as const;
  const [nr, ni] = cr(f.b0, f.b1, f.b2);
  const [dr, di] = cr(1, f.a1, f.a2);
  return Math.hypot(nr, ni) / Math.hypot(dr, di);
}

/** Linear convolution via overlap-add FFT. Output length = signal + ir − 1. */
export function fftConvolve(signal: Float32Array, ir: Float32Array): Float32Array {
  const out = new Float32Array(signal.length + ir.length - 1);
  const block = Math.max(1024, nextPow2(ir.length));
  const n = nextPow2(block + ir.length - 1);
  const bins = n / 2 + 1;
  const irRe = new Float64Array(bins);
  const irIm = new Float64Array(bins);
  const padded = new Float64Array(n);
  padded.set(ir);
  realFft(padded, n, irRe, irIm);
  const re = new Float64Array(bins);
  const im = new Float64Array(bins);
  const time = new Float64Array(n);
  const chunk = new Float64Array(n);
  for (let start = 0; start < signal.length; start += block) {
    chunk.fill(0);
    const len = Math.min(block, signal.length - start);
    for (let i = 0; i < len; i++) chunk[i] = signal[start + i]!;
    realFft(chunk, n, re, im);
    for (let k = 0; k < bins; k++) {
      const r = re[k]! * irRe[k]! - im[k]! * irIm[k]!;
      const i2 = re[k]! * irIm[k]! + im[k]! * irRe[k]!;
      re[k] = r;
      im[k] = i2;
    }
    inverseRealFft(re, im, n, time);
    const end = Math.min(out.length, start + n);
    for (let i = start; i < end; i++) out[i] = out[i]! + time[i - start]!;
  }
  return out;
}
