/**
 * Leakage-aware spectral floor. A probe frequency next to a strong partial sees that partial's Hann
 * side-lobe (−31 dB at 2.5 bins, ~1/b³ beyond), which can sit far above the stationary noise.
 * Evidence at f is therefore measured against noise + c·Σ_j A_j·W((f − f_j)/Δ), where A_j are the measured
 * magnitudes of known (expected) partials and W is the Hann kernel magnitude in analysis bins.
 */

/** |Hann kernel| at an offset of `b` analysis bins (1 at 0). */
export function hannKernel(b: number): number {
  const x = Math.abs(b);
  if (x < 1e-6) return 1;
  if (Math.abs(x - 1) < 1e-6) return 0.5;
  return Math.abs(Math.sin(Math.PI * x) / (Math.PI * x) / (1 - x * x));
}

export interface KnownPartial {
  hz: number;
  mag: number;
}

/**
 * Predicted leakage magnitude at `hz` from `known` partials (analysis bin width `binHz`), skipping
 * partials closer than `excludeWithinBins` (those are the probe's own peak, not leakage).
 */
export function leakageAt(
  hz: number,
  known: readonly KnownPartial[],
  binHz: number,
  excludeWithinBins = 0.5,
): number {
  let sum = 0;
  for (const k of known) {
    const b = (hz - k.hz) / binHz;
    if (Math.abs(b) < excludeWithinBins) continue;
    // Inside the main lobe the "leakage" is the neighbour itself; cap at the kernel value there.
    sum += k.mag * hannKernel(b);
  }
  return sum;
}
