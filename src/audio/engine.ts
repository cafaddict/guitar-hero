/**
 * AudioEngine (SPEC §8): owns the AudioContext, microphone stream, capture worklet and DSP worker. Lives
 * outside React; every browser API comes through an injected `EnginePlatform`, so error handling (permission
 * denied, device lost, OS interruption) is unit-tested with fakes.
 *
 * Data path: mic → MediaStreamSource → capture worklet (CaptureCore: ring buffer, levels, onsets)
 *   → MessageChannel → DSP worker (refine + judge) → main.   Clicks/probes/synth → ctx.destination.
 * Capture sample n (counted from the worklet's first block) was captured at context time (startFrame + n) / fs.
 */

import { msToSamples } from '../dsp/spectrum';
import { renderClick } from '../dsp/synth/click';
import type { TimingAnalysis, TimingSlot } from '../dsp/timing';
import { DEFAULT_TUNER_PARAMS } from '../dsp/tuner';
import {
  buildDiagnostics,
  type CaptureDiagnostics,
  captureConstraints,
  classifyMicError,
  declarePlayAndRecord,
  type MicErrorCode,
} from './devices';
import type { ClickLevel } from './metronome';
import type {
  Job,
  MainToWorker,
  OnsetMessage,
  RangeRequest,
  TunerMessage,
  WorkerToMain,
} from './worker/protocol';

export interface EnginePlatform {
  createContext(): AudioContext;
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  enumerateDevices(): Promise<MediaDeviceInfo[]>;
  loadCaptureModule(ctx: AudioContext): Promise<void>;
  createCaptureNode(ctx: AudioContext): AudioWorkletNode;
  createDspWorker(): Worker;
  navigator: Navigator;
  now(): number;
}

export type EngineStatus =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running' }
  | { kind: 'interrupted' }
  | { kind: 'error'; code: MicErrorCode };

export interface LevelReading {
  rms: number;
  peak: number;
  clipped: boolean;
  /** Capture sample at the end of the measured block. */
  sample: number;
}

/** Coarse onset straight from the worklet (low latency; used for "first strum starts the exercise"). */
export interface CoarseOnset {
  sample: number;
  time: number;
  strength: number;
}

/** Refined, judged onset from the DSP worker. */
export interface JudgedOnset extends Omit<OnsetMessage, 'type'> {
  time: number;
}

export interface TunerUpdate extends Omit<TunerMessage, 'type'> {
  time: number;
}

export interface RangeOutcome {
  result: unknown;
  samples?: Float32Array;
  detectorVersion: string;
  processingMs: number;
}

type Listener<T> = (value: T) => void;

