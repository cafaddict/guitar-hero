/**
 * Onset detection (SPEC §10.4): log-compressed spectral flux with a SuperFlux frequency max-filter,
 * adaptive median threshold, a broadband (≥ 2 kHz) attack condition, metronome-click masking,
 * 60 ms strum grouping and sample-accurate onset refinement on a high-band energy envelope.
 *
 * All parameters are in ms/Hz and converted with the sample rate (44.1 and 48 kHz both supported).
 * The class form is streaming (one frame at a time, used by the AudioWorklet); detectStrums() runs it
 * offline over a whole buffer.
 */
import { type BackingSchedule, backingKeepFlags } from './backingMask';
import { nextPow2, realFft } from './fft';
import { hann } from './window';

export interface OnsetParams {
  frameMs: number;
  hopMs: number;
  gamma: number;
  /** SuperFlux max-filter width in bins (odd). */
  maxFilterBins: number;
  /** Frame lag μ for the flux difference. */
  lagFrames: number;
  maxFluxHz: number;
  medianWindowMs: number;
  /** Absolute threshold offset δ on the flux. */
  delta: number;
  /** Relative threshold factor on the running median. */
  medianFactor: number;
  minIoiMs: number;
  groupMs: number;
  /** Broadband condition: band lower edge and minimum rise (dB) of high-band energy vs. μ+1 frames earlier. */
  broadbandHz: number;
  broadbandRiseDb: number;
  /** Frames after the peak scanned for the high-band maximum (a strum's attack spreads over ~40 ms). */
  broadbandLookaheadFrames: number;
  /** Frames before the lag window scanned for the high-band minimum. */
  broadbandLookbackFrames: number;
  /** Absolute gate: high-band flux must exceed this. */
  minHighFlux: number;
  /** A candidate failing the broadband condition is still accepted when its < lowBandHz flux reaches this
   * (a soft new bass note brings little high-frequency attack). Infinity disables. */
  lowFluxAccept: number;
  /** Every candidate needs at least this much < lowBandHz flux (0 disables). */
  minLowFlux: number;
  /** Low-band-only acceptance also needs lowFlux ≥ lowMedianFactor × median lowFlux of the past
   * lowMedianWindowMs (stationary noise keeps producing low-band flux; a new soft note stands out). */
  lowMedianFactor: number;
  lowMedianWindowMs: number;
  /** Also take candidates whose total flux misses the threshold but whose low-band flux spikes (see above). */
  lowSpikeAccept: boolean;
  /** Low-band path: lowFlux ≥ lowRecentFactor × the largest low-band flux of the previous lowRecentMs
   * (the decay right after a big strum beats; a real new note is comparable to recent events). 0 disables. */
  lowRecentFactor: number;
  lowRecentMs: number;
  /** Anticipation suppression: drop an event when a ≥ anticipationRatio× stronger event follows within
   * (anticipationMinMs, anticipationMaxMs] — left-hand noise just before a strum (chord change, finger
   * placement). Ratio 0 disables. Costs anticipationMaxMs of decision latency. */
  anticipationMinMs: number;
  anticipationMaxMs: number;
  anticipationRatio: number;
  /** Click masking (scheduled + RTT ± window): drop when the low-band (< lowBandHz) flux stays below this. */
  clickWindowMs: number;
  lowBandHz: number;
  clickLowFluxMax: number;
  /** Click template proxy: share of the flux inside the 2–4 kHz click band. */
  clickBandFraction: number;
  /** Onset refinement (fine log spectral flux around the coarse peak). */
  refineFrameMs: number;
  refineHopMs: number;
  refineLagMs: number;
  refineLookbackMs: number;
  refineLookaheadMs: number;
  /** Threshold = baseline + fraction·(peak − baseline) on the fine flux. */
  refineFraction: number;
  /** Constant subtracted from (frame end) at the crossing — calibrated on the dev split. */
  refineBiasMs: number;
}

