import { describe, expect, it } from 'vitest';
import { labelsSchema } from '../../../tools/bench/real';
import type { RecordingMeta } from '../../domain/records';
import { buildLabels, clipFileName, recordingPlan } from './recordingPlan';

describe('recording kit plan', () => {
  it('guides clean, plucked, muted and x-string clips per chord, then a change and a metronome clip', () => {
    const plan = recordingPlan(['A', 'D', 'C'], 'G-3f');
    const c = plan.filter((p) => p.voicingId === 'C').map((p) => p.kind);
    expect(c).toEqual(['chord-strum', 'chord-pluck', 'chord-muted', 'x-string']);
    const muted = plan.find((p) => p.id === 'C-muted')!;
    expect([1, 2, 3, 4, 5]).toContain(muted.expected.mutedStringIdx);
    expect(plan.find((p) => p.id === 'C-x')!.expected).toEqual({ ringingIdx: 0 });
    expect(plan.find((p) => p.kind === 'one-minute')!.expected).toEqual({ direction: 'D>C' });
    expect(plan.at(-1)!.kind).toBe('strum-grid');
  });

  it('labels.json follows the bench:real schema and keeps the newest take per clip', () => {
    const meta = (
      label: string,
      createdAt: number,
      kind: string,
      expected: Record<string, unknown> = {},
    ): RecordingMeta => ({
      id: `${label}-${createdAt}`,
      createdAt,
      label,
      kind,
      voicingId: kind.startsWith('chord') ? 'C' : null,
      expected,
      sampleRate: 48000,
      durationMs: 4000,
      device: 'iPad',
      calibrationId: null,
      fileName: clipFileName(label, createdAt),
    });
    const labels = buildLabels(
      [
        meta('C-strum', 1, 'chord-strum'),
        meta('C-strum', 5, 'chord-strum'),
        meta('strum-grid', 3, 'strum-grid', {
          patternId: 'P0',
          bpm: 70,
          bars: 8,
          gridStartS: 3.5,
          rttMs: 40,
        }),
      ],
      'iPad',
      48000,
      null,
    );
    expect(labelsSchema.parse(labels)).toEqual(labels);
    expect(labels.clips.map((c) => c.file)).toEqual(['strum-grid-3.wav', 'C-strum-5.wav']);
  });
});
