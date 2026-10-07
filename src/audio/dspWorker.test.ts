/**
 * DSP worker adapter (SPEC §8.3) run in Node with a stubbed worker scope: zod-validated requests, every
 * judgement carries detectorVersion and processingMs, pooled buffers go back to the capture worklet.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { midiToHz } from '../domain/theory';
import { DEFAULT_RTT_PARAMS, rttProbe } from '../dsp/rtt';
import { randomTimbre, renderNote } from '../dsp/synth/note';
import { DETECTOR_VERSION } from '../dsp/version';
import type { WorkerToMain } from './worker/protocol';

const FS = 48000;
const posted: WorkerToMain[] = [];
const scope = {
  postMessage: (message: WorkerToMain) => posted.push(message),
  onmessage: null as ((event: { data: unknown }) => void) | null,
};
const returned: Float32Array[] = [];
const capturePort = {
  onmessage: null as ((event: { data: unknown }) => void) | null,
  postMessage: (message: { type: string; buffer: Float32Array }) => {
    if (message.type === 'returnBuffer') returned.push(message.buffer);
  },
};

const send = (data: unknown) => scope.onmessage?.({ data });
const fromCapture = (data: unknown) => capturePort.onmessage?.({ data });
const lastOf = <T extends WorkerToMain['type']>(type: T) =>
  posted.filter((m) => m.type === type).at(-1) as Extract<WorkerToMain, { type: T }> | undefined;

beforeAll(async () => {
  (globalThis as unknown as { self: typeof scope }).self = scope;
  const modulePath = './worker/dsp-worker.ts';
  await import(/* @vite-ignore */ modulePath);
  send({ type: 'connectCapture', port: capturePort });
  send({ type: 'config', sampleRate: FS });
});

function pluckSegment(f0: number, seed: number): Float32Array {
  const segment = new Float32Array(Math.round(0.9 * FS));
  const note = renderNote({
    model: 'karplus-strong',
    f0,
    sampleRate: FS,
    durationS: 0.4,
    inharmonicityB: 1e-4,
    muted: false,
    mutedDecayDb: 0,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    seed,
  });
  const onset = Math.round(0.5 * FS);
  for (let i = 0; i < note.length; i++) segment[onset + i] = 0.3 * note[i]!;
  return segment;
}