export const DEFAULT_ONSET_PARAMS: OnsetParams = {
  frameMs: (4096 / 48000) * 1000,
  hopMs: (256 / 48000) * 1000,
  gamma: 100,
  maxFilterBins: 3,
  lagFrames: 8,
  maxFluxHz: 10_000,
  medianWindowMs: 100,
  delta: 2,
  medianFactor: 1.5,
  minIoiMs: 60,
  groupMs: 60,
  broadbandHz: 2000,
  broadbandRiseDb: 1,
  broadbandLookaheadFrames: 4,
  broadbandLookbackFrames: 3,
  minHighFlux: 0.5,
  lowFluxAccept: 3,
  minLowFlux: 1,
  lowMedianFactor: 4,
  lowMedianWindowMs: 1000,
  lowSpikeAccept: true,
  lowRecentFactor: 0.15,
  lowRecentMs: 400,
  anticipationMinMs: 60,
  anticipationMaxMs: 180,
  anticipationRatio: 4,
  clickWindowMs: 10,
  lowBandHz: 1000,
  clickLowFluxMax: 1.5,
  clickBandFraction: 0.4,
  refineFrameMs: (512 / 48000) * 1000,
  refineHopMs: 1,
  refineLagMs: 5,
  refineLookbackMs: 40,
  refineLookaheadMs: 15,
  refineFraction: 0.3,
  refineBiasMs: 5,
};

export interface OnsetFrame {
  /** Sample index of the frame's first sample. */
  start: number;
  flux: number;
  highFlux: number;
  lowFlux: number;
  /** Flux inside the metronome click band (2–4 kHz). */
  clickFlux: number;
  highEnergy: number;
}

export interface OnsetCandidate {
  /** Frame index of the flux peak. */
  frame: number;
  /** Coarse sample position (frame centre). */
  sample: number;
  strength: number;
  /** Passed the broadband (high-frequency attack) condition; false = accepted on low-band flux only. */
  broadband: boolean;
}

export interface StrumEvent {
  /** Refined onset sample of the first string in the group. */
  sample: number;
  /** Coarse (frame-based) sample. */
  coarseSample: number;
  strength: number;
  members: number;
}

/**
 * Streaming spectral-flux front end. push() consumes samples; completed frames are delivered through
 * `onFrame`. Fractional hops (e.g. 235.2 samples at 44.1 kHz) are accumulated, never rounded away.
 */
export class FluxAnalyzer {
  readonly frameLength: number;
  readonly fftSize: number;
  readonly hop: number;
  private readonly window: Float64Array;
  private readonly ring: Float64Array;
  private ringPos = 0;
  private filled = 0;
  private totalSamples = 0;
  private nextFrameAt: number;
  private frameIndex = 0;
  private readonly frameBuf: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private readonly history: Float64Array[];
  private readonly maxFiltered: Float64Array;
  private readonly bins: number;
  private readonly highBin: number;
  private readonly lowBin: number;
  private readonly clickLoBin: number;
  private readonly clickHiBin: number;
  /** Reused per frame (consumers copy what they keep). */
  private readonly frame: OnsetFrame = {
    start: 0,
    flux: 0,
    highFlux: 0,
    lowFlux: 0,
    clickFlux: 0,
    highEnergy: 0,
  };
  private readonly norm: number;

  constructor(
    readonly sampleRate: number,
    readonly params: OnsetParams,
    private readonly onFrame: (frame: OnsetFrame, index: number) => void,
  ) {
    this.frameLength = Math.round((params.frameMs / 1000) * sampleRate);
    this.fftSize = nextPow2(this.frameLength);
    this.hop = (params.hopMs / 1000) * sampleRate;
    this.window = hann(this.frameLength);
    this.ring = new Float64Array(this.frameLength);
    this.nextFrameAt = this.frameLength;
    this.frameBuf = new Float64Array(this.fftSize);
    this.re = new Float64Array(this.fftSize / 2 + 1);
    this.im = new Float64Array(this.fftSize / 2 + 1);
    const binHz = sampleRate / this.fftSize;
    this.bins = Math.min(this.fftSize / 2, Math.floor(params.maxFluxHz / binHz));
    this.highBin = Math.ceil(params.broadbandHz / binHz);
    this.lowBin = Math.floor(params.lowBandHz / binHz);
    this.clickLoBin = Math.floor(2000 / binHz);
    this.clickHiBin = Math.ceil(4000 / binHz);
    this.history = Array.from({ length: params.lagFrames + 1 }, () => new Float64Array(this.bins + 1));
    this.maxFiltered = new Float64Array(this.bins + 1);
    let wsum = 0;
    for (let i = 0; i < this.frameLength; i++) wsum += this.window[i]!;
    this.norm = 2 / wsum;
  }