export class Emitter<T> {
  private readonly listeners = new Set<Listener<T>>();
  on(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(value: T): void {
    for (const l of this.listeners) l(value);
  }
}

export interface TimingOutcome {
  result: TimingAnalysis;
  detectorVersion: string;
  processingMs: number;
}

interface PendingTiming {
  resolve: (outcome: TimingOutcome) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface PendingRange {
  resolve: (outcome: RangeOutcome) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class SynthBlockedError extends Error {
  constructor() {
    super('synth playback is blocked while the microphone is judging');
    this.name = 'SynthBlockedError';
  }
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private worker: Worker | null = null;
  private moduleLoaded = false;
  private startFrame: number | null = null;
  private job: Job | null = null;
  private nextRangeId = 1;
  private readonly ranges = new Map<number, PendingRange>();
  private readonly timings = new Map<number, PendingTiming>();
  private clickBuffers: Map<ClickLevel, AudioBuffer> | null = null;
  private statusValue: EngineStatus = { kind: 'idle' };
  private diagnosticsValue: CaptureDiagnostics | null = null;
  private lastLevel: LevelReading | null = null;
  private suspendedByUs = false;
  private readonly gaps = { count: 0, frames: 0 };

  readonly status = new Emitter<EngineStatus>();
  readonly level = new Emitter<LevelReading>();
  readonly coarseOnset = new Emitter<CoarseOnset>();
  readonly onset = new Emitter<JudgedOnset>();
  readonly tuner = new Emitter<TunerUpdate>();

  constructor(private readonly platform: EnginePlatform) {}

  // --- state --------------------------------------------------------------------------------

  get context(): AudioContext | null {
    return this.ctx;
  }

  get currentStatus(): EngineStatus {
    return this.statusValue;
  }

  get diagnostics(): CaptureDiagnostics | null {
    return this.diagnosticsValue;
  }

  get latestLevel(): LevelReading | null {
    return this.lastLevel;
  }

  /** Render glitches since the microphone started: blocks the browser skipped (zero-filled in capture). */
  get captureGaps(): { count: number; frames: number } {
    return { ...this.gaps };
  }

  get micRunning(): boolean {
    return this.statusValue.kind === 'running' && this.capture !== null;
  }

  /** Capture is ready once the worklet reported its first block (sample ↔ time mapping known). */
  get captureReady(): boolean {
    return this.startFrame !== null;
  }

  /** Judging = microphone running with a job set; synth playback is blocked then (SPEC §8.6). */
  get judging(): boolean {
    return this.micRunning && this.job !== null;
  }

  private setStatus(status: EngineStatus): void {
    this.statusValue = status;
    this.status.emit(status);
  }

  // --- context ------------------------------------------------------------------------------

  /** Creates (once) and resumes the context. Call from a user gesture (iOS). */
  async ensureContext(): Promise<AudioContext> {
    if (!this.ctx || this.ctx.state === 'closed') {
      const ctx = this.platform.createContext();
      this.ctx = ctx;
      this.moduleLoaded = false;
      this.clickBuffers = null;
      ctx.addEventListener('statechange', () => this.onContextState(ctx));
    }
    this.suspendedByUs = false;
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  private onContextState(ctx: AudioContext): void {
    if (ctx !== this.ctx) return;
    const state = ctx.state as AudioContextState | 'interrupted';
    if ((state === 'interrupted' || state === 'suspended') && !this.suspendedByUs && this.capture) {
      this.setStatus({ kind: 'interrupted' });
    } else if (state === 'running' && this.statusValue.kind === 'interrupted') {
      this.setStatus({ kind: 'running' });
    }
  }

  /** Recovery after an OS interruption (phone call, Siri): must run inside a tap. */
  async resumeAfterInterruption(): Promise<void> {
    await this.ctx?.resume();
    if (this.ctx?.state === 'running' && this.statusValue.kind === 'interrupted')
      this.setStatus({ kind: 'running' });
  }

  // --- microphone ---------------------------------------------------------------------------

  async startMic(options: { deviceId?: string | null } = {}): Promise<boolean> {
    if (this.capture) return true;
    this.setStatus({ kind: 'starting' });
    // Context first (iOS gesture rules; the E2E fake mic hands out a stream from this very context).
    let ctx: AudioContext;
    try {
      ctx = await this.ensureContext();
    } catch {
      this.setStatus({ kind: 'error', code: 'UNSUPPORTED' });
      return false;
    }
    declarePlayAndRecord(this.platform.navigator);
    const requested = captureConstraints(options.deviceId ?? null);
    let stream: MediaStream;
    try {
      stream = await this.platform.getUserMedia(requested);
    } catch (error) {
      this.setStatus({ kind: 'error', code: classifyMicError(error) });
      return false;
    }
    try {
      if (!this.moduleLoaded) {
        await this.platform.loadCaptureModule(ctx);
        this.moduleLoaded = true;
      }
      this.stream = stream;
      const track = stream.getAudioTracks()[0];
      track?.addEventListener('ended', this.onTrackEnded);
      this.diagnosticsValue = buildDiagnostics({
        requested,
        trackSettings: (track?.getSettings() ?? {}) as Record<string, unknown>,
        label: track?.label ?? '',
        contextSampleRate: ctx.sampleRate,
        baseLatencyS: ctx.baseLatency,
        outputLatencyS: (ctx as AudioContext & { outputLatency?: number }).outputLatency,
        now: this.platform.now(),
      });
      this.connectCapture(ctx, stream);
    } catch (error) {
      this.releaseMic();
      this.setStatus({ kind: 'error', code: classifyMicError(error) });
      return false;
    }
    this.setStatus({ kind: 'running' });
    return true;
  }

  private connectCapture(ctx: AudioContext, stream: MediaStream): void {
    this.worker ??= this.createWorker();
    const capture = this.platform.createCaptureNode(ctx);
    const channel = new MessageChannel();
    capture.port.postMessage({ type: 'connectWorker', port: channel.port1 }, [channel.port1]);
    this.worker.postMessage({ type: 'connectCapture', port: channel.port2 }, [channel.port2]);
    this.postWorker({ type: 'config', sampleRate: ctx.sampleRate });
    this.postWorker({ type: 'job', job: this.job });
    capture.port.onmessage = (event: MessageEvent<CaptureMessage>) => this.onCaptureMessage(event.data);
    this.gaps.count = 0;
    this.gaps.frames = 0;
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(capture);
    this.capture = capture;
    this.startFrame = null;
  }

  private createWorker(): Worker {
    const worker = this.platform.createDspWorker();
    worker.onmessage = (event: MessageEvent<WorkerToMain>) => this.onWorkerMessage(event.data);
    return worker;
  }

  private readonly onTrackEnded = (): void => {
    // Unplugged / revoked device: release everything and show the recovery screen.
    this.releaseMic();
    this.setStatus({ kind: 'error', code: 'DEVICE_LOST' });
  };

  /** Turns the microphone off (privacy indicator off); the context stays for metronome/synth. */
  stopMic(): void {
    this.releaseMic();
    if (this.statusValue.kind !== 'error') this.setStatus({ kind: 'idle' });
  }

  private releaseMic(): void {
    this.capture?.port.close();
    this.capture?.disconnect();
    this.source?.disconnect();
    for (const track of this.stream?.getTracks() ?? []) {
      track.removeEventListener('ended', this.onTrackEnded);
      track.stop();
    }
    this.capture = null;
    this.source = null;
    this.stream = null;
    this.startFrame = null;
    this.lastLevel = null;
    for (const [id, pending] of this.ranges) {
      clearTimeout(pending.timer);
      pending.reject(new Error('microphone stopped'));
      this.ranges.delete(id);
    }
  }

  async dispose(): Promise<void> {
    this.releaseMic();
    for (const [id, pending] of this.timings) {
      clearTimeout(pending.timer);
      pending.reject(new Error('engine disposed'));
      this.timings.delete(id);
    }
    this.worker?.terminate();
    this.worker = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.moduleLoaded = false;
    this.clickBuffers = null;
    this.suspendedByUs = true;
    if (ctx && ctx.state !== 'closed') await ctx.close();
    this.setStatus({ kind: 'idle' });
  }

  async inputDevices(): Promise<MediaDeviceInfo[]> {
    return (await this.platform.enumerateDevices()).filter((d) => d.kind === 'audioinput');
  }

  /** Labels used to key calibrations (labels are empty until permission was granted). */
  async deviceLabels(): Promise<{ input: string; output: string }> {
    const devices = await this.platform.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    const output =
      devices.find((d) => d.kind === 'audiooutput' && (d.deviceId === 'default' || d.deviceId === '')) ??
      devices.find((d) => d.kind === 'audiooutput');
    return { input: this.diagnosticsValue?.label ?? '', output: output?.label ?? '' };
  }

  // --- messages -----------------------------------------------------------------------------

  private onCaptureMessage(msg: CaptureMessage): void {
    switch (msg.type) {
      case 'ready':
        this.startFrame = msg.startFrame;
        break;
      case 'level':
        this.lastLevel = { rms: msg.rms, peak: msg.peak, clipped: msg.clipped, sample: msg.sample };
        this.level.emit(this.lastLevel);
        break;
      case 'onset':
        this.coarseOnset.emit({
          sample: msg.sample,
          time: this.sampleToTime(msg.sample),
          strength: msg.strength,
        });
        break;
      case 'warning':
        console.warn(`capture: ${msg.message}`);
        break;
      case 'gap':
        this.gaps.count++;
        this.gaps.frames += msg.frames;
        break;
    }
  }

  private onWorkerMessage(msg: WorkerToMain): void {
    switch (msg.type) {
      case 'onset': {
        const { type: _type, ...rest } = msg;
        this.onset.emit({ ...rest, time: this.sampleToTime(msg.sample) });
        break;
      }
      case 'tuner': {
        const { type: _type, ...rest } = msg;
        this.tuner.emit({ ...rest, time: this.sampleToTime(msg.endSample) });
        break;
      }
      case 'rangeResult': {
        const pending = this.ranges.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.ranges.delete(msg.id);
        pending.resolve({
          result: msg.result,
          ...(msg.samples ? { samples: msg.samples } : {}),
          detectorVersion: msg.detectorVersion,
          processingMs: msg.processingMs,
        });
        break;
      }
      case 'timingResult': {
        const pending = this.timings.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.timings.delete(msg.id);
        pending.resolve({
          result: msg.result,
          detectorVersion: msg.detectorVersion,
          processingMs: msg.processingMs,
        });
        break;
      }
      case 'error':
        console.warn(`dsp worker: ${msg.message}`);
        break;
    }
  }

  private postWorker(message: MainToWorker): void {
    this.worker?.postMessage(message);
  }

  // --- clock mapping ------------------------------------------------------------------------

  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  sampleToTime(sample: number): number {
    return ((this.startFrame ?? 0) + sample) / this.sampleRate;
  }

  timeToSample(time: number): number {
    return Math.round(time * this.sampleRate) - (this.startFrame ?? 0);
  }

  // --- judging ------------------------------------------------------------------------------

  setJob(job: Job | null): void {
    this.job = job;
    this.postWorker({ type: 'job', job });
  }

  setTuner(enabled: boolean, expectedF0: number | null): void {
    const fs = this.sampleRate;
    this.capture?.port.postMessage({
      type: 'tuner',
      enabled,
      frameSamples: msToSamples(DEFAULT_TUNER_PARAMS.frameMs, fs),
      hopSamples: msToSamples(DEFAULT_TUNER_PARAMS.hopMs, fs),
    });
    this.postWorker({ type: 'tuner', enabled, expectedF0 });
  }

  /** Scheduled click times (context s) for click-leak masking in the onset detector. */
  setClickTimes(times: readonly number[]): void {
    this.capture?.port.postMessage({ type: 'setClicks', samples: times.map((t) => this.timeToSample(t)) });
  }

  /** Captures [fromTime, toTime) (context seconds, ≤ 4 s back) and analyzes it in the worker. */
  analyzeRange(fromTime: number, toTime: number, request: RangeRequest): Promise<RangeOutcome> {
    const capture = this.capture;
    if (!capture || this.startFrame === null) return Promise.reject(new Error('microphone is not running'));
    const id = this.nextRangeId++;
    const waitMs = Math.max(0, (toTime - (this.ctx?.currentTime ?? 0)) * 1000) + 5000;
    return new Promise<RangeOutcome>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ranges.delete(id);
        reject(new Error('range capture timed out'));
      }, waitMs);
      this.ranges.set(id, { resolve, reject, timer });
      this.postWorker({ type: 'analyzeRange', id, request });
      capture.port.postMessage({
        type: 'captureRange',
        id,
        fromSample: this.timeToSample(fromTime),
        toSample: this.timeToSample(toTime),
      });
    });
  }