describe('dsp worker', () => {
  it('rejects malformed requests with an error message', () => {
    send({ type: 'job', job: { kind: 'pluck', expectedF0: -1 } });
    expect(lastOf('error')?.message).toMatch(/bad message/);
    send({ type: 'nope' });
    expect(posted.at(-1)?.type).toBe('error');
  });

  it('judges a pluck segment with Mode A, refines the onset and returns the buffer', () => {
    send({ type: 'job', job: { kind: 'pluck', expectedF0: midiToHz(55) } });
    const samples = pluckSegment(midiToHz(55), 3);
    const start = 100_000;
    fromCapture({
      type: 'segment',
      onsetSample: start + 24_000 + 300,
      segmentStart: start,
      strength: 5,
      broadband: true,
      samples,
    });
    const onset = lastOf('onset')!;
    expect(onset.jobKind).toBe('pluck');
    expect(onset.detectorVersion).toBe(DETECTOR_VERSION);
    expect(onset.processingMs).toBeGreaterThan(0);
    // The coarse onset was 300 samples late; refinement moves it back near the true attack.
    expect(Math.abs(onset.sample - (start + 24_000))).toBeLessThan(0.006 * FS);
    expect(onset.result).toMatchObject({ status: 'OK', verdict: 'PASS', detectorVersion: DETECTOR_VERSION });
    expect(returned.at(-1)).toBe(samples);
  });

  it('flags a wrong note and verifies strums and pairs with the voicing payload', () => {
    send({ type: 'job', job: { kind: 'pluck', expectedF0: midiToHz(57) } });
    fromCapture({
      type: 'segment',
      onsetSample: 24_000,
      segmentStart: 0,
      strength: 5,
      broadband: true,
      samples: pluckSegment(midiToHz(55), 4),
    });
    expect(lastOf('onset')!.result).toMatchObject({ status: 'WRONG_NOTE', semitones: -2 });
    send({ type: 'job', job: { kind: 'strum', voicing: voicingById('C') } });
    fromCapture({
      type: 'segment',
      onsetSample: 24_000,
      segmentStart: 0,
      strength: 5,
      broadband: true,
      samples: new Float32Array(0.9 * FS),
    });
    const strum = lastOf('onset')!;
    expect(strum.jobKind).toBe('strum');
    expect(strum.result).toHaveProperty('strings');
    send({ type: 'job', job: { kind: 'pair', voicings: [voicingById('C'), voicingById('G-3f')] } });
    fromCapture({
      type: 'segment',
      onsetSample: 24_000,
      segmentStart: 0,
      strength: 5,
      broadband: true,
      samples: new Float32Array(0.9 * FS),
    });
    expect(lastOf('onset')!.jobKind).toBe('pair');
  });

  it('builds calibration templates (harmonic profile + decay ratio)', () => {
    send({ type: 'job', job: { kind: 'template', expectedF0: midiToHz(45) } });
    fromCapture({
      type: 'segment',
      onsetSample: 24_000,
      segmentStart: 0,
      strength: 5,
      broadband: true,
      samples: pluckSegment(midiToHz(45), 5),
    });
    const result = lastOf('onset')!.result as {
      pluck: { status: string; decayRatio: number };
      harmonics: number[];
    };
    expect(result.pluck.status).toBe('OK');
    expect(result.harmonics).toHaveLength(8);
    expect(result.harmonics[0]).toBeCloseTo(1, 9);
    expect(result.pluck.decayRatio).toBeGreaterThan(0.2);
  });

  it('streams tuner readings only while the tuner is on', () => {
    const before = posted.length;
    const frame = pluckSegment(midiToHz(40), 6)
      .subarray(Math.round(0.6 * FS), Math.round(0.6 * FS) + 4096)
      .slice();
    fromCapture({ type: 'tunerFrame', endSample: 5000, samples: frame });
    expect(posted.length).toBe(before);
    expect(returned.at(-1)).toBe(frame);
    send({ type: 'tuner', enabled: true, expectedF0: midiToHz(40) });
    fromCapture({ type: 'tunerFrame', endSample: 5000, samples: frame });
    const tuner = lastOf('tuner')!;
    expect(tuner.endSample).toBe(5000);
    expect(Math.abs(1200 * Math.log2(tuner.reading!.f0 / midiToHz(40)))).toBeLessThan(5);
  });

  it('pairs range requests and captured ranges in either arrival order (noise, RTT)', () => {
    const silence = new Float32Array(2 * FS);
    fromCapture({ type: 'range', id: 1, fromSample: 0, samples: silence });
    expect(lastOf('rangeResult')?.id).not.toBe(1);
    send({ type: 'analyzeRange', id: 1, request: { kind: 'noise' } });
    const noise = lastOf('rangeResult')!;
    expect(noise.id).toBe(1);
    expect((noise.result as { noiseDbfs: number }).noiseDbfs).toBeLessThan(-100);
    expect(noise.detectorVersion).toBe(DETECTOR_VERSION);

    // Loopback recording with an 80 ms delay.
    const from = 10_000;
    const scheduled = DEFAULT_RTT_PARAMS.offsetsS.map((o) => from + Math.round((0.05 + o) * FS));
    const recording = new Float32Array(Math.round(3.5 * FS));
    const probe = rttProbe(FS);
    for (const s of scheduled) {
      const at = s - from + Math.round(0.08 * FS);
      for (let i = 0; i < probe.length; i++) recording[at + i] = 0.5 * probe[i]!;
    }
    send({ type: 'analyzeRange', id: 2, request: { kind: 'rtt', scheduledSamples: scheduled } });
    fromCapture({ type: 'range', id: 2, fromSample: from, samples: recording });
    const rtt = lastOf('rangeResult')!;
    expect(rtt.id).toBe(2);
    expect(rtt.result).toMatchObject({ ok: true });
    expect((rtt.result as { rttMs: number }).rttMs).toBeCloseTo(80, 0);
    expect(rtt.processingMs).toBeGreaterThan(0);
  });

  it('analyzes strum timing against the grid (Mode D)', () => {
    send({
      type: 'analyzeTiming',
      id: 9,
      slots: [
        { time: 1, expected: true },
        { time: 1.75, expected: true },
        { time: 2.5, expected: false },
      ],
      strumTimes: [1.06, 2.5],
      rttS: 0.05,
      bpm: 80,
      personalOffsetMs: null,
    });
    const timing = posted.filter((m) => m.type === 'timingResult').at(-1) as Extract<
      WorkerToMain,
      { type: 'timingResult' }
    >;
    expect(timing.id).toBe(9);
    expect(timing.result).toMatchObject({ hits: 1, misses: 1, extras: 1 });
    expect(timing.result.offsetsMs[0]).toBeCloseTo(10, 6);
    expect(timing.detectorVersion).toBe(DETECTOR_VERSION);
    expect(timing.processingMs).toBeGreaterThan(0);
  });

  it('runs the Mode A energy fallback over a captured range', () => {
    const range = new Float32Array(Math.round(2 * FS));
    const pluck = pluckSegment(midiToHz(50), 8);
    // Very soft pluck (the flux detector may miss it) 0.6 s into the range.
    for (let i = 0; i < Math.round(0.4 * FS); i++)
      range[Math.round(0.6 * FS) + i] = 0.05 * pluck[Math.round(0.5 * FS) + i]!;
    send({ type: 'analyzeRange', id: 11, request: { kind: 'pluck', expectedF0: midiToHz(50) } });
    fromCapture({ type: 'range', id: 11, fromSample: 0, samples: range });
    const out = lastOf('rangeResult')!;
    const result = out.result as { onsetOffset: number; pluck: { status: string } };
    expect(Math.abs(result.onsetOffset - 0.6 * FS)).toBeLessThan(0.01 * FS);
    expect(result.pluck.status).toBe('OK');
    send({ type: 'analyzeRange', id: 12, request: { kind: 'pluck', expectedF0: midiToHz(50) } });
    fromCapture({ type: 'range', id: 12, fromSample: 0, samples: new Float32Array(FS) });
    expect(lastOf('rangeResult')!.result).toBeNull();
  });
});