  push(samples: ArrayLike<number>): void {
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.ringPos] = samples[i]!;
      this.ringPos = this.ringPos + 1 === this.frameLength ? 0 : this.ringPos + 1;
      if (this.filled < this.frameLength) this.filled++;
      this.totalSamples++;
      if (this.totalSamples >= this.nextFrameAt) {
        this.processFrame();
        this.frameIndex++;
        this.nextFrameAt = this.frameLength + this.frameIndex * this.hop;
      }
    }
  }

  private processFrame(): void {
    const L = this.frameLength;
    // Oldest sample is at ringPos.
    for (let i = 0; i < L; i++) {
      const v = this.ring[(this.ringPos + i) % L]!;
      this.frameBuf[i] = v * this.window[i]!;
    }
    for (let i = L; i < this.fftSize; i++) this.frameBuf[i] = 0;
    realFft(this.frameBuf, this.fftSize, this.re, this.im);
    // Rotate history: [0] newest.
    const oldest = this.history[this.history.length - 1]!;
    for (let j = this.history.length - 1; j > 0; j--) this.history[j] = this.history[j - 1]!;
    this.history[0] = oldest;
    const current = this.history[0];
    let highEnergy = 0;
    for (let k = 0; k <= this.bins; k++) {
      const mag = Math.hypot(this.re[k]!, this.im[k]!) * this.norm;
      current[k] = Math.log1p(this.params.gamma * mag);
      if (k >= this.highBin) highEnergy += mag * mag;
    }
    const lagged = this.history[this.params.lagFrames]!;
    const half = (this.params.maxFilterBins - 1) >> 1;
    for (let k = 0; k <= this.bins; k++) {
      let m = lagged[k]!;
      for (let d = 1; d <= half; d++) {
        if (k - d >= 0 && lagged[k - d]! > m) m = lagged[k - d]!;
        if (k + d <= this.bins && lagged[k + d]! > m) m = lagged[k + d]!;
      }
      this.maxFiltered[k] = m;
    }
    let flux = 0;
    let highFlux = 0;
    let lowFlux = 0;
    let clickFlux = 0;
    const warm = this.frameIndex >= this.params.lagFrames;
    if (warm) {
      for (let k = 1; k <= this.bins; k++) {
        const d = current[k]! - this.maxFiltered[k]!;
        if (d > 0) {
          flux += d;
          if (k >= this.highBin) highFlux += d;
          if (k <= this.lowBin) lowFlux += d;
          if (k >= this.clickLoBin && k <= this.clickHiBin) clickFlux += d;
        }
      }
    }
    const f = this.frame;
    f.start = this.totalSamples - L;
    f.flux = flux;
    f.highFlux = highFlux;
    f.lowFlux = lowFlux;
    f.clickFlux = clickFlux;
    f.highEnergy = highEnergy;
    this.onFrame(f, this.frameIndex);
  }
}

/** Computes all flux frames of a buffer offline. */
export function computeFlux(
  signal: ArrayLike<number>,
  sampleRate: number,
  params: OnsetParams = DEFAULT_ONSET_PARAMS,
): OnsetFrame[] {
  const frames: OnsetFrame[] = [];
  const analyzer = new FluxAnalyzer(sampleRate, params, (frame) => frames.push({ ...frame }));
  analyzer.push(signal);
  return frames;
}

export interface PickOptions {
  /** Click arrival samples (scheduled time + RTT) for masking. */
  clickSamples?: readonly number[];
  /** Speaker backing events to mask (SPEC v1.1 §10.12); offline path only. */
  backing?: BackingSchedule;
}

/**
 * Streaming peak picker over flux frames: adaptive median threshold, local maximum (one frame of
 * look-ahead), broadband condition, click masking and minimum inter-onset interval (a stronger peak within
 * minIoi replaces the pending one; a candidate is emitted once minIoi has passed without a stronger one).
 * Allocation-free per frame, so the AudioWorklet can run it.
 */
