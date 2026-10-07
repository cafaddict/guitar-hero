/**
 * Runs the real AudioWorklet module (src/audio/worklet/capture-processor.ts) in Node with the worklet globals
 * stubbed: message protocol, segment windows, buffer recycling (no allocation once the pool is warm) and the
 * per-block time budget (SPEC §8.2: ≤ 0.3 ms average).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { midiToHz } from '../domain/theory';
import { randomTimbre, renderNote } from '../dsp/synth/note';

interface Message {
  type: string;
  [key: string]: unknown;
}

class FakePort {
  readonly sent: Message[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  /** Called for every message posted on this port (lets the "worker" side react). */
  onPost: ((message: Message) => void) | null = null;
  postMessage(message: Message): void {
    this.sent.push(message);
    this.onPost?.(message);
  }
}

interface Processor {
  port: FakePort;
  process(inputs: Float32Array[][]): boolean;
}

const FS = 48000;
const BLOCK = 128;
const globals = globalThis as unknown as {
  sampleRate: number;
  currentFrame: number;
  AudioWorkletProcessor: unknown;
  registerProcessor: (name: string, ctor: new () => Processor) => void;
};
let ProcessorClass: new () => Processor;

beforeAll(async () => {
  globals.sampleRate = FS;
  globals.currentFrame = 0;
  globals.AudioWorkletProcessor = class {
    readonly port = new FakePort();
  };
  globals.registerProcessor = (name, ctor) => {
    expect(name).toBe('gh-capture');
    ProcessorClass = ctor;
  };
  // Non-literal specifier: the worklet is type-checked by tsconfig.worklet.json, not pulled into this program.
  const modulePath = './worklet/capture-processor.ts';
  await import(/* @vite-ignore */ modulePath);
});

/** Plucks (G3) every `everyS` seconds over `seconds`. */
function signal(seconds: number, everyS: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * FS));
  for (let t = 0.3, k = 0; t < seconds; t += everyS, k++) {
    const note = renderNote({
      model: 'karplus-strong',
      f0: midiToHz(55),
      sampleRate: FS,
      durationS: Math.min(everyS, 1),
      inharmonicityB: 1e-4,
      muted: false,
      mutedDecayDb: 0,
      mutedDecayMs: 120,
      fundamentalDb: 0,
      ...randomTimbre(k + 1),
      seed: k + 1,
    });
    const start = Math.round(t * FS);
    for (let i = 0; i < note.length && start + i < out.length; i++) out[start + i] = 0.3 * note[i]!;
  }
  return out;
}

function setup(options: { returnBuffers: boolean; startFrame?: number }) {
  globals.currentFrame = options.startFrame ?? 0;
  const proc = new ProcessorClass();
  const toWorker = new FakePort();
  toWorker.onPost = (message) => {
    if (options.returnBuffers && message.samples instanceof Float32Array) {
      proc.port.onmessage?.({ data: { type: 'returnBuffer', buffer: message.samples } });
    }
  };
  proc.port.onmessage?.({ data: { type: 'connectWorker', port: toWorker } });
  const feed = (x: Float32Array, from = 0, to = x.length): number => {
    let busy = 0;
    for (let s = from; s + BLOCK <= to; s += BLOCK) {
      const block = x.subarray(s, s + BLOCK);
      const t0 = performance.now();
      proc.process([[block]]);
      busy += performance.now() - t0;
      globals.currentFrame += BLOCK;
    }
    return busy;
  };
  return { proc, toWorker, feed };
}

