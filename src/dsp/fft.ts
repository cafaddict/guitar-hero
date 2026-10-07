/**
 * Radix-2 FFT with precomputed twiddles and bit-reversal tables (SPEC §10.2). Pure, allocation-free
 * per call once a plan exists (plans are cached by size).
 *
 * realFft() packs N real samples into an N/2-point complex FFT and untangles the result, so a real
 * transform costs roughly half of a complex one.
 */

export class FftPlan {
  readonly size: number;
  private readonly cos: Float64Array;
  private readonly sin: Float64Array;
  private readonly rev: Uint32Array;

  constructor(size: number) {
    if (size < 2 || (size & (size - 1)) !== 0)
      throw new Error(`FFT size must be a power of two, got ${size}`);
    this.size = size;
    this.cos = new Float64Array(size / 2);
    this.sin = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / size);
      this.sin[i] = -Math.sin((2 * Math.PI * i) / size);
    }
    this.rev = new Uint32Array(size);
    const bits = Math.log2(size);
    for (let i = 0; i < size; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >>> b) & 1) << (bits - 1 - b);
      this.rev[i] = r;
    }
  }

  /** In-place forward complex FFT (e^{-i...}) of length `size`. */
  transform(re: Float64Array, im: Float64Array): void {
    const n = this.size;
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i]!;
      if (j > i) {
        const tr = re[i]!;
        re[i] = re[j]!;
        re[j] = tr;
        const ti = im[i]!;
        im[i] = im[j]!;
        im[j] = ti;
      }
    }
    const cosT = this.cos;
    const sinT = this.sin;
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >>> 1;
      const step = n / len;
      for (let start = 0; start < n; start += len) {
        let k = 0;
        for (let j = start; j < start + half; j++) {
          const wr = cosT[k]!;
          const wi = sinT[k]!;
          const l = j + half;
          const xr = re[l]! * wr - im[l]! * wi;
          const xi = re[l]! * wi + im[l]! * wr;
          re[l] = re[j]! - xr;
          im[l] = im[j]! - xi;
          re[j] = re[j]! + xr;
          im[j] = im[j]! + xi;
          k += step;
        }
      }
    }
  }
}

const complexPlans = new Map<number, FftPlan>();

export function fftPlan(size: number): FftPlan {
  let plan = complexPlans.get(size);
  if (!plan) {
    plan = new FftPlan(size);
    complexPlans.set(size, plan);
  }
  return plan;
}

/** Scratch buffers per size for the real FFT (module-level so hot paths do not allocate). */
interface RealScratch {
  re: Float64Array;
  im: Float64Array;
  twCos: Float64Array;
  twSin: Float64Array;
}
const realScratch = new Map<number, RealScratch>();

function scratchFor(n: number): RealScratch {
  let s = realScratch.get(n);
  if (!s) {
    const half = n / 2;
    s = {
      re: new Float64Array(half),
      im: new Float64Array(half),
      twCos: new Float64Array(half),
      twSin: new Float64Array(half),
    };
    for (let k = 0; k < half; k++) {
      s.twCos[k] = Math.cos((2 * Math.PI * k) / n);
      s.twSin[k] = -Math.sin((2 * Math.PI * k) / n);
    }
    realScratch.set(n, s);
  }
  return s;
}

/**
 * Forward FFT of a real signal of length n (power of two, input shorter than n is zero-padded).
 * Writes bins 0..n/2 (inclusive) into outRe/outIm (length ≥ n/2 + 1).
 */
export function realFft(input: ArrayLike<number>, n: number, outRe: Float64Array, outIm: Float64Array): void {
  const half = n / 2;
  const s = scratchFor(n);
  const re = s.re;
  const im = s.im;
  const len = Math.min(input.length, n);
  for (let k = 0; k < half; k++) {
    const i0 = 2 * k;
    re[k] = i0 < len ? input[i0]! : 0;
    im[k] = i0 + 1 < len ? input[i0 + 1]! : 0;
  }
  fftPlan(half).transform(re, im);
  // Untangle: X[k] = (Z[k] + conj(Z[N/2-k]))/2 + W^k (Z[k] - conj(Z[N/2-k]))/(2i)
  outRe[0] = re[0]! + im[0]!;
  outIm[0] = 0;
  outRe[half] = re[0]! - im[0]!;
  outIm[half] = 0;
  for (let k = 1; k < half; k++) {
    const zr = re[k]!;
    const zi = im[k]!;
    const cr = re[half - k]!;
    const ci = -im[half - k]!;
    const er = 0.5 * (zr + cr);
    const ei = 0.5 * (zi + ci);
    const or = 0.5 * (zi - ci);
    const oi = -0.5 * (zr - cr);
    const wr = s.twCos[k]!;
    const wi = s.twSin[k]!;
    outRe[k] = er + (or * wr - oi * wi);
    outIm[k] = ei + (or * wi + oi * wr);
  }
}

/** Inverse of realFft: takes bins 0..n/2 and writes n real samples (scaled by 1/n). */
export function inverseRealFft(inRe: Float64Array, inIm: Float64Array, n: number, out: Float64Array): void {
  const half = n / 2;
  const s = scratchFor(n);
  const re = s.re;
  const im = s.im;
  // Re-tangle into Z[k] = E[k] + i·O[k], conjugated for an inverse via the forward transform.
  for (let k = 0; k < half; k++) {
    const xr = inRe[k]!;
    const xi = inIm[k]!;
    const yr = inRe[half - k]!;
    const yi = -inIm[half - k]!;
    const er = 0.5 * (xr + yr);
    const ei = 0.5 * (xi + yi);
    const dr = 0.5 * (xr - yr);
    const di = 0.5 * (xi - yi);
    // O[k] = D[k] · conj(W^k) ... W^k = e^{-2πik/n}; inverse twiddle is e^{+2πik/n}
    const wr = s.twCos[k]!;
    const wi = -s.twSin[k]!;
    const or = dr * wr - di * wi;
    const oi = dr * wi + di * wr;
    // Z = E + i·O, conjugate for inverse-by-forward trick
    re[k] = er - oi;
    im[k] = -(ei + or);
  }
  fftPlan(half).transform(re, im);
  const scale = 1 / half;
  for (let k = 0; k < half; k++) {
    out[2 * k] = re[k]! * scale;
    out[2 * k + 1] = -im[k]! * scale;
  }
}

/** Naive DFT for tests (O(n²)). */
export function naiveDft(input: ArrayLike<number>, n: number): { re: Float64Array; im: Float64Array } {
  const re = new Float64Array(n / 2 + 1);
  const im = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < Math.min(n, input.length); t++) {
      const angle = (-2 * Math.PI * k * t) / n;
      sr += input[t]! * Math.cos(angle);
      si += input[t]! * Math.sin(angle);
    }
    re[k] = sr;
    im[k] = si;
  }
  return { re, im };
}

export function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}
