import { describe, expect, it } from 'vitest';
import type { AudioEngine, RangeOutcome } from '../../audio/engine';
import { RawRecorder } from './rawRecorder';

/** Engine stand-in: each requested range resolves with samples whose values encode their capture position. */
function fakeEngine() {
  const ctx = { currentTime: 10 };
  const requests: [number, number][] = [];
  const engine = {
    context: ctx,
    sampleRate: 1000,
    analyzeRange(from: number, to: number): Promise<RangeOutcome> {
      requests.push([from, to]);
      const n = Math.round((to - from) * 1000);
      const samples = Float32Array.from({ length: n }, (_, i) => Math.round(from * 1000) + i);
      return Promise.resolve({ result: null, samples, detectorVersion: 'v', processingMs: 0 });
    },
  } as unknown as AudioEngine;
  return { engine, ctx, requests };
}

describe('RawRecorder', () => {
  it('stitches consecutive 2 s ranges into one contiguous recording trimmed at stop', async () => {
    const { engine, ctx, requests } = fakeEngine();
    const recorder = new RawRecorder(engine);
    const start = recorder.start();
    expect(start).toBeCloseTo(10.05, 9);
    ctx.currentTime = 15.3;
    // Simulate the 250 ms polling the timer would do.
    (recorder as unknown as { fill(): void }).fill();
    const samples = await recorder.stop();
    expect(requests.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < requests.length; i++) expect(requests[i]![0]).toBeCloseTo(requests[i - 1]![1], 9);
    expect(samples.length).toBe(Math.round((15.3 - 10.05) * 1000));
    // Contiguous: every sample is the previous plus one.
    for (let i = 1; i < samples.length; i++) expect(samples[i]! - samples[i - 1]!).toBe(1);
    expect(samples[0]).toBe(10050);
  });
});
