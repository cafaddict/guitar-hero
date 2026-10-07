import captureProcessorUrl from './worklet/capture-processor.ts?worker&url';

export interface LevelReading {
  rms: number;
  peak: number;
  time: number;
}

type LevelListener = (level: LevelReading) => void;

/**
 * Owns the AudioContext, microphone stream and capture worklet. Lives outside React;
 * start()/dispose() acquire and release every resource (RAII-style).
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private capture: AudioWorkletNode | null = null;
  private readonly levelListeners = new Set<LevelListener>();
  private lastLevel: LevelReading | null = null;

  get context(): AudioContext | null {
    return this.ctx;
  }

  get latestLevel(): LevelReading | null {
    return this.lastLevel;
  }

  async start(): Promise<void> {
    if (this.ctx) return;
    // The context is created before getUserMedia (iOS gesture rules; the E2E fake mic relies on it too).
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    await ctx.resume();
    await ctx.audioWorklet.addModule(captureProcessorUrl);
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 1 },
      },
    });
    this.source = ctx.createMediaStreamSource(this.stream);
    this.capture = new AudioWorkletNode(ctx, 'gh-capture', { numberOfInputs: 1, numberOfOutputs: 0 });
    this.capture.port.onmessage = (event: MessageEvent<{ type: string } & LevelReading>) => {
      if (event.data.type !== 'level') return;
      this.lastLevel = { rms: event.data.rms, peak: event.data.peak, time: event.data.time };
      for (const listener of this.levelListeners) listener(this.lastLevel);
    };
    this.source.connect(this.capture);
  }

  onLevel(listener: LevelListener): () => void {
    this.levelListeners.add(listener);
    return () => this.levelListeners.delete(listener);
  }

  async dispose(): Promise<void> {
    this.capture?.port.close();
    this.capture?.disconnect();
    this.source?.disconnect();
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    const ctx = this.ctx;
    this.ctx = null;
    this.stream = null;
    this.source = null;
    this.capture = null;
    this.lastLevel = null;
    if (ctx && ctx.state !== 'closed') await ctx.close();
  }
}

export const audioEngine = new AudioEngine();
