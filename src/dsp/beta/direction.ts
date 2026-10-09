/**
 * Strum direction (SPEC v1.1 §10.11, beta). Primary method: per-string onset order inside the first ~70 ms.
 * Each sounding string is followed through partials that no other string of the voicing shares (≥ 120 Hz
 * from every other string's partials, so a 30 ms frame separates them); its onset is the time centroid of
 * the rise of those bins. The slope of onset time against string index (6th string = 0) is
 * positive for a down strum (low strings first) and negative for an up strum; a flat slope is unknown.
 * Fallback without a voicing: the frequency centroid of the new energy rises (down) or falls (up) (02:464).
 */
import type { Tuning } from '../../domain/theory';
import { type ChordVoicing, expectedNotes } from '../../domain/voicing';
import { nextPow2, realFft } from '../fft';
import { msToSamples } from '../spectrum';
import { hann } from '../window';
import { type BetaResult, beta } from './types';

export interface DirectionParams {
  frameMs: number;
  hopMs: number;
  fromMs: number;
  toMs: number;
  minPartialHz: number;
  maxPartialHz: number;
  /** A partial counts as the string's own when every other string's partial is at least this far. */
  uniqueHz: number;
  maxHarmonic: number;
  /** |slope| (ms per string) below this → unknown. */
  minSlopeMs: number;
  /** Slope at which confidence reaches 1. */
  fullSlopeMs: number;
  /** Centroid fallback: |slope| (octaves per 10 ms) below this → unknown. */
  minCentroidSlope: number;
}

export const DEFAULT_DIRECTION_PARAMS: DirectionParams = {
  frameMs: 30,
  hopMs: 1,
  fromMs: -15,
  toMs: 75,
  minPartialHz: 150,
  maxPartialHz: 5000,
  uniqueHz: 80,
  maxHarmonic: 16,
  minSlopeMs: 0.5,
  fullSlopeMs: 4,
  minCentroidSlope: 0.02,
};

export type StrumDirection = 'down' | 'up' | 'unknown';

export interface DirectionInput {
  samples: ArrayLike<number>;
  sampleRate: number;
  onsetSample: number;
  voicing?: ChordVoicing;
  tuning?: Tuning;
  deltaCents?: readonly number[];
  params?: DirectionParams;
}

interface Frames {
  times: number[];
  mags: Float64Array[];
  binHz: number;
}

function stft(input: DirectionInput, p: DirectionParams): Frames {
  const fs = input.sampleRate;
  const n = msToSamples(p.frameMs, fs);
  const size = nextPow2(n * 2);
  const w = hann(n);
  const hop = Math.max(1, msToSamples(p.hopMs, fs));
  const buf = new Float64Array(size);
  const re = new Float64Array(size / 2 + 1);
  const im = new Float64Array(size / 2 + 1);
  const out: Frames = { times: [], mags: [], binHz: fs / size };
  const first = input.onsetSample + msToSamples(p.fromMs, fs);
  const last = input.onsetSample + msToSamples(p.toMs, fs);
  for (let s = first; s <= last; s += hop) {
    for (let i = 0; i < size; i++) {
      const idx = s - n + i; // the frame ends at s
      buf[i] = i < n && idx >= 0 && idx < input.samples.length ? input.samples[idx]! * w[i]! : 0;
    }
    realFft(buf, size, re, im);
    const mag = new Float64Array(re.length);
    for (let k = 0; k < re.length; k++) mag[k] = Math.hypot(re[k]!, im[k]!);
    out.times.push(((s - input.onsetSample) / fs) * 1000);
    out.mags.push(mag);
  }
  return out;
}

