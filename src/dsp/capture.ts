/**
 * Capture core run by the AudioWorklet (SPEC §8.2), kept in dsp/ so Node can test and benchmark it.
 *
 * Per 128-sample block: append to a 4 s ring buffer, accumulate RMS/peak/clipping for ~30 Hz level
 * reports, and feed the streaming spectral-flux onset detector. No allocation in processBlock() after
 * construction (callbacks receive preallocated objects that are reused).
 */
import {
  DEFAULT_ONSET_PARAMS,
  FluxAnalyzer,
  type OnsetCandidate,
  type OnsetFrame,
  type OnsetParams,
  OnsetPicker,
} from './onset';
import { CLIP_LEVEL } from './types';

export interface LevelReport {
  rms: number;
  peak: number;
  clipped: boolean;
  /** Absolute sample index (since start) at the end of the reporting period. */
  frame: number;
}

export interface CaptureCallbacks {
  onLevel?: (level: LevelReport) => void;
  /** Absolute sample index of the onset (frame centre) and its strength. */
  onOnset?: (candidate: OnsetCandidate) => void;
}

export class CaptureCore {
  readonly ring: Float32Array;
  private ringPos = 0;
  private totalSamples = 0;
  private sumSquares = 0;
  private peak = 0;
  private clipped = false;
  private levelCount = 0;
  private readonly levelEvery: number;
  private readonly level: LevelReport = { rms: 0, peak: 0, clipped: false, frame: 0 };
  private readonly analyzer: FluxAnalyzer;
  private readonly picker: OnsetPicker;
  private clickSamples: Float64Array = new Float64Array(0);
  private clickCount = 0;

  constructor(
    readonly sampleRate: number,
    private readonly callbacks: CaptureCallbacks,
    ringSeconds = 4,
    params: OnsetParams = DEFAULT_ONSET_PARAMS,
  ) {
    this.ring = new Float32Array(Math.round(ringSeconds * sampleRate));
    this.levelEvery = Math.max(128, Math.round(sampleRate / 30));
    const frameLength = Math.round((params.frameMs / 1000) * sampleRate);
    this.picker = new OnsetPicker(sampleRate, frameLength, params, (sample, win) =>
      this.nearClick(sample, win),
    );
    this.analyzer = new FluxAnalyzer(sampleRate, params, (frame: OnsetFrame, index: number) => {
      const candidate = this.picker.push(frame, index);
      if (candidate) this.callbacks.onOnset?.(candidate);
    });
  }

  /** Expected click arrival samples (scheduled + RTT) for masking; replaces the previous list. */
  setClicks(samples: ArrayLike<number>): void {
    if (this.clickSamples.length < samples.length) this.clickSamples = new Float64Array(samples.length);
    for (let i = 0; i < samples.length; i++) this.clickSamples[i] = samples[i]!;
    this.clickCount = samples.length;
  }

  private nearClick(sample: number, window: number): boolean {
    for (let i = 0; i < this.clickCount; i++)
      if (Math.abs(this.clickSamples[i]! - sample) <= window) return true;
    return false;
  }

  get samplesProcessed(): number {
    return this.totalSamples;
  }

  processBlock(block: Float32Array): void {
    const ring = this.ring;
    for (let i = 0; i < block.length; i++) {
      const x = block[i]!;
      ring[this.ringPos] = x;
      this.ringPos = this.ringPos + 1 === ring.length ? 0 : this.ringPos + 1;
      this.sumSquares += x * x;
      const a = x < 0 ? -x : x;
      if (a > this.peak) this.peak = a;
      if (a > CLIP_LEVEL) this.clipped = true;
    }
    this.totalSamples += block.length;
    this.levelCount += block.length;
    this.analyzer.push(block);
    if (this.levelCount >= this.levelEvery) {
      this.level.rms = Math.sqrt(this.sumSquares / this.levelCount);
      this.level.peak = this.peak;
      this.level.clipped = this.clipped;
      this.level.frame = this.totalSamples;
      this.callbacks.onLevel?.(this.level);
      this.sumSquares = 0;
      this.peak = 0;
      this.clipped = false;
      this.levelCount = 0;
    }
  }

  /**
   * Copies samples [fromAbs, toAbs) (absolute indices) out of the ring into `out` (must be long enough).
   * Returns the number of samples copied (fewer when the range is no longer in the ring).
   */
  copyRange(fromAbs: number, toAbs: number, out: Float32Array): number {
    const oldest = Math.max(0, this.totalSamples - this.ring.length);
    const from = Math.max(fromAbs, oldest);
    const to = Math.min(toAbs, this.totalSamples, from + out.length);
    let n = 0;
    for (let abs = from; abs < to; abs++) {
      const idx = (this.ringPos - (this.totalSamples - abs) + this.ring.length * 2) % this.ring.length;
      out[n++] = this.ring[idx]!;
    }
    return n;
  }
}
