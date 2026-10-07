import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { beginnerCoverageReport } from './coverage';
import { STANDARD_TUNING } from './theory';
import {
  anchors,
  DEFAULT_COLLISION_PARAMS,
  expectedNotes,
  mutedStrings,
  partialCollisionMap,
  verifiableRatio,
} from './voicing';

describe('expectedNotes / mutedStrings', () => {
  it('open C = C3 E3 G3 C4 E4 with x on the 6th string', () => {
    const c = voicingById('C');
    expect(expectedNotes(c, STANDARD_TUNING).map((n) => n.midi)).toEqual([48, 52, 55, 60, 64]);
    expect(mutedStrings(c)).toEqual([0]);
  });

  it('applies capo and calibration cents offsets', () => {
    const notes = expectedNotes(voicingById('Em'), STANDARD_TUNING, 2, [0, 0, 0, 0, 0, 100]);
    expect(notes[0]!.midi).toBe(42);
    const last = notes.at(-1)!;
    expect(last.midi).toBe(66);
    expect(last.f0 / (440 * 2 ** ((66 - 69) / 12))).toBeCloseTo(2 ** (100 / 1200), 10);
  });
});

describe('AC-D2 partial collision map (SPEC §6.3)', () => {
  it('uses the fixed default rule', () => {
    expect(DEFAULT_COLLISION_PARAMS).toEqual({
      maxOwnPartial: 8,
      maxOtherPartial: 16,
      maxHz: 5000,
      inharmonicityB: 5e-5,
      toleranceCents: 35,
      lowF0Hz: 120,
      minIndependentPartials: 2,
    });
  });

  it('open C: 5th string (C3) verifiable, 2nd string (C4) not', () => {
    const map = partialCollisionMap(voicingById('C'), STANDARD_TUNING);
    const byIdx = new Map(map.map((s) => [s.idx, s]));
    expect(byIdx.get(1)?.verifiable).toBe(true);
    expect(byIdx.get(4)?.verifiable).toBe(false);
    expect(byIdx.has(0)).toBe(false);
  });

  it('never counts h=1 for strings below 120 Hz', () => {
    const map = partialCollisionMap(voicingById('E'), STANDARD_TUNING);
    const low = map.find((s) => s.idx === 0)!;
    expect(low.independentPartials).not.toContain(1);
  });

  it('reports coverage for every Stage 0–7 voicing', () => {
    const report = beginnerCoverageReport(STANDARD_TUNING);
    expect(report.rows.map((r) => r.voicingId)).toEqual([
      'D',
      'A',
      'E',
      'Em',
      'Am',
      'Dm',
      'C',
      'G-2f',
      'G-3f',
    ]);
    for (const row of report.rows) {
      expect(row.playedStrings).toBeGreaterThan(0);
      expect(row.ratio).toBe(row.verifiableStrings / row.playedStrings);
    }
    expect(report.overallRatio).toBeGreaterThan(0);
    expect(report.overallRatio).toBeLessThanOrEqual(1);
    expect(verifiableRatio([])).toBe(0);
  });
});

describe('AC-D4 anchors()', () => {
  it('D ↔ A: finger 1 stays on the 3rd string, 2nd fret; finger 3 slides', () => {
    const result = anchors(voicingById('D'), voicingById('A'));
    expect(result.anchors).toEqual([{ finger: 1, idx: 3, fret: 2 }]);
    expect(result.slides).toEqual([{ finger: 3, idx: 4, fromFret: 3, toFret: 2 }]);
    expect(anchors(voicingById('A'), voicingById('D')).anchors).toEqual([{ finger: 1, idx: 3, fret: 2 }]);
  });

  it('G ↔ C has no anchor (air change)', () => {
    for (const g of ['G-2f', 'G-3f']) {
      expect(anchors(voicingById(g), voicingById('C')).anchors).toEqual([]);
      expect(anchors(voicingById('C'), voicingById(g)).anchors).toEqual([]);
    }
  });

  it('Am ↔ C keeps fingers 1 and 2', () => {
    const result = anchors(voicingById('Am'), voicingById('C'));
    expect(result.anchors.map((a) => a.finger).sort()).toEqual([1, 2]);
  });
});