/** Onset (ms) of each sounding string, from its own partials; null when it has none or no clear rise. */
export function stringOnsetsMs(input: DirectionInput): { idx: number; ms: number }[] {
  const p = input.params ?? DEFAULT_DIRECTION_PARAMS;
  if (!input.voicing || !input.tuning) return [];
  const notes = expectedNotes(input.voicing, input.tuning, 0, input.deltaCents);
  const partials = notes.map((n) =>
    Array.from({ length: p.maxHarmonic }, (_, h) => (h + 1) * n.f0).filter(
      (f) => f >= p.minPartialHz && f <= p.maxPartialHz,
    ),
  );
  const frames = stft(input, p);
  const out: { idx: number; ms: number }[] = [];
  notes.forEach((note, i) => {
    const own = partials[i]!.filter((f) =>
      partials.every((other, j) => j === i || other.every((g) => Math.abs(g - f) >= p.uniqueHz)),
    );
    if (own.length === 0) return;
    const bins = own.map((f) => Math.round(f / frames.binHz));
    // Rise (positive log-magnitude difference) of the string's own bins per frame; the onset is the rise's
    // time centroid (robust to the slow leakage of louder neighbours that a level crossing picks up).
    let sw = 0;
    let st = 0;
    for (let f = 1; f < frames.mags.length; f++) {
      let rise = 0;
      for (const k of bins) {
        const d = Math.log1p(100 * frames.mags[f]![k]!) - Math.log1p(100 * frames.mags[f - 1]![k]!);
        if (d > 0) rise += d;
      }
      sw += rise;
      st += rise * frames.times[f]!;
    }
    if (sw > 0) out.push({ idx: note.idx, ms: st / sw });
  });
  return out;
}

function centroidSlope(input: DirectionInput, p: DirectionParams): number {
  const frames = stft(input, { ...p, frameMs: 12, hopMs: 1.5 });
  const lo = Math.max(1, Math.floor(70 / frames.binHz));
  const hi = Math.min(frames.mags[0]!.length - 1, Math.ceil(4000 / frames.binHz));
  const points: { t: number; c: number; w: number }[] = [];
  let prev: Float64Array | null = null;
  frames.mags.forEach((m, f) => {
    const log = m.map((v) => Math.log1p(100 * v));
    if (prev) {
      let sw = 0;
      let sc = 0;
      for (let k = lo; k <= hi; k++) {
        const d = log[k]! - prev[k]!;
        if (d > 0) {
          sw += d;
          sc += d * Math.log2(k * frames.binHz);
        }
      }
      if (sw > 0) points.push({ t: frames.times[f]!, c: sc / sw, w: sw });
    }
    prev = log;
  });
  return weightedSlope(points.map((q) => ({ x: q.t, y: q.c, w: q.w }))) * 10;
}

function weightedSlope(points: { x: number; y: number; w: number }[]): number {
  if (points.length < 2) return 0;
  const W = points.reduce((a, q) => a + q.w, 0);
  const mx = points.reduce((a, q) => a + q.w * q.x, 0) / W;
  const my = points.reduce((a, q) => a + q.w * q.y, 0) / W;
  const cov = points.reduce((a, q) => a + q.w * (q.x - mx) * (q.y - my), 0);
  const vx = points.reduce((a, q) => a + q.w * (q.x - mx) ** 2, 0);
  return vx > 0 ? cov / vx : 0;
}

export function strumDirection(input: DirectionInput): BetaResult<StrumDirection> & { slope: number } {
  const p = input.params ?? DEFAULT_DIRECTION_PARAMS;
  const onsets = stringOnsetsMs(input);
  if (onsets.length >= 2 && new Set(onsets.map((o) => o.idx)).size >= 2) {
    // ms per string step (6th string = idx 0): > 0 → low strings first → down.
    const slope = weightedSlope(onsets.map((o) => ({ x: o.idx, y: o.ms, w: 1 })));
    const value: StrumDirection = Math.abs(slope) < p.minSlopeMs ? 'unknown' : slope > 0 ? 'down' : 'up';
    return { ...beta(value, Math.min(1, Math.abs(slope) / p.fullSlopeMs)), slope };
  }
  const slope = centroidSlope(input, p);
  const value: StrumDirection = Math.abs(slope) < p.minCentroidSlope ? 'unknown' : slope > 0 ? 'down' : 'up';
  return { ...beta(value, Math.min(1, Math.abs(slope) / 0.3)), slope };
}
