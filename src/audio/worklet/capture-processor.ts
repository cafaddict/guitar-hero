/**
 * AudioWorklet capture processor (SPEC §8.2). Runs the pure CaptureCore (src/dsp/capture.ts) on every
 * 128-sample block: 4 s ring buffer, ~30 Hz level reports, streaming spectral-flux onsets.
 *
 * Messages to main (port): ready {startFrame, sampleRate}, level {...}, onset {sample, strength, broadband},
 * gap {frames, atSample} (frames the browser skipped; zero-filled so sample ↔ frame stays aligned).
 * Segments go straight to the DSP worker over a MessagePort handed in by main ('connectWorker'):
 *   onset segments   [onset − 500 ms, onset + 400 ms]
 *   tuner frames     (while tuner mode is on) every tunerHop samples
 *   captured ranges  (on request, e.g. RTT probe / noise check / templates)
 * Float32Array buffers come from a preallocated pool and are transferred; the worker transfers them back.
 * No allocation in process() except when the pool is empty (then a fresh buffer is created and logged once).
 */
import { CaptureCore } from '../../dsp/capture';
import type { OnsetCandidate } from '../../dsp/onset';

type InMessage =
  | { type: 'connectWorker'; port: MessagePort }
  | { type: 'setClicks'; samples: number[] }
  | { type: 'tuner'; enabled: boolean; frameSamples: number; hopSamples: number }
  | { type: 'captureRange'; id: number; fromSample: number; toSample: number }
  | { type: 'returnBuffer'; buffer: Float32Array };

const PRE_S = 0.5;
const POST_S = 0.4;
const POOL_SIZE = 12;

class CaptureProcessor extends AudioWorkletProcessor {
  private readonly core: CaptureCore;
  private workerPort: MessagePort | null = null;
  private startFrame = -1;
  private readonly segmentLength: number;
  /** Buffer pools keyed by length (onset segments, tuner frames). */
  private readonly pools = new Map<number, Float32Array[]>();
  private readonly pendingOnsets: { sample: number; strength: number; broadband: boolean }[] = [];
  private readonly pendingRanges: { id: number; fromSample: number; toSample: number }[] = [];
  private tuner = { enabled: false, frameSamples: 4096, hopSamples: 2048, next: 0 };
  private warnedPool = false;
  private readonly level = { type: 'level', rms: 0, peak: 0, clipped: false, sample: 0 };
  private readonly gap = { type: 'gap', frames: 0, atSample: 0 };

  constructor() {
    super();
    this.segmentLength = Math.round((PRE_S + POST_S) * sampleRate);
    this.fillPool(this.segmentLength);
    this.core = new CaptureCore(sampleRate, {
      onLevel: (l) => {
        this.level.rms = l.rms;
        this.level.peak = l.peak;
        this.level.clipped = l.clipped;
        this.level.sample = l.frame;
        this.port.postMessage(this.level);
      },
      onOnset: (c: OnsetCandidate) => {
        const onset = { sample: Math.round(c.sample), strength: c.strength, broadband: c.broadband };
        this.pendingOnsets.push(onset);
        this.port.postMessage({ type: 'onset', ...onset });
      },
    });
    this.port.onmessage = (event: MessageEvent<InMessage>) => this.onMessage(event.data);
  }

  private onMessage(msg: InMessage): void {
    switch (msg.type) {
      case 'connectWorker':
        this.workerPort = msg.port;
        this.workerPort.onmessage = (e: MessageEvent<{ type: string; buffer?: Float32Array }>) => {
          if (e.data.type === 'returnBuffer' && e.data.buffer) this.returnBuffer(e.data.buffer);
        };
        break;
      case 'setClicks':
        this.core.setClicks(msg.samples);
        break;
      case 'tuner':
        this.tuner = {
          enabled: msg.enabled,
          frameSamples: msg.frameSamples,
          hopSamples: msg.hopSamples,
          next: this.core.samplesProcessed + msg.frameSamples,
        };
        if (msg.enabled) this.fillPool(msg.frameSamples);
        break;
      case 'captureRange':
        this.pendingRanges.push({ id: msg.id, fromSample: msg.fromSample, toSample: msg.toSample });
        break;
      case 'returnBuffer':
        this.returnBuffer(msg.buffer);
        break;
    }
  }

