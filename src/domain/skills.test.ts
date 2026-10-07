import { describe, expect, it } from 'vitest';
import { mulberry32 } from './prng';
import { dayKey, type MetricSample } from './records';
import {
  applySample,
  buildSkills,
  chordLevel,
  cleanRatio,
  daysReaching,
  median,
  recentMedian,
} from './skills';

const T0 = new Date(2026, 9, 1, 10).getTime();

function randomSamples(seed: number, n: number): MetricSample[] {
  const rng = mulberry32(seed);
  const subjects = ['chord:C', 'pair:A|D', 'pairdir:A>D', 'strum:P3'];
  return Array.from({ length: n }, (_, i) => {
    const at = T0 + i * 3_600_000 * (1 + Math.floor(rng() * 20));
    return {
      subjectKey: subjects[Math.floor(rng() * subjects.length)]!,
      metric: rng() < 0.5 ? 'cpm' : 'clean',
      value: Math.round(rng() * 40),
      at,
      day: dayKey(at),
      attemptId: `a${i}`,
    };
  });
}

describe('skill fold', () => {
  it('incremental application equals a full rebuild', () => {
    const samples = randomSamples(5, 300).sort((a, b) => a.at - b.at);
    const incremental = new Map<string, ReturnType<typeof applySample>>();
    for (const sample of samples)
      incremental.set(sample.subjectKey, applySample(incremental.get(sample.subjectKey), sample));
    expect(buildSkills([...samples].reverse())).toEqual(incremental);
  });

  it('median and recent median', () => {
    expect(median([])).toBeUndefined();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    const skills = buildSkills(
      [10, 20, 30, 40].map((v, i) => ({
        subjectKey: 'p',
        metric: 'cpm',
        value: v,
        at: T0 + i,
        day: dayKey(T0),
        attemptId: `x${i}`,
      })),
    );
    expect(recentMedian(skills.get('p'), 'cpm', 3)).toBe(30);
    expect(daysReaching(skills.get('p'), 'cpm', 30)).toBe(1);
  });

  it('chord level: ≥ 5 of last 10 clean → acquired, ≥ 8 → mastered', () => {
    const make = (flags: number[]) =>
      buildSkills(
        flags.map((v, i) => ({
          subjectKey: 'chord:C',
          metric: 'clean',
          value: v,
          at: T0 + i,
          day: dayKey(T0),
          attemptId: `c${i}`,
        })),
      ).get('chord:C');
    expect(chordLevel(undefined)).toBe('none');
    expect(chordLevel(make([1, 1, 1, 1, 0, 0, 0, 0, 0, 0]))).toBe('learning');
    expect(chordLevel(make([1, 1, 1, 1, 1, 0, 0, 0, 0, 0]))).toBe('acquired');
    expect(chordLevel(make([1, 1, 1, 1, 1, 1, 1, 1, 0, 0]))).toBe('mastered');
    // Only the last 10 count.
    expect(chordLevel(make([1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe('learning');
    expect(cleanRatio(make([1, 0]))).toBe(0.5);
  });
});