export class OnsetPicker {
  private readonly frames: OnsetFrame[];
  private readonly sortBuf: Float64Array;
  /** Ring of past low-band flux values (frame index modulo length) and a sort buffer for its median. */
  private readonly lowRing: Float64Array;
  private framesPushed = 0;
  private readonly lowSort: Float64Array;
  private readonly w: number;
  private readonly minGap: number;
  private readonly clickWin: number;
  /** Preallocated candidate objects: the scratch result, the pending peak and the last emitted onset. */
  private readonly scratch: OnsetCandidate = { frame: 0, sample: 0, strength: 0, broadband: true };
  private readonly pending: OnsetCandidate = { frame: 0, sample: 0, strength: 0, broadband: true };
  private readonly emitted: OnsetCandidate = { frame: 0, sample: 0, strength: 0, broadband: true };
  private hasPending = false;
  private readonly lookahead: number;

  constructor(
    sampleRate: number,
    private readonly frameLength: number,
    private readonly params: OnsetParams,
    private readonly nearClick: (sample: number, window: number) => boolean = () => false,
  ) {
    this.w = Math.max(1, Math.round(params.medianWindowMs / params.hopMs));
    this.lookahead = Math.max(1, params.broadbandLookaheadFrames);
    this.frames = Array.from(
      { length: this.w + params.lagFrames + params.broadbandLookbackFrames + this.lookahead + 4 },
      () => ({
        start: 0,
        flux: 0,
        highFlux: 0,
        lowFlux: 0,
        clickFlux: 0,
        highEnergy: 0,
      }),
    );
    this.sortBuf = new Float64Array(this.w);
    const lowLen = Math.max(1, Math.round(params.lowMedianWindowMs / params.hopMs));
    this.lowRing = new Float64Array(lowLen);
    this.lowSort = new Float64Array(lowLen);
    this.minGap = (params.minIoiMs / 1000) * sampleRate;
    this.clickWin = (params.clickWindowMs / 1000) * sampleRate + frameLength / 2;
  }

  private at(index: number): OnsetFrame {
    return this.frames[index % this.frames.length]!;
  }

  private static copy(from: OnsetCandidate, to: OnsetCandidate): OnsetCandidate {
    to.frame = from.frame;
    to.sample = from.sample;
    to.strength = from.strength;
    to.broadband = from.broadband;
    return to;
  }

  /**
   * Feeds frame `index` (0-based, consecutive). Returns a confirmed candidate, if any. The returned object
   * is reused by the next call — copy it to keep it.
   */
  push(frame: OnsetFrame, index: number): OnsetCandidate | null {
    const slot = this.at(index);
    slot.start = frame.start;
    slot.flux = frame.flux;
    slot.highFlux = frame.highFlux;
    slot.lowFlux = frame.lowFlux;
    slot.clickFlux = frame.clickFlux;
    slot.highEnergy = frame.highEnergy;
    this.lowRing[index % this.lowRing.length] = frame.lowFlux;
    this.framesPushed = index + 1;
    let emitted: OnsetCandidate | null = null;
    if (index >= 1 + this.lookahead && this.evaluate(index - this.lookahead)) {
      const candidate = this.scratch;
      if (this.hasPending && candidate.sample - this.pending.sample < this.minGap) {
        if (candidate.strength > this.pending.strength) OnsetPicker.copy(candidate, this.pending);
      } else {
        if (this.hasPending) emitted = OnsetPicker.copy(this.pending, this.emitted);
        OnsetPicker.copy(candidate, this.pending);
        this.hasPending = true;
      }
    }
    if (
      !emitted &&
      this.hasPending &&
      frame.start + this.frameLength / 2 - this.pending.sample >= this.minGap
    ) {
      emitted = OnsetPicker.copy(this.pending, this.emitted);
      this.hasPending = false;
    }
    return emitted;
  }

  /** Emits whatever is pending (end of input). */
  flush(): OnsetCandidate | null {
    if (!this.hasPending) return null;
    this.hasPending = false;
    return OnsetPicker.copy(this.pending, this.emitted);
  }

  /** Median of the previous `w` flux values (insertion sort into the fixed buffer — no allocation). */
  private runningMedian(n: number): number {
    const first = Math.max(0, n - this.w);
    const buf = this.sortBuf;
    let len = 0;
    for (let j = first; j < n; j++) len = insertSorted(buf, len, this.at(j).flux);
    return medianOfSorted(buf, len);
  }

