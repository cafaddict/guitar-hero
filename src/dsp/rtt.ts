/**
 * Round-trip latency (SPEC §10.8): 8 broadband probe bursts at irregular intervals; the recording is
 * matched-filtered with the probe and the lag maximizing the summed correlation energy over all bursts is
 * the RTT (irregular spacing makes it unambiguous). Per-burst refinement gives the MAD; success requires
 * MAD ≤ 2 ms and enough bursts above the correlation noise. No signal → an explicit failure, never a value.
 */
import { mulberry32 } from '../domain/prng';
import { fftConvolve } from './filters';

export interface RttParams {
  burstMs: number;
  /** Probe offsets (s) relative to the first burst; irregular on purpose. */
  offsetsS: readonly number[];
  maxRttMs: number;
  /** Correlation peak / robust noise ratio needed per burst. */
  minPeakRatio: number;
  minBursts: number;
  maxMadMs: number;
  refineMs: number;
}

export const DEFAULT_RTT_PARAMS: RttParams = {
  burstMs: 3,
  offsetsS: [0, 0.41, 0.73, 1.19, 1.47, 1.96, 2.27, 2.81],
  maxRttMs: 500,
  minPeakRatio: 8,
  minBursts: 6,
  maxMadMs: 2,
  refineMs: 4,
};

/** Deterministic broadband probe (Hann-windowed noise burst). */
export function rttProbe(sampleRate: number, params: RttParams = DEFAULT_RTT_PARAMS): Float32Array {
  const n = Math.round((params.burstMs / 1000) * sampleRate);
  const rng = mulberry32(0x5eed);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (rng() * 2 - 1) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  return out;
}

export type RttResult =
  | { ok: true; rttMs: number; madMs: number; detections: number; perBurstMs: number[]; processingMs: number }
  | { ok: false; reason: 'NO_SIGNAL' | 'INCONSISTENT'; detections: number; processingMs: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

/**
 * `recording` starts at `recordingStartS` on the same clock as `scheduledS` (scheduled burst times).
 */
export function estimateRtt(
  recording: Float32Array,
  sampleRate: number,
  recordingStartS: number,
  scheduledS: readonly number[],
  params: RttParams = DEFAULT_RTT_PARAMS,
): RttResult {
  const t0 = performance.now();
  const probe = rttProbe(sampleRate, params);
  const reversed = probe.slice().reverse();
  // Matched filter: correlation[i] aligns the probe start with recording index i.
  const conv = fftConvolve(recording, reversed);
  const corr = new Float64Array(recording.length);
  for (let i = 0; i < recording.length; i++) corr[i] = conv[i + probe.length - 1] ?? 0;
  const energy = new Float64Array(corr.length);
  for (let i = 0; i < corr.length; i++) energy[i] = corr[i]! * corr[i]!;
  const maxLag = Math.round((params.maxRttMs / 1000) * sampleRate);
  const starts = scheduledS.map((s) => Math.round((s - recordingStartS) * sampleRate));
  let bestLag = -1;
  let bestScore = -1;
  for (let lag = 0; lag <= maxLag; lag++) {
    let score = 0;
    for (const s of starts) score += energy[s + lag] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }
  // Robust correlation noise level across the search region.
  const sample: number[] = [];
  for (const s of starts)
    for (let lag = 0; lag <= maxLag; lag += 7) sample.push(Math.abs(corr[s + lag] ?? 0));
  const noise = median(sample) + 1e-12;
  const refine = Math.round((params.refineMs / 1000) * sampleRate);
  const perBurst: number[] = [];
  for (const s of starts) {
    let best = -1;
    let bestAbs = 0;
    for (let d = -refine; d <= refine; d++) {
      const i = s + bestLag + d;
      const v = Math.abs(corr[i] ?? 0);
      if (v > bestAbs) {
        bestAbs = v;
        best = i;
      }
    }
    if (best >= 0 && bestAbs / noise >= params.minPeakRatio) perBurst.push(((best - s) / sampleRate) * 1000);
  }
  const processingMs = Math.max(1e-3, performance.now() - t0);
  if (bestLag < 0 || perBurst.length < params.minBursts)
    return { ok: false, reason: 'NO_SIGNAL', detections: perBurst.length, processingMs };
  const rttMs = median(perBurst);
  const madMs = median(perBurst.map((x) => Math.abs(x - rttMs)));
  if (madMs > params.maxMadMs)
    return { ok: false, reason: 'INCONSISTENT', detections: perBurst.length, processingMs };
  return { ok: true, rttMs, madMs, detections: perBurst.length, perBurstMs: perBurst, processingMs };
}

/** Tap calibration: matches each click with the nearest strum in [−100, +maxOffsetMs] ms. */
export function tapRttStats(
  clickTimesS: readonly number[],
  strumTimesS: readonly number[],
  maxOffsetMs = 400,
): { rttMs: number; madMs: number; matched: number } | null {
  const offsets: number[] = [];
  for (const c of clickTimesS) {
    const after = strumTimesS.filter((t) => t >= c - 0.1 && t - c <= maxOffsetMs / 1000);
    if (after.length === 0) continue;
    const nearest = after.reduce((a, b) => (Math.abs(a - c) < Math.abs(b - c) ? a : b));
    offsets.push((nearest - c) * 1000);
  }
  if (offsets.length < 4) return null;
  const rttMs = median(offsets);
  return { rttMs, madMs: median(offsets.map((x) => Math.abs(x - rttMs))), matched: offsets.length };
}

/** Tap calibration RTT: median offset (ms) of detected strums from the click times. */
export function tapRtt(
  clickTimesS: readonly number[],
  strumTimesS: readonly number[],
  maxOffsetMs = 400,
): number | null {
  return tapRttStats(clickTimesS, strumTimesS, maxOffsetMs)?.rttMs ?? null;
}