  private fillPool(length: number): void {
    const pool = this.pools.get(length) ?? [];
    while (pool.length < POOL_SIZE) pool.push(new Float32Array(length));
    this.pools.set(length, pool);
  }

  private returnBuffer(buffer: Float32Array): void {
    const pool = this.pools.get(buffer.length);
    if (pool && pool.length < POOL_SIZE * 2) pool.push(buffer);
  }

  /** A pooled buffer; allocation happens only if the worker has not returned enough buffers yet. */
  private takeBuffer(length: number): Float32Array {
    const pooled = this.pools.get(length)?.pop();
    if (pooled) return pooled;
    if (!this.warnedPool) {
      this.warnedPool = true;
      this.port.postMessage({ type: 'warning', message: `buffer pool empty (${length})` });
    }
    return new Float32Array(length);
  }

  private flushReady(): void {
    const now = this.core.samplesProcessed;
    const post = Math.round(POST_S * sampleRate);
    const pre = Math.round(PRE_S * sampleRate);
    while (this.pendingOnsets.length > 0 && now >= this.pendingOnsets[0]!.sample + post) {
      const onset = this.pendingOnsets.shift()!;
      const buffer = this.takeBuffer(this.segmentLength);
      buffer.fill(0);
      const from = onset.sample - pre;
      const offset = Math.max(0, -from);
      const copied = this.core.copyRange(Math.max(0, from), onset.sample + post, buffer.subarray(offset));
      this.workerPort?.postMessage(
        {
          type: 'segment',
          onsetSample: onset.sample,
          segmentStart: from,
          strength: onset.strength,
          broadband: onset.broadband,
          copied,
          samples: buffer,
          startFrame: this.startFrame,
        },
        [buffer.buffer as ArrayBuffer],
      );
    }
    for (let i = this.pendingRanges.length - 1; i >= 0; i--) {
      const range = this.pendingRanges[i]!;
      if (now < range.toSample) continue;
      this.pendingRanges.splice(i, 1);
      const buffer = new Float32Array(Math.max(0, range.toSample - range.fromSample));
      const copied = this.core.copyRange(range.fromSample, range.toSample, buffer);
      this.workerPort?.postMessage(
        {
          type: 'range',
          id: range.id,
          fromSample: range.fromSample,
          copied,
          samples: buffer,
          startFrame: this.startFrame,
        },
        [buffer.buffer as ArrayBuffer],
      );
    }
    if (this.tuner.enabled && now >= this.tuner.next) {
      const buffer = this.takeBuffer(this.tuner.frameSamples);
      this.core.copyRange(now - this.tuner.frameSamples, now, buffer);
      this.workerPort?.postMessage(
        { type: 'tunerFrame', endSample: now, samples: buffer, startFrame: this.startFrame },
        [buffer.buffer as ArrayBuffer],
      );
      this.tuner.next = now + this.tuner.hopSamples;
    }
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    if (this.startFrame < 0) {
      this.startFrame = currentFrame;
      this.port.postMessage({ type: 'ready', startFrame: currentFrame, sampleRate });
    }
    // Under load the browser can skip process() calls (or deliver blocks without channels); keep capture
    // sample n aligned with context frame startFrame + n by zero-filling the frames that never arrived.
    const missing = currentFrame - (this.startFrame + this.core.samplesProcessed);
    if (missing > 0) {
      this.core.fillGap(missing);
      this.gap.frames = missing;
      this.gap.atSample = this.core.samplesProcessed;
      this.port.postMessage(this.gap);
    }
    this.core.processBlock(channel);
    this.flushReady();
    return true;
  }
}

registerProcessor('gh-capture', CaptureProcessor);
