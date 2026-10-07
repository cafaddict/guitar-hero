import { describe, expect, it } from 'vitest';
import type { OneMinuteResult, RecallResult, StrumResult } from '../../domain/exerciseResults';
import type { SkillState } from '../../domain/records';
import { exam1Passed, exam2Passed, exam3Passed, exam4Passed, exam5Songs, examPairs } from './examModel';

const skill = (key: string, metric: string, recent: number[]): [string, SkillState] => [
  key,
  {
    subjectKey: key,
    lastPracticedAt: 0,
    metrics: {
      [metric]: {
        count: recent.length,
        best: Math.max(...recent),
        last: recent.at(-1)!,
        recent,
        dayBest: {},
        lastAt: 0,
        firstAt: 0,
      },
    },
  },
];

describe('graduation exam rules (SPEC §7.6)', () => {
  it('1: six strings within ±5 cents, measured', () => {
    const strings = (cents: (number | null)[]) => ({
      strings: cents.map((c, idx) => ({ idx, cents: c, inTune: true })),
      complete: true,
      durationMs: 1,
    });
    expect(exam1Passed(strings([1, -2, 4.9, 0, -5, 3]))).toBe(true);
    expect(exam1Passed(strings([1, -2, 6, 0, -5, 3]))).toBe(false);
    expect(exam1Passed(strings([null, null, null, null, null, null]))).toBe(false);
  });

  it('2: all eight chords in time and each ≥ 50 % clean', () => {
    const classes = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G'];
    const recall: RecallResult = {
      items: classes.map((c) => ({
        chordClass: c,
        voicingId: c === 'G' ? 'G-3f' : c,
        correct: true,
        reactionMs: 2500,
        method: 'mic',
      })),
    };
    const skills = new Map(
      classes.map((c) => skill(`chord:${c === 'G' ? 'G-3f' : c}`, 'clean', [1, 0, 1, 1, 0, 1])),
    );
    expect(exam2Passed(recall, skills, 'G-3f').passed).toBe(true);
    const slow = { items: recall.items.map((i, k) => (k === 3 ? { ...i, reactionMs: 3200 } : i)) };
    expect(exam2Passed(slow, skills, 'G-3f').passed).toBe(false);
    skills.set(...skill('chord:C', 'clean', [0, 0, 1, 0]));
    const r = exam2Passed(recall, skills, 'G-3f');
    expect(r.passed).toBe(false);
    expect(r.clean.C).toBe(0.25);
  });

  it('3: five distinct random pairs, each ≥ 30/min over a full minute', () => {
    const pairs = examPairs(7);
    expect(pairs).toHaveLength(5);
    expect(new Set(pairs.map((p) => p.join('|'))).size).toBe(5);
    expect(examPairs(7)).toEqual(pairs);
    const run = (changes: number, durationMs = 60_000): OneMinuteResult => ({
      pair: 'A|D',
      direction: 'A>D',
      durationMs,
      countMode: 'auto',
      detectedChanges: changes,
      correctedChanges: null,
      tapChanges: null,
      lowConfidenceEvents: 0,
      changeTimestampsMs: [],
    });
    expect(exam3Passed([run(30), run(31), run(40), run(30), run(35)])).toBe(true);
    expect(exam3Passed([run(30), run(29), run(40), run(30), run(35)])).toBe(false);
    expect(exam3Passed([run(30), run(31), run(40), run(30), run(16, 30_000)])).toBe(false);
  });

  it('4: P3 80 BPM 8 bars ≥ 90 % with cues and with cues hidden', () => {
    const r = (hitRate: number, cuesHidden: boolean): StrumResult => ({
      patternId: 'P3',
      bpm: 80,
      bars: 8,
      mode: 'single',
      hits: 0,
      misses: 0,
      extras: 0,
      meanOffsetMs: null,
      sdOffsetMs: null,
      hitRate,
      hitRateCorrected: hitRate,
      cuesHidden,
      ladder: 'stay',
      passed: false,
      source: 'mic',
    });
    expect(exam4Passed(r(0.92, false), r(0.9, true))).toBe(true);
    expect(exam4Passed(r(0.92, false), r(0.88, true))).toBe(false);
    expect(exam4Passed(r(0.92, false), r(0.95, false))).toBe(false);
  });

  it('5: songs completed with the chart hidden', () => {
    const skills = new Map([
      skill('song:s01', 'hiddenCompleted', [1]),
      skill('song:s02', 'hiddenCompleted', [0]),
      skill('song:s03', 'completed', [1]),
    ]);
    expect(exam5Songs(skills)).toBe(1);
  });
});