  /** Largest low-band flux in the lowRecentMs before frame n (excluding the ±lag neighbourhood of n). */
  private recentLowMax(n: number): number {
    const span = Math.min(Math.round(this.params.lowRecentMs / this.params.hopMs), this.lowRing.length - 2);
    let max = 0;
    for (let j = Math.max(0, n - span); j < n - this.params.lagFrames; j++)
      max = Math.max(max, this.lowRing[j % this.lowRing.length]!);
    return max;
  }

  /** Median low-band flux over the frames before n (within the ring). */
  private lowMedian(n: number): number {
    const count = Math.min(n, this.lowRing.length - 2, this.framesPushed - 2);
    let len = 0;
    for (let j = n - count; j < n; j++)
      if (j >= 0) len = insertSorted(this.lowSort, len, this.lowRing[j % this.lowRing.length]!);
    return medianOfSorted(this.lowSort, len);
  }

  /** Writes the candidate for frame n into `this.scratch` and returns true, or returns false. */
  private evaluate(n: number): boolean {
    const p = this.params;
    const f = this.at(n);
    const prev = this.at(n - 1);
    const next = this.at(n + 1);
    if (f.flux < prev.flux || f.flux <= next.flux) return false;
    const threshold = this.runningMedian(n) * p.medianFactor + p.delta;
    // A soft new low note may not lift the total flux over the threshold (other bands fluctuate), but its
    // low-band flux spikes against this recording's own low-band level: let it through to the low-band path.
    const lowSpike =
      p.lowSpikeAccept &&
      f.lowFlux >= p.lowFluxAccept &&
      this.framesPushed >= this.lowRing.length / 4 &&
      f.lowFlux >= p.lowMedianFactor * this.lowMedian(n);
    if (f.flux < threshold && !lowSpike) return false;
    let before = Number.POSITIVE_INFINITY;
    for (
      let j = Math.max(0, n - p.lagFrames - p.broadbandLookbackFrames);
      j <= Math.max(0, n - p.lagFrames - 1);
      j++
    ) {
      before = Math.min(before, this.at(j).highEnergy);
    }
    let peakHigh = 0;
    for (let j = n; j <= n + this.lookahead; j++) peakHigh = Math.max(peakHigh, this.at(j).highEnergy);
    const riseDb = 10 * Math.log10((peakHigh + 1e-15) / (before + 1e-15));
    const broadband = riseDb >= p.broadbandRiseDb && f.highFlux >= p.minHighFlux;
    if (!broadband) {
      if (f.lowFlux < p.lowFluxAccept) return false;
      // The low-band path needs history (warm-up) and must stand out from this recording's own low-band
      // flux, and the low band must gain energy (beating only moves energy between nearby partials).
      if (this.framesPushed < this.lowRing.length / 4) return false;
      if (p.lowMedianFactor > 0 && f.lowFlux < p.lowMedianFactor * this.lowMedian(n)) return false;
      if (p.lowRecentFactor > 0 && f.lowFlux < p.lowRecentFactor * this.recentLowMax(n)) return false;
    }
    if (f.lowFlux < p.minLowFlux) return false;
    const sample = f.start + this.frameLength / 2;
    // Click masking (SPEC §10.4): near a scheduled click, drop a candidate whose rise sits in the click band
    // (template proxy) without low-frequency energy; an on-beat strum always brings low-band flux.
    const clickLike = f.lowFlux < p.clickLowFluxMax && f.clickFlux >= p.clickBandFraction * f.flux;
    if (clickLike && this.nearClick(sample, this.clickWin)) return false;
    this.scratch.frame = n;
    this.scratch.sample = sample;
    this.scratch.strength = f.flux;
    this.scratch.broadband = broadband;
    return true;
  }
}

/** Inserts v into the sorted prefix buf[0..len) and returns the new length (no allocation). */
function insertSorted(buf: Float64Array, len: number, v: number): number {
  let k = len;
  while (k > 0 && buf[k - 1]! > v) {
    buf[k] = buf[k - 1]!;
    k--;
  }
  buf[k] = v;
  return len + 1;
}

