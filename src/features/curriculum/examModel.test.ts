import { describe, expect, it } from 'vitest';
import type { OneMinuteResult, RecallResult, StrumResult } from '../../domain/exerciseResults';
import type { SkillState } from '../../domain/records';
import {
  evaluateExamItem,
  exam1Passed,
  exam2Passed,
  exam3Passed,
  exam4Passed,
  exam5Songs,
  examPairs,
} from './examModel';

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
    // A paused run does not count (D-085).
    expect(exam4Passed({ ...r(0.92, false), pauses: 1 }, r(0.9, true))).toBe(false);
    expect(exam4Passed(r(0.92, false), { ...r(0.9, true), pauses: 2 })).toBe(false);
    expect(exam4Passed({ ...r(0.92, false), pauses: 0 }, r(0.9, true))).toBe(true);
  });

  it('5: songs played from memory — hidden stage completed with ≤ 1 stop (v1.1 §7.6-5, §11.10)', () => {
    const skills = new Map([
      skill('song:s01', 'hiddenMemorized', [1]),
      skill('song:s02', 'hiddenMemorized', [0]),
      // Completed with the chart hidden but with 2 stops is not "from memory" in v1.1.
      skill('song:s04', 'hiddenCompleted', [1]),
      skill('song:s03', 'completed', [1]),
    ]);
    expect(exam5Songs(skills)).toBe(1);
  });

  it('an aborted run (null result) fails the item instead of throwing', () => {
    const state = { skills: new Map<string, SkillState>(), gVoicing: 'G-3f' as const };
    for (const item of ['1', '2', '3', '4'] as const)
      expect(evaluateExamItem(item, [null], state)).toEqual({ passed: false, detail: { aborted: true } });
    // Item 4: the shown run finished, the hidden run was stopped.
    expect(evaluateExamItem('4', [{ hitRate: 1 }, null], state).passed).toBe(false);
    expect(evaluateExamItem('5', [], state)).toEqual({ passed: false, detail: { songs: 0 } });
  });
});