  /** Mode D timing analysis in the worker (works without the microphone, e.g. tap mode). */
  analyzeTiming(input: {
    slots: readonly TimingSlot[];
    strumTimes: readonly number[];
    rttS: number;
    bpm: number;
    personalOffsetMs: number | null;
  }): Promise<TimingOutcome> {
    this.worker ??= this.createWorker();
    const id = this.nextRangeId++;
    return new Promise<TimingOutcome>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.timings.delete(id);
        reject(new Error('timing analysis timed out'));
      }, 10_000);
      this.timings.set(id, { resolve, reject, timer });
      this.postWorker({
        type: 'analyzeTiming',
        id,
        slots: [...input.slots],
        strumTimes: [...input.strumTimes],
        rttS: input.rttS,
        bpm: input.bpm,
        personalOffsetMs: input.personalOffsetMs,
      });
    });
  }

  // --- output -------------------------------------------------------------------------------

  private clickBuffer(level: ClickLevel): AudioBuffer {
    const ctx = this.ctx;
    if (!ctx) throw new Error('no AudioContext');
    if (!this.clickBuffers) {
      const make = (accent: boolean, gain: number): AudioBuffer => {
        const data = renderClick(ctx.sampleRate, accent);
        for (let i = 0; i < data.length; i++) data[i] = data[i]! * gain;
        const buffer = ctx.createBuffer(1, data.length, ctx.sampleRate);
        buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
        return buffer;
      };
      this.clickBuffers = new Map([
        ['accent', make(true, 1)],
        ['beat', make(false, 0.8)],
        ['sub', make(false, 0.45)],
      ]);
    }
    return this.clickBuffers.get(level)!;
  }

  /** Metronome click at an exact context time (2–4 kHz, ≤ 15 ms synthesized; the accent is higher). */
  scheduleClick(time: number, level: ClickLevel): void {
    this.scheduleSamples(this.clickBuffer(level), time);
  }

  /** Plays raw samples (RTT probe, click) at a context time; returns the source for cancellation. */
  scheduleSamples(buffer: AudioBuffer | Float32Array, time: number): AudioBufferSourceNode {
    const ctx = this.ctx;
    if (!ctx) throw new Error('no AudioContext');
    let audio: AudioBuffer;
    if (buffer instanceof Float32Array) {
      audio = ctx.createBuffer(1, buffer.length, ctx.sampleRate);
      audio.copyToChannel(buffer as Float32Array<ArrayBuffer>, 0);
    } else audio = buffer;
    const node = ctx.createBufferSource();
    node.buffer = audio;
    node.connect(ctx.destination);
    node.start(time);
    return node;
  }

  /** Synth playback ("들어 보기", ear training). Refused while the microphone is judging (SPEC §8.6). */
  playSynth(samples: Float32Array, time?: number): AudioBufferSourceNode {
    if (this.judging) throw new SynthBlockedError();
    return this.scheduleSamples(samples, time ?? (this.ctx?.currentTime ?? 0) + 0.05);
  }
}

type CaptureMessage =
  | { type: 'ready'; startFrame: number; sampleRate: number }
  | { type: 'level'; rms: number; peak: number; clipped: boolean; sample: number }
  | { type: 'onset'; sample: number; strength: number; broadband: boolean }
  | { type: 'warning'; message: string }
  | { type: 'gap'; frames: number; atSample: number };
