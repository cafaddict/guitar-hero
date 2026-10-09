import { describe, expect, it } from 'vitest';
import {
  chromaticGroups,
  positionMidi,
  RANDOM_STEP_NOTES,
  SCALE_STEPS,
  SCALES,
  scaleById,
  scaleStepSequence,
} from './scales';

describe('SPEC v1.1 §6.8 scale shapes', () => {
  it('has the three shapes with the table note counts and ranges', () => {
    const summary = SCALES.map((s) => [
      s.id,
      s.notes.length,
      positionMidi(s.notes[0]!),
      positionMidi(s.notes.at(-1)!),
    ]);
    // E2–G4, C3–C4, A2–C5
    expect(summary).toEqual([
      ['em-pent-open', 12, 40, 67],
      ['c-major-open', 8, 48, 60],
      ['am-pent-pos1', 12, 45, 72],
    ]);
  });

  it.each(SCALES.map((s) => [s.id, s] as const))(
    '%s: in key, strictly rising, fingers follow frets',
    (_id, s) => {
      const midis = s.notes.map(positionMidi);
      for (const m of midis) expect(s.pitchClasses).toContain(m % 12);
      for (let i = 1; i < midis.length; i++) expect(midis[i]!).toBeGreaterThan(midis[i - 1]!);
      for (const string of new Set(s.notes.map((n) => n.string))) {
        const onString = s.notes.filter((n) => n.string === string);
        for (let i = 1; i < onString.length; i++) {
          expect(onString[i]!.fret).toBeGreaterThan(onString[i - 1]!.fret);
          expect(onString[i]!.finger).toBeGreaterThanOrEqual(onString[i - 1]!.finger);
        }
        for (const n of onString) expect(n.finger === 0).toBe(n.fret === 0);
      }
    },
  );
});

describe('SPEC v1.1 §6.8 E10 step sequences', () => {
  const em = scaleById('em-pent-open');
  const n = em.notes.length;

  it('step 1 goes up and back down without repeating the top note (12 → 23)', () => {
    const seq = scaleStepSequence(em, 1);
    expect(seq).toHaveLength(23);
    expect(seq.slice(0, 12)).toEqual([...Array(12).keys()]);
    expect(seq[11]).toBe(11);
    expect(seq[12]).toBe(10);
    expect(seq.at(-1)).toBe(0);
  });

  it('step 2 moves one note at a time, turns at the ends, length 2n − 1, deterministic per seed', () => {
    for (const seed of [1, 2, 3, 99]) {
      const seq = scaleStepSequence(em, 2, seed);
      expect(seq).toHaveLength(2 * n - 1);
      for (let i = 1; i < seq.length; i++) expect(Math.abs(seq[i]! - seq[i - 1]!)).toBe(1);
      expect(seq.every((i) => i >= 0 && i < n)).toBe(true);
      expect(scaleStepSequence(em, 2, seed)).toEqual(seq);
    }
    const turns = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => scaleStepSequence(em, 2, seed).join());
    expect(new Set(turns).size).toBeGreaterThan(1);
  });

  it('step 3 plays 16 notes inside the shape with no immediate repeat', () => {
    const seq = scaleStepSequence(em, 3, 7);
    expect(seq).toHaveLength(RANDOM_STEP_NOTES);
    for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
  });

  it('step 4 plays thirds up then mirrors them down', () => {
    const seq = scaleStepSequence(em, 4);
    expect(seq.slice(0, 6)).toEqual([0, 2, 1, 3, 2, 4]);
    expect(seq).toHaveLength(4 * (n - 2));
    expect(seq.slice(2 * (n - 2), 2 * (n - 2) + 4)).toEqual([11, 9, 10, 8]);
    expect(seq.slice(-2)).toEqual([2, 0]);
  });

  it('step 5 plays groups of four up then mirrors them down', () => {
    const seq = scaleStepSequence(em, 5);
    expect(seq.slice(0, 8)).toEqual([0, 1, 2, 3, 1, 2, 3, 4]);
    expect(seq).toHaveLength(8 * (n - 3));
    expect(seq.slice(-4)).toEqual([3, 2, 1, 0]);
  });

  it('every step works for every shape', () => {
    for (const s of SCALES)
      for (const step of SCALE_STEPS) {
        const seq = scaleStepSequence(s, step, 5);
        expect(seq.length).toBeGreaterThan(0);
        expect(seq.every((i) => i >= 0 && i < s.notes.length)).toBe(true);
      }
  });
});

describe('SPEC v1.1 §11.14 E9 chromatic groups', () => {
  it('one four-fret group per string 6 → 1, then 1 → 6 played 4-3-2-1', () => {
    const groups = chromaticGroups(5);
    expect(groups).toHaveLength(12);
    expect(groups[0]).toEqual([5, 6, 7, 8].map((fret) => ({ string: 6, fret })));
    expect(groups[5]![0]).toEqual({ string: 1, fret: 5 });
    expect(groups[6]).toEqual([8, 7, 6, 5].map((fret) => ({ string: 1, fret })));
    expect(groups[11]![3]).toEqual({ string: 6, fret: 5 });
  });
});
