/**
 * Progress dashboard data (SPEC §12.1 진도): weekly practice minutes, one-minute-change trends with a moving
 * median, chord × string clean ratios, best passed BPM per pattern, timing mean/sd over time. Pure.
 */
import { STRUM_PATTERNS } from '../../content/patterns';
import { changesPerMinute, oneMinuteResultSchema, strumResultSchema } from '../../domain/exerciseResults';
import { type Attempt, dayKey, type Session, type SkillState, sessionPracticeMs } from '../../domain/records';
import { median } from '../../domain/skills';
import { weekIndex } from '../../domain/srs';
import { STRING_INDICES } from '../../domain/strings';
import type { ChordVoicing } from '../../domain/voicing';

export interface WeekBar {
  label: string;
  minutes: number;
}

/** Minutes per calendar week for the last `weeks` weeks (oldest first); label = Monday's date (M/D). */
export function weeklyMinutes(sessions: readonly Session[], now: number, weeks = 8): WeekBar[] {
  const current = weekIndex(now);
  const bars: WeekBar[] = [];
  for (let w = current - weeks + 1; w <= current; w++) {
    const minutes = sessions
      .filter((s) => s.endedAt !== null && weekIndex(s.startedAt) === w)
      .reduce((sum, s) => sum + sessionPracticeMs(s) / 60_000, 0);
    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - 7 * (current - w));
    bars.push({ label: `${monday.getMonth() + 1}/${monday.getDate()}`, minutes: Math.round(minutes) });
  }
  return bars;
}

export interface TrendPoint {
  at: number;
  value: number;
  /** Median of this and the two previous values (moving median, window 3). */
  median: number;
}

function withMovingMedian(points: { at: number; value: number }[]): TrendPoint[] {
  return points.map((p, i) => ({
    ...p,
    median: median(points.slice(Math.max(0, i - 2), i + 1).map((x) => x.value))!,
  }));
}

/** Changes per minute of every one-minute-change run of a pair (both directions), oldest first. */
export function pairTrend(attempts: readonly Attempt[], pairId: string): TrendPoint[] {
  const points = attempts
    .filter((a) => a.exerciseType === 'E2')
    .flatMap((a) => {
      const r = oneMinuteResultSchema.safeParse(a.result);
      return r.success && r.data.pair === pairId ? [{ at: a.endedAt, value: changesPerMinute(r.data) }] : [];
    })
    .sort((x, y) => x.at - y.at);
  return withMovingMedian(points);
}

export function practicedPairs(attempts: readonly Attempt[]): string[] {
  const pairs = new Set<string>();
  for (const a of attempts) {
    if (a.exerciseType !== 'E2') continue;
    const r = oneMinuteResultSchema.safeParse(a.result);
    if (r.success) pairs.add(r.data.pair);
  }
  return [...pairs].sort();
}

export interface HeatCell {
  idx: number;
  /** Mean clean ratio of the recent string checks; null = never judged. */
  ratio: number | null;
}

/** Chord × string clean ratio from `chordstring:<voicing>:<idx>` skills (x strings are null). */
export function chordStringHeatmap(
  voicings: readonly ChordVoicing[],
  skills: ReadonlyMap<string, SkillState>,
): { voicingId: string; cells: HeatCell[] }[] {
  return voicings.map((v) => ({
    voicingId: v.id,
    cells: STRING_INDICES.map((idx) => {
      const recent = skills.get(`chordstring:${v.id}:${idx}`)?.metrics.clean?.recent ?? [];
      return {
        idx,
        ratio:
          v.frets[idx] === 'x' || recent.length === 0
            ? null
            : recent.reduce((s, x) => s + x, 0) / recent.length,
      };
    }),
  }));
}

/** Best passed BPM per pattern (from `strum:<pattern>` passBpm). */
export function patternBests(
  skills: ReadonlyMap<string, SkillState>,
): { patternId: string; bpm: number | null; target: number | null }[] {
  return STRUM_PATTERNS.map((p) => ({
    patternId: p.id,
    bpm: skills.get(`strum:${p.id}`)?.metrics.passBpm?.best ?? null,
    target: p.targetBpm ?? null,
  }));
}

export interface TimingPoint {
  day: string;
  mean: number;
  sd: number;
}

/** Strumming timing mean/sd per run (E5 with microphone), oldest first. */
export function timingTrend(attempts: readonly Attempt[]): TimingPoint[] {
  return attempts
    .filter((a) => a.exerciseType === 'E5')
    .flatMap((a) => {
      const r = strumResultSchema.safeParse(a.result);
      if (!r.success || r.data.meanOffsetMs === null || r.data.sdOffsetMs === null) return [];
      return [{ at: a.endedAt, day: dayKey(a.endedAt), mean: r.data.meanOffsetMs, sd: r.data.sdOffsetMs }];
    })
    .sort((x, y) => x.at - y.at)
    .map(({ day, mean, sd }) => ({ day, mean, sd }));
}
