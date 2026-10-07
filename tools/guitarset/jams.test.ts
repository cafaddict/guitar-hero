import { describe, expect, it } from 'vitest';
import { loadThresholds } from '../bench/thresholds';
import {
  clipInfo,
  type EventFilters,
  onsetTruth,
  parseJams,
  singleEvents,
  stringOffsetsCents,
  strumEvents,
} from './jams';

const t = loadThresholds();
const f = t.guitarset.eventFilters as unknown as EventFilters;

function noteAnn(idx: number, notes: [number, number, number][], listForm = true) {
  const data = listForm
    ? notes.map(([time, duration, value]) => ({ time, duration, value, confidence: null }))
    : {
        time: notes.map((n) => n[0]),
        duration: notes.map((n) => n[1]),
        value: notes.map((n) => n[2]),
        confidence: notes.map(() => null),
      };
  return { namespace: 'note_midi', annotation_metadata: { data_source: String(idx) }, data };
}

function contourAnn(idx: number, points: [number, number][]) {
  return {
    namespace: 'pitch_contour',
    annotation_metadata: { data_source: String(idx) },
    data: points.map(([time, hz]) => ({
      time,
      duration: 0,
      value: { index: 0, frequency: hz, voiced: true },
      confidence: null,
    })),
  };
}

describe('GuitarSet JAMS', () => {
  it('parses clip names', () => {
    expect(clipInfo('00_BN1-129-Eb_comp', t.guitarset.clipNaming)).toEqual({
      id: '00_BN1-129-Eb_comp',
      player: '00',
      genre: 'BN',
      kind: 'comp',
    });
    expect(clipInfo('05_Funk2-108-Eb_solo', t.guitarset.clipNaming)?.genre).toBe('Funk');
    expect(clipInfo('bad', t.guitarset.clipNaming)).toBeNull();
  });

  it('parses list and parallel-array data forms', () => {
    const p = parseJams({ annotations: [noteAnn(0, [[1, 0.5, 40.02]]), noteAnn(5, [[0.5, 1, 64]], false)] });
    expect(p.notes).toEqual([
      { idx: 5, time: 0.5, duration: 1, midi: 64 },
      { idx: 0, time: 1, duration: 0.5, midi: 40.02 },
    ]);
  });

  it('extracts isolated strum events with ≥ 4 sounding strings and long notes', () => {
    const strum = (t0: number, dur: number) =>
      [0, 1, 2, 3, 4].map((idx) => noteAnn(idx, [[t0 + idx * 0.01, dur, 40 + idx * 5]]));
    const p = parseJams({
      annotations: [...strum(1, 0.5), ...strum(2, 0.5), ...strum(2.2, 0.5), ...strum(4, 0.1)],
    });
    const events = strumEvents(p.notes, f);
    // 1.0: kept; 2.0: next onset at 2.2 (< 300 ms) → dropped; 2.2 kept; 4.0: notes too short → dropped.
    expect(events.map((e) => e.time)).toEqual([1, 2.2]);
    expect(events[0]!.midis).toEqual([40, 45, 50, 55, 60, null]);
    expect(onsetTruth(p.notes, f)).toEqual([1, 2, 2.2, 4]);
  });

  it('extracts single notes that are long, isolated and not bent', () => {
    const p = parseJams({
      annotations: [
        noteAnn(3, [
          [1, 0.5, 55],
          [2, 0.5, 57],
          [2.2, 0.5, 59],
          [4, 0.6, 60],
        ]),
        contourAnn(3, [
          [1.1, 196],
          [1.3, 196.5],
          [4.1, 261.6],
          [4.3, 280],
        ]),
      ],
    });
    // 1.0 ok; 2.0 next onset too soon; 2.2 previous note still sounding in the 150 ms before; 4.0 bent (+117 cents).
    expect(singleEvents(p, f).map((e) => e.time)).toEqual([1]);
  });

  it('estimates per-string calibration offsets from annotations', () => {
    const p = parseJams({
      annotations: [
        noteAnn(0, [
          [0, 1, 40.1],
          [1, 1, 42.12],
          [2, 1, 44.08],
        ]),
      ],
    });
    expect(stringOffsetsCents(p.notes)[0]).toBeCloseTo(10, 6);
    expect(stringOffsetsCents(p.notes)[1]).toBe(0);
  });
});