describe('capture worklet processor', () => {
  it('announces its start frame, reports levels (~30 Hz) and coarse onsets', () => {
    const { proc, feed } = setup({ returnBuffers: true, startFrame: 4800 });
    const x = signal(3, 0.5);
    feed(x);
    const sent = proc.port.sent;
    expect(sent[0]).toEqual({ type: 'ready', startFrame: 4800, sampleRate: FS });
    const levels = sent.filter((m) => m.type === 'level');
    expect(levels.length).toBeGreaterThanOrEqual(85);
    expect(levels.length).toBeLessThanOrEqual(95);
    const onsets = sent.filter((m) => m.type === 'onset').map((m) => (m.sample as number) / FS);
    expect(onsets).toHaveLength(6);
    for (const [k, t] of onsets.entries()) expect(Math.abs(t - (0.3 + 0.5 * k))).toBeLessThan(0.03);
  });

  it('posts [onset − 500 ms, onset + 400 ms] segments to the worker only once the 400 ms have been captured', () => {
    const { toWorker, feed } = setup({ returnBuffers: true });
    const x = signal(3, 0.5);
    const posted: { at: number; message: Message }[] = [];
    let processed = 0;
    toWorker.onPost = (message) => posted.push({ at: processed, message });
    for (let s = 0; s + BLOCK <= x.length; s += BLOCK) {
      processed = s + BLOCK; // samples captured once this block has been processed
      feed(x, s, s + BLOCK);
    }
    const segments = posted.filter((p) => p.message.type === 'segment');
    expect(segments).toHaveLength(5); // the 6th onset (2.8 s) has no +400 ms yet
    for (const { at, message } of segments) {
      const onset = message.onsetSample as number;
      const samples = message.samples as Float32Array;
      expect(samples.length).toBe(Math.round(0.9 * FS));
      expect(onset - (message.segmentStart as number)).toBe(Math.round(0.5 * FS));
      expect(at).toBeGreaterThanOrEqual(onset + Math.round(0.4 * FS));
      const start = message.segmentStart as number;
      // The segment holds exactly the captured samples (zero-padded before capture began).
      for (const i of [0, 1000, 24000, samples.length - 1])
        expect(samples[i]).toBe(start + i < 0 ? 0 : x[start + i]);
    }
  });

  it('serves tuner frames and requested ranges with the exact captured samples', () => {
    const { proc, toWorker, feed } = setup({ returnBuffers: true });
    const x = signal(4, 0.7);
    proc.port.onmessage?.({ data: { type: 'tuner', enabled: true, frameSamples: 4096, hopSamples: 512 } });
    proc.port.onmessage?.({ data: { type: 'captureRange', id: 7, fromSample: 48000, toSample: 144000 } });
    feed(x);
    const frames = toWorker.sent.filter((m) => m.type === 'tunerFrame');
    expect(frames.length).toBeGreaterThan(300);
    const last = frames.at(-1)!;
    const end = last.endSample as number;
    const frame = last.samples as Float32Array;
    expect(frame.length).toBe(4096);
    expect(frame[4095]).toBe(x[end - 1]);
    const range = toWorker.sent.find((m) => m.type === 'range')!;
    expect(range.id).toBe(7);
    const samples = range.samples as Float32Array;
    expect(samples.length).toBe(96000);
    expect(range.copied).toBe(96000);
    for (const i of [0, 777, 50000, 95999]) expect(samples[i]).toBe(x[48000 + i]);
  });

  it('recycles pooled buffers: no allocation warning over 20 s with tuner frames and onsets', () => {
    const { proc, feed } = setup({ returnBuffers: true });
    proc.port.onmessage?.({ data: { type: 'tuner', enabled: true, frameSamples: 4096, hopSamples: 512 } });
    feed(signal(20, 0.25));
    expect(proc.port.sent.filter((m) => m.type === 'warning')).toEqual([]);
  });

  it('warns once (and keeps working) when the worker does not return buffers', () => {
    const { proc, toWorker, feed } = setup({ returnBuffers: false });
    feed(signal(10, 0.25));
    expect(proc.port.sent.filter((m) => m.type === 'warning')).toHaveLength(1);
    expect(toWorker.sent.filter((m) => m.type === 'segment').length).toBeGreaterThan(30);
  });

  it('average block time stays within the 0.3 ms budget (tuner on, frequent onsets)', () => {
    const { proc, feed } = setup({ returnBuffers: true });
    proc.port.onmessage?.({ data: { type: 'tuner', enabled: true, frameSamples: 4096, hopSamples: 512 } });
    const x = signal(30, 0.25);
    feed(x, 0, 2 * FS); // warm-up (JIT)
    const busy = feed(x, 2 * FS);
    const blocks = Math.floor((x.length - 2 * FS) / BLOCK);
    const avgMs = busy / blocks;
    console.log(`capture worklet: ${avgMs.toFixed(4)} ms/block over ${blocks} blocks`);
    expect(avgMs).toBeLessThanOrEqual(0.3);
  });

  it('stays aligned to context frames when the browser skips process() calls (zero-filled gap)', () => {
    const { proc, toWorker } = setup({ returnBuffers: true, startFrame: 960 });
    const x = signal(4, 0.5);
    const skip = new Set([
      Math.round((1.1 * FS) / BLOCK),
      Math.round((1.1 * FS) / BLOCK) + 1,
      Math.round((1.1 * FS) / BLOCK) + 2,
      Math.round((1.1 * FS) / BLOCK) + 3,
    ]);
    proc.port.onmessage?.({ data: { type: 'captureRange', id: 3, fromSample: 2 * FS, toSample: 3 * FS } });
    // x[i] is the input at context frame 960 + i; skipped blocks never reach the processor.
    for (let b = 0; (b + 1) * BLOCK <= x.length; b++) {
      if (!skip.has(b)) proc.process([[x.subarray(b * BLOCK, (b + 1) * BLOCK)]]);
      globals.currentFrame += BLOCK;
    }
    expect(proc.port.sent.filter((m) => m.type === 'gap')).toEqual([
      { type: 'gap', frames: 512, atSample: (Math.round((1.1 * FS) / BLOCK) + 4) * BLOCK },
    ]);
    // Onsets after the hole are still at their true positions (sample n = frame 960 + n), and the jump back
    // from the zero-filled hole is not reported as an onset.
    const onsets = proc.port.sent.filter((m) => m.type === 'onset').map((m) => (m.sample as number) / FS);
    expect(onsets).toHaveLength(8);
    for (const [k, t] of onsets.entries()) expect(Math.abs(t - (0.3 + 0.5 * k))).toBeLessThan(0.03);
    const range = toWorker.sent.find((m) => m.type === 'range')!;
    const samples = range.samples as Float32Array;
    for (const i of [0, 12345, 47999]) expect(samples[i]).toBe(x[2 * FS + i]);
  });
});
