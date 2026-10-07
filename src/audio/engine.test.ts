import { describe, expect, it } from 'vitest';
import { AudioEngine, type EnginePlatform, type EngineStatus, SynthBlockedError } from './engine';

/** Minimal stand-ins for the Web Audio / media objects AudioEngine touches. */
class FakeTrack extends EventTarget {
  stopped = false;
  constructor(
    readonly label: string,
    private readonly settings: Record<string, unknown>,
  ) {
    super();
  }
  getSettings() {
    return this.settings;
  }
  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  constructor(readonly track: FakeTrack) {}
  getAudioTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

class FakePort {
  sent: unknown[] = [];
  closed = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(message: unknown) {
    this.sent.push(message);
  }
  close() {
    this.closed = true;
  }
  /** Simulates a message from the worklet. */
  deliver(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

class FakeNode {
  readonly port = new FakePort();
  connected: unknown[] = [];
  disconnected = false;
  connect(target: unknown) {
    this.connected.push(target);
    return target;
  }
  disconnect() {
    this.disconnected = true;
  }
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  startedAt: number | null = null;
  start(t: number) {
    this.startedAt = t;
  }
}

class FakeContext extends EventTarget {
  state: string = 'suspended';
  sampleRate = 48000;
  currentTime = 1;
  baseLatency = 0.01;
  outputLatency = 0.02;
  destination = { kind: 'destination' };
  sources: FakeBufferSource[] = [];
  async resume() {
    this.state = 'running';
    this.dispatchEvent(new Event('statechange'));
  }
  async close() {
    this.state = 'closed';
  }
  setState(state: string) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
  createMediaStreamSource() {
    return new FakeNode();
  }
  createBuffer(_channels: number, length: number, sampleRate: number) {
    return { length, sampleRate, copyToChannel() {} };
  }
  createBufferSource() {
    const s = new FakeBufferSource();
    this.sources.push(s);
    return s;
  }
}

class FakeWorker {
  sent: unknown[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage(message: unknown) {
    this.sent.push(message);
  }
  terminate() {
    this.terminated = true;
  }
}

function setup(
  options: { gum?: () => Promise<FakeStream>; label?: string; settings?: Record<string, unknown> } = {},
) {
  const calls: string[] = [];
  const ctx = new FakeContext();
  const nav = { audioSession: { type: 'auto' } } as unknown as Navigator;
  const worker = new FakeWorker();
  const track = new FakeTrack(
    options.label ?? 'MacBook Pro Microphone',
    options.settings ?? {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 48000,
    },
  );
  const captureNodes: FakeNode[] = [];
  const constraints: MediaStreamConstraints[] = [];
  const platform: EnginePlatform = {
    createContext: () => {
      calls.push('createContext');
      return ctx as unknown as AudioContext;
    },
    getUserMedia: async (c) => {
      calls.push(
        `getUserMedia(session=${(nav as unknown as { audioSession: { type: string } }).audioSession.type})`,
      );
      constraints.push(c);
      return (options.gum ? await options.gum() : new FakeStream(track)) as unknown as MediaStream;
    },
    enumerateDevices: async () =>
      [
        { kind: 'audioinput', deviceId: 'a', label: 'MacBook Pro Microphone' },
        { kind: 'audiooutput', deviceId: 'default', label: 'MacBook Pro Speakers' },
      ] as MediaDeviceInfo[],
    loadCaptureModule: async () => {
      calls.push('addModule');
    },
    createCaptureNode: () => {
      const node = new FakeNode();
      captureNodes.push(node);
      return node as unknown as AudioWorkletNode;
    },
    createDspWorker: () => worker as unknown as Worker,
    navigator: nav,
    now: () => 42,
  };
  const engine = new AudioEngine(platform);
  const statuses: EngineStatus[] = [];
  engine.status.on((s) => statuses.push(s));
  return { engine, ctx, worker, track, captureNodes, constraints, calls, statuses };
}

describe('AudioEngine microphone lifecycle', () => {
  it('creates the context first, declares play-and-record, requests processing-free capture', async () => {
    const { engine, calls, constraints, captureNodes, worker } = setup();
    expect(await engine.startMic({ deviceId: 'dev-1' })).toBe(true);
    expect(calls).toEqual(['createContext', 'getUserMedia(session=play-and-record)', 'addModule']);
    expect(constraints[0]!.audio).toMatchObject({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      deviceId: { exact: 'dev-1' },
    });
    expect(engine.currentStatus).toEqual({ kind: 'running' });
    // Worklet and worker are wired with a MessageChannel and the worker gets its config.
    expect((captureNodes[0]!.port.sent[0] as { type: string }).type).toBe('connectWorker');
    expect(worker.sent.map((m) => (m as { type: string }).type)).toEqual(['connectCapture', 'config', 'job']);
  });

  it('stores getSettings diagnostics and flags processing left on and Bluetooth inputs', async () => {
    const { engine } = setup({
      label: 'AirPods Pro',
      settings: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 24000,
      },
    });
    await engine.startMic();
    const d = engine.diagnostics!;
    expect(d.label).toBe('AirPods Pro');
    expect(d.bluetooth).toBe(true);
    expect(d.processingOn).toEqual(['echoCancellation']);
    expect(d.settings.sampleRate).toBe(24000);
    expect(d.contextSampleRate).toBe(48000);
    expect(d.capturedAt).toBe(42);
    expect(await engine.deviceLabels()).toEqual({ input: 'AirPods Pro', output: 'MacBook Pro Speakers' });
  });

  it('permission denied → error status, nothing held', async () => {
    const { engine, captureNodes, worker } = setup({
      gum: () => Promise.reject(new DOMException('no', 'NotAllowedError')),
    });
    expect(await engine.startMic()).toBe(false);
    expect(engine.currentStatus).toEqual({ kind: 'error', code: 'PERMISSION_DENIED' });
    expect(captureNodes).toHaveLength(0);
    expect(worker.sent).toHaveLength(0);
    expect(engine.micRunning).toBe(false);
  });

  it('missing device → NO_DEVICE', async () => {
    const { engine } = setup({ gum: () => Promise.reject(new DOMException('none', 'NotFoundError')) });
    await engine.startMic();
    expect(engine.currentStatus).toEqual({ kind: 'error', code: 'NO_DEVICE' });
  });

  it('device unplugged (track ended) → DEVICE_LOST, tracks stopped, graph disconnected', async () => {
    const { engine, track, captureNodes } = setup();
    await engine.startMic();
    track.dispatchEvent(new Event('ended'));
    expect(engine.currentStatus).toEqual({ kind: 'error', code: 'DEVICE_LOST' });
    expect(track.stopped).toBe(true);
    expect(captureNodes[0]!.disconnected).toBe(true);
    expect(captureNodes[0]!.port.closed).toBe(true);
    // Recovery: starting again works.
    expect(await engine.startMic()).toBe(true);
    expect(engine.currentStatus).toEqual({ kind: 'running' });
  });

  it('OS interruption → interrupted, resumed from a tap', async () => {
    const { engine, ctx, statuses } = setup();
    await engine.startMic();
    ctx.setState('interrupted');
    expect(engine.currentStatus).toEqual({ kind: 'interrupted' });
    await engine.resumeAfterInterruption();
    expect(engine.currentStatus).toEqual({ kind: 'running' });
    expect(statuses.map((s) => s.kind)).toEqual(['starting', 'running', 'interrupted', 'running']);
  });

  it('stopMic releases the microphone but keeps the context for the metronome', async () => {
    const { engine, track, ctx } = setup();
    await engine.startMic();
    engine.stopMic();
    expect(track.stopped).toBe(true);
    expect(engine.currentStatus).toEqual({ kind: 'idle' });
    expect(ctx.state).toBe('running');
    await engine.dispose();
    expect(ctx.state).toBe('closed');
  });
});

describe('AudioEngine messages and clock mapping', () => {
  it('maps capture samples to context time using the worklet start frame', async () => {
    const { engine, captureNodes } = setup();
    await engine.startMic();
    expect(engine.captureReady).toBe(false);
    captureNodes[0]!.port.deliver({ type: 'ready', startFrame: 48000, sampleRate: 48000 });
    expect(engine.captureReady).toBe(true);
    expect(engine.sampleToTime(24000)).toBeCloseTo(1.5);
    expect(engine.timeToSample(2)).toBe(48000);
    const onsets: number[] = [];
    engine.coarseOnset.on((o) => onsets.push(o.time));
    captureNodes[0]!.port.deliver({ type: 'onset', sample: 4800, strength: 3, broadband: true });
    expect(onsets).toEqual([1.1]);
  });

  it('resolves range analyses by id and rejects them when the microphone stops', async () => {
    const { engine, captureNodes, worker } = setup();
    await engine.startMic();
    captureNodes[0]!.port.deliver({ type: 'ready', startFrame: 0, sampleRate: 48000 });
    const first = engine.analyzeRange(1, 2, { kind: 'noise' });
    const request = worker.sent.at(-1) as { type: string; id: number };
    expect(request.type).toBe('analyzeRange');
    expect(captureNodes[0]!.port.sent.at(-1)).toEqual({
      type: 'captureRange',
      id: request.id,
      fromSample: 48000,
      toSample: 96000,
    });
    worker.onmessage?.({
      data: {
        type: 'rangeResult',
        id: request.id,
        result: { noiseDbfs: -60 },
        detectorVersion: 'v',
        processingMs: 1,
      },
    } as MessageEvent);
    await expect(first).resolves.toMatchObject({ result: { noiseDbfs: -60 }, processingMs: 1 });
    const second = engine.analyzeRange(2, 3, { kind: 'noise' });
    engine.stopMic();
    await expect(second).rejects.toThrow('microphone stopped');
  });

  it('blocks synth playback while judging, allows it otherwise', async () => {
    const { engine, ctx } = setup();
    await engine.startMic();
    engine.setJob({ kind: 'onsets' });
    expect(engine.judging).toBe(true);
    expect(() => engine.playSynth(new Float32Array(10))).toThrow(SynthBlockedError);
    engine.setJob(null);
    engine.playSynth(new Float32Array(10));
    expect(ctx.sources).toHaveLength(1);
    expect(ctx.sources[0]!.connected).toEqual([ctx.destination]);
  });

  it('schedules clicks at exact context times', async () => {
    const { engine, ctx } = setup();
    await engine.ensureContext();
    engine.scheduleClick(3.25, 'accent');
    engine.scheduleClick(3.75, 'beat');
    expect(ctx.sources.map((s) => s.startedAt)).toEqual([3.25, 3.75]);
  });

  it('runs Mode D timing analysis in the worker without the microphone', async () => {
    const { engine, worker } = setup();
    const pending = engine.analyzeTiming({
      slots: [{ time: 1, expected: true }],
      strumTimes: [1.05],
      rttS: 0.04,
      bpm: 80,
      personalOffsetMs: null,
    });
    const request = worker.sent.at(-1) as { type: string; id: number; rttS: number };
    expect(request).toMatchObject({ type: 'analyzeTiming', rttS: 0.04 });
    const result = { hits: 1 };
    worker.onmessage?.({
      data: { type: 'timingResult', id: request.id, result, detectorVersion: 'v', processingMs: 0.2 },
    } as MessageEvent);
    await expect(pending).resolves.toEqual({ result, detectorVersion: 'v', processingMs: 0.2 });
  });

  it('counts render gaps reported by the worklet (diagnostics)', async () => {
    const { engine, captureNodes } = setup();
    await engine.startMic();
    captureNodes[0]!.port.deliver({ type: 'gap', frames: 512, atSample: 9000 });
    captureNodes[0]!.port.deliver({ type: 'gap', frames: 128, atSample: 20000 });
    expect(engine.captureGaps).toEqual({ count: 2, frames: 640 });
  });
});
