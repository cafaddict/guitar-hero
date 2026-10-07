import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { findFixtureDirs, labelsSchema } from './real';

describe('bench:real harness', () => {
  it('validates recording-kit labels.json', () => {
    const ok = {
      app: 'guitar-hero',
      kind: 'recording-kit',
      version: 1,
      device: 'iPhone (Safari)',
      sampleRate: 48000,
      calibration: { tuningCents: [0, 1, 2, -1, 0, 3], rttMs: 132 },
      clips: [{ file: '001.wav', label: 'C strum', kind: 'chord-strum', voicingId: 'C', expected: {} }],
    };
    expect(() => labelsSchema.parse(ok)).not.toThrow();
    expect(() => labelsSchema.parse({ ...ok, clips: [{ ...ok.clips[0], kind: 'nope' }] })).toThrow();
  });

  it('reports "no fixtures" and exits 0 when tests/fixtures/real is empty', () => {
    expect(findFixtureDirs()).toEqual([]);
    const out = execSync('npx tsx tools/bench/real.ts', { encoding: 'utf8' });
    expect(out).toContain('no fixtures');
  });
});
