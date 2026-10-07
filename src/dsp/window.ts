/**
 * Analysis windows (SPEC §10.2). Cached per length.
 */
const hannCache = new Map<number, Float64Array>();

/** Periodic-free (symmetric) Hann window of length n. */
export function hann(n: number): Float64Array {
  let w = hannCache.get(n);
  if (!w) {
    w = new Float64Array(n);
    if (n === 1) w[0] = 1;
    else for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    hannCache.set(n, w);
  }
  return w;
}

/** Sum of window samples (coherent gain × n), used to convert FFT magnitudes to amplitudes. */
export function windowSum(w: Float64Array): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) s += w[i]!;
  return s;
}
