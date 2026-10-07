/**
 * Skill state = a fold over metric samples (SPEC §13.1-3). The same fold serves incremental updates and
 * full rebuilds, so "rebuild == incremental" holds by construction and is tested anyway.
 */
import { type MetricSample, type MetricSummary, RECENT_LIMIT, type SkillState } from './records';

export function applySample(state: SkillState | undefined, sample: MetricSample): SkillState {
  const base: SkillState = state
    ? { ...state, metrics: { ...state.metrics } }
    : { subjectKey: sample.subjectKey, lastPracticedAt: sample.at, metrics: {} };
  const prev = base.metrics[sample.metric];
  const summary: MetricSummary = prev
    ? {
        count: prev.count + 1,
        last: sample.value,
        best: Math.max(prev.best, sample.value),
        lastAt: Math.max(prev.lastAt, sample.at),
        firstAt: Math.min(prev.firstAt, sample.at),
        recent: [...prev.recent, sample.value].slice(-RECENT_LIMIT),
        dayBest: {
          ...prev.dayBest,
          [sample.day]: Math.max(prev.dayBest[sample.day] ?? Number.NEGATIVE_INFINITY, sample.value),
        },
      }
    : {
        count: 1,
        last: sample.value,
        best: sample.value,
        lastAt: sample.at,
        firstAt: sample.at,
        recent: [sample.value],
        dayBest: { [sample.day]: sample.value },
      };
  base.metrics[sample.metric] = summary;
  base.lastPracticedAt = Math.max(base.lastPracticedAt, sample.at);
  return base;
}

/** Orders samples the way they were (or would have been) appended. */
export function compareSamples(a: MetricSample, b: MetricSample): number {
  return a.at - b.at || (a.attemptId < b.attemptId ? -1 : a.attemptId > b.attemptId ? 1 : 0);
}

/** Rebuilds every skill state from scratch. */
export function buildSkills(samples: readonly MetricSample[]): Map<string, SkillState> {
  const skills = new Map<string, SkillState>();
  for (const sample of [...samples].sort(compareSamples)) {
    skills.set(sample.subjectKey, applySample(skills.get(sample.subjectKey), sample));
  }
  return skills;
}

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Median of the last `n` values of a metric. */
export function recentMedian(skill: SkillState | undefined, metric: string, n = 3): number | undefined {
  const summary = skill?.metrics[metric];
  return summary ? median(summary.recent.slice(-n)) : undefined;
}

/** Number of distinct days on which the metric reached `value`. */
export function daysReaching(skill: SkillState | undefined, metric: string, value: number): number {
  const summary = skill?.metrics[metric];
  if (!summary) return 0;
  return Object.values(summary.dayBest).filter((v) => v >= value).length;
}

export type ChordLevel = 'none' | 'learning' | 'acquired' | 'mastered';

/**
 * Chord acquisition (SPEC §7.4): of the last 10 Chord Perfect attempts (Mode A or manual), clean ≥ 5 →
 * acquired, ≥ 8 → mastered. Strum-mode (Mode B) passes are tracked separately and do not count.
 */
export function chordLevel(skill: SkillState | undefined): ChordLevel {
  const recent = skill?.metrics.clean?.recent ?? [];
  if (recent.length === 0) return 'none';
  const clean = recent.filter((v) => v >= 1).length;
  if (clean >= 8) return 'mastered';
  if (clean >= 5) return 'acquired';
  return 'learning';
}

export function cleanRatio(skill: SkillState | undefined): number | undefined {
  const recent = skill?.metrics.clean?.recent ?? [];
  if (recent.length === 0) return undefined;
  return recent.filter((v) => v >= 1).length / recent.length;
}
