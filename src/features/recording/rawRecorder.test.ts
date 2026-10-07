import { describe, expect, it } from 'vitest';
import type { AudioEngine, RangeOutcome } from '../../audio/engine';
import { IncompleteRecordingError, RawRecorder } from './rawRecorder';

/**
 * Engine stand-in: each requested range resolves with samples whose values encode their capture position.
 * `lose(k)` makes the k-th range come back partly evicted ('evicted') or never ('rejected').
 */
function fakeEngine(lose: (k: number) => 'evicted' | 'rejected' | null = () => null) {
  const ctx = { currentTime: 10 };
  const requests: [number, number][] = [];
  const engine = {
    context: ctx,
    sampleRate: 1000,
    analyzeRange(from: number, to: number): Promise<RangeOutcome> {
      const loss = lose(requests.length);
      requests.push([from, to]);
      if (loss === 'rejected') return Promise.reject(new Error('range capture timed out'));
      const n = Math.round((to - from) * 1000);
      const samples = Float32Array.from({ length: n }, (_, i) => Math.round(from * 1000) + i);
      const copied = loss === 'evicted' ? n - 300 : n;
      return Promise.resolve({ result: { copied }, samples, detectorVersion: 'v', processingMs: 0 });
    },
  } as unknown as AudioEngine;
  return { engine, ctx, requests };
}

async function record(
  engine: AudioEngine,
  ctx: { currentTime: number },
  until: number,
): Promise<Float32Array> {
  const recorder = new RawRecorder(engine);
  recorder.start();
  ctx.currentTime = until;
  (recorder as unknown as { fill(): void }).fill();
  return recorder.stop();
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

  it('rejects a take with a hole instead of saving silence under valid labels', async () => {
    for (const loss of ['evicted', 'rejected'] as const) {
      const { engine, ctx } = fakeEngine((k) => (k === 1 ? loss : null));
      await expect(record(engine, ctx, 15.3), loss).rejects.toBeInstanceOf(IncompleteRecordingError);
    }
    // A lost range past the stop point does not matter.
    const { engine, ctx } = fakeEngine((k) => (k >= 2 ? 'rejected' : null));
    await expect(record(engine, ctx, 12)).resolves.toHaveLength(Math.round((12 - 10.05) * 1000));
  });
});