function medianOfSorted(buf: Float64Array, len: number): number {
  if (len === 0) return 0;
  return len % 2 ? buf[len >> 1]! : 0.5 * (buf[(len >> 1) - 1]! + buf[len >> 1]!);
}

/** Offline peak picking over precomputed frames (same code path as the streaming picker). */
export function pickOnsets(
  frames: readonly OnsetFrame[],
  sampleRate: number,
  frameLength: number,
  params: OnsetParams,
  options: PickOptions = {},
): OnsetCandidate[] {
  const clicks = options.clickSamples ?? [];
  const picker = new OnsetPicker(sampleRate, frameLength, params, (sample, win) =>
    clicks.some((c) => Math.abs(c - sample) <= win),
  );
  const out: OnsetCandidate[] = [];
  frames.forEach((frame, i) => {
    const c = picker.push(frame, i);
    if (c) out.push({ ...c });
  });
  const last = picker.flush();
  if (last) out.push({ ...last });
  return out;
}

/** High-band (first-difference) energy envelope, smoothed with a one-pole of `smoothMs`. */
export function highBandEnvelope(
  signal: ArrayLike<number>,
  start: number,
  end: number,
  sampleRate: number,
  smoothMs: number,
): Float64Array {
  const s = Math.max(1, start);
  const e = Math.min(signal.length, end);
  const out = new Float64Array(Math.max(0, e - s));
  const a = Math.exp(-1 / ((smoothMs / 1000) * sampleRate));
  let y = 0;
  for (let i = s; i < e; i++) {
    const d = signal[i]! - signal[i - 1]!;
    y = a * y + (1 - a) * d * d;
    out[i - s] = y;
  }
  return out;
}

const fineScratch = new Map<number, { frame: Float64Array; re: Float64Array; im: Float64Array }>();

/**
 * Sample-accurate onset of the *first* string of a strum: a fine-resolution log spectral flux (≈10.7 ms
 * frames, 1 ms hop, SuperFlux max-filter, 5 ms lag) over [coarse − lookback, coarse + lookahead]; the onset is
 * the first rising crossing of baseline + fraction·(peak − baseline), mapped from the frame end with a
 * dev-calibrated bias. Log flux ignores stationary noise and the previous chord's sustain.
 */
export function refineOnset(
  signal: ArrayLike<number>,
  coarseSample: number,
  _frameLength: number,
  sampleRate: number,
  params: OnsetParams,
  searchFromSample?: number,
): number {
  const n = Math.round((params.refineFrameMs / 1000) * sampleRate);
  const fftSize = nextPow2(n);
  let scratch = fineScratch.get(fftSize);
  if (!scratch) {
    scratch = {
      frame: new Float64Array(fftSize),
      re: new Float64Array(fftSize / 2 + 1),
      im: new Float64Array(fftSize / 2 + 1),
    };
    fineScratch.set(fftSize, scratch);
  }
  const w = hann(n);
  const hop = Math.max(1, Math.round((params.refineHopMs / 1000) * sampleRate));
  const lag = Math.max(1, Math.round(params.refineLagMs / params.refineHopMs));
  const bins = Math.min(fftSize / 2, Math.floor((params.maxFluxHz / sampleRate) * fftSize));
  // Frame ends span [coarse − lookback, coarse + lookahead]; frames start n samples earlier.
  const firstEnd = Math.round(coarseSample - (params.refineLookbackMs / 1000) * sampleRate);
  const lastEnd = Math.round(coarseSample + (params.refineLookaheadMs / 1000) * sampleRate);
  const count = Math.floor((lastEnd - firstEnd) / hop) + 1;
  if (count < lag + 4) return coarseSample;
  const logs: Float64Array[] = [];
  const flux = new Float64Array(count);
  let wsum = 0;
  for (let i = 0; i < n; i++) wsum += w[i]!;
  const norm = 2 / wsum;
  for (let f = 0; f < count; f++) {
    const start = firstEnd + f * hop - n;
    for (let i = 0; i < fftSize; i++) {
      const idx = start + i;
      scratch.frame[i] = i < n && idx >= 0 && idx < signal.length ? signal[idx]! * w[i]! : 0;
    }
    realFft(scratch.frame, fftSize, scratch.re, scratch.im);
    const log = new Float64Array(bins + 1);
    for (let k = 0; k <= bins; k++)
      log[k] = Math.log1p(params.gamma * Math.hypot(scratch.re[k]!, scratch.im[k]!) * norm);
    logs.push(log);
    if (f >= lag) {
      const prev = logs[f - lag]!;
      let sum = 0;
      for (let k = 1; k < bins; k++) {
        const ref = Math.max(prev[k - 1]!, prev[k]!, prev[k + 1]!);
        const d = log[k]! - ref;
        if (d > 0) sum += d;
      }
      flux[f] = sum;
    }
  }
  // Baseline: median flux over the first quarter of the region (before the strum).
  const baseCount = Math.max(3, Math.floor((count - lag) / 4));
  const base = Array.from(flux.subarray(lag, lag + baseCount)).sort((a, b) => a - b)[baseCount >> 1] ?? 0;
  let peak = 0;
  for (let f = lag; f < count; f++) peak = Math.max(peak, flux[f]!);
  if (peak <= base) return coarseSample;
  const threshold = base + params.refineFraction * (peak - base);
  const at = (f: number) => Math.round(firstEnd + f * hop - (params.refineBiasMs / 1000) * sampleRate);
  // Optional prior (backing masking): ignore crossings whose onset would precede `searchFromSample`.
  let from = lag + 1;
  if (searchFromSample !== undefined) while (from < count - 1 && at(from) < searchFromSample) from++;
  for (let f = from; f < count - 1; f++) {
    if (flux[f]! >= threshold && flux[f + 1]! >= threshold) return at(f);
  }
  return coarseSample;
}

/** Groups candidates within groupMs into strum events; the event time is the first member's onset. */
export function groupStrums(
  candidates: readonly OnsetCandidate[],
  refined: readonly number[],
  sampleRate: number,
  groupMs: number,
): StrumEvent[] {
  const group = (groupMs / 1000) * sampleRate;
  const events: StrumEvent[] = [];
  candidates.forEach((c, i) => {
    const sample = refined[i]!;
    const last = events[events.length - 1];
    if (last && sample - last.sample <= group) {
      last.members++;
      last.strength = Math.max(last.strength, c.strength);
      return;
    }
    events.push({ sample, coarseSample: c.sample, strength: c.strength, members: 1 });
  });
  return events;
}

/** Drops weak events that a much stronger event follows shortly (see OnsetParams.anticipation*). */
export function suppressAnticipations(
  events: readonly StrumEvent[],
  sampleRate: number,
  params: OnsetParams,
): StrumEvent[] {
  if (params.anticipationRatio <= 0) return [...events];
  const lo = (params.anticipationMinMs / 1000) * sampleRate;
  const hi = (params.anticipationMaxMs / 1000) * sampleRate;
  return events.filter(
    (e) =>
      !events.some(
        (o) =>
          o.sample - e.sample > lo &&
          o.sample - e.sample <= hi &&
          o.strength >= params.anticipationRatio * e.strength,
      ),
  );
}

/** Full offline pipeline: flux → peaks → refinement → (backing mask) → strum grouping → anticipation suppression. */
export function detectStrums(
  signal: ArrayLike<number>,
  sampleRate: number,
  params: OnsetParams = DEFAULT_ONSET_PARAMS,
  options: PickOptions = {},
): StrumEvent[] {
  const frames = computeFlux(signal, sampleRate, params);
  const frameLength = Math.round((params.frameMs / 1000) * sampleRate);
  let candidates = pickOnsets(frames, sampleRate, frameLength, params, options);
  let refined = candidates.map((c) => refineOnset(signal, c.sample, frameLength, sampleRate, params));
  if (options.backing) {
    const keep = backingKeepFlags(signal, sampleRate, refined, options.backing, (i, from) =>
      refineOnset(signal, candidates[i]!.sample, frameLength, sampleRate, params, from),
    );
    candidates = candidates.filter((_, i) => keep[i]);
    refined = refined.filter((_, i) => keep[i]);
  }
  return suppressAnticipations(
    groupStrums(candidates, refined, sampleRate, params.groupMs),
    sampleRate,
    params,
  );
}
