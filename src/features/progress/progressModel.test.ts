import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { type Attempt, DAY_MS, type ReviewItem, type Session, type SkillState } from '../../domain/records';
import {
  chordStringHeatmap,
  pairTrend,
  patternBests,
  practicedPairs,
  reviewQueue,
  timingTrend,
  weeklyMinutes,
} from './progressModel';

const NOW = new Date(2026, 9, 8, 19).getTime();
const e2 = (id: string, at: number, pair: string, changes: number): Attempt => ({
  id,
  sessionId: null,
  exerciseType: 'E2',
  exerciseVersion: 1,
  startedAt: at - 60_000,
  endedAt: at,
  params: {},
  result: {
    pair,
    direction: pair.replace('|', '>'),
    durationMs: 60_000,
    countMode: 'auto',
    detectedChanges: changes,
    correctedChanges: null,
    tapChanges: null,
    lowConfidenceEvents: 0,
    changeTimestampsMs: [],
  },
  detectorVersion: 'v',
  processingMs: 1,
  reviewOf: null,
});

describe('progress model', () => {
  it('weekly minutes: 8 calendar weeks, current last', () => {
    const sessions: Session[] = [
      {
        id: 'a',
        startedAt: NOW - DAY_MS,
        endedAt: NOW - DAY_MS + 20 * 60_000,
        routineId: null,
        plannedItems: 1,
        completedItems: 1,
        selfReport: null,
        stage: 0,
      },
      {
        id: 'b',
        startedAt: NOW - 8 * DAY_MS,
        endedAt: NOW - 8 * DAY_MS + 15 * 60_000,
        routineId: null,
        plannedItems: 1,
        completedItems: 1,
        selfReport: null,
        stage: 0,
      },
    ];
    const bars = weeklyMinutes(sessions, NOW);
    expect(bars).toHaveLength(8);
    expect(bars.at(-1)!.minutes).toBe(20);
    expect(bars.at(-2)!.minutes).toBe(15);
    expect(bars.at(-1)!.label).toBe('10/5');
  });

  it('pair trend with a moving median (window 3)', () => {
    const attempts = [
      e2('1', NOW - 3000, 'A|D', 20),
      e2('2', NOW - 2000, 'A|D', 30),
      e2('3', NOW - 1000, 'A|D', 22),
      e2('4', NOW, 'C|G', 10),
    ];
    expect(pairTrend(attempts, 'A|D').map((p) => [p.value, p.median])).toEqual([
      [20, 20],
      [30, 25],
      [22, 22],
    ]);
    expect(practicedPairs(attempts)).toEqual(['A|D', 'C|G']);
  });

  it('heatmap, pattern bests and timing trend', () => {
    const skills = new Map<string, SkillState>([
      [
        'chordstring:C:1',
        {
          subjectKey: 'chordstring:C:1',
          lastPracticedAt: NOW,
          metrics: {
            clean: { count: 4, best: 1, last: 1, recent: [1, 0, 1, 1], dayBest: {}, lastAt: 0, firstAt: 0 },
          },
        },
      ],
      [
        'strum:P3',
        {
          subjectKey: 'strum:P3',
          lastPracticedAt: NOW,
          metrics: {
            passBpm: { count: 2, best: 75, last: 75, recent: [70, 75], dayBest: {}, lastAt: 0, firstAt: 0 },
          },
        },
      ],
    ]);
    const heat = chordStringHeatmap([voicingById('C')], skills)[0]!;
    expect(heat.cells.map((c) => c.ratio)).toEqual([null, 0.75, null, null, null, null]);
    expect(patternBests(skills).find((p) => p.patternId === 'P3')).toEqual({
      patternId: 'P3',
      bpm: 75,
      target: 80,
    });
    const e5: Attempt = {
      ...e2('5', NOW, 'A|D', 0),
      exerciseType: 'E5',
      result: {
        patternId: 'P3',
        bpm: 80,
        bars: 8,
        mode: 'single',
        hits: 40,
        misses: 2,
        extras: 0,
        meanOffsetMs: 12,
        sdOffsetMs: 9,
        hitRate: 0.95,
        hitRateCorrected: 0.95,
        cuesHidden: false,
        ladder: 'stay',
        passed: false,
        source: 'mic',
      },
    };
    expect(timingTrend([e5])).toEqual([{ day: '2026-10-08', mean: 12, sd: 9 }]);
  });

  it('review queue: due now oldest first with days past due, then the next ones with days to go (D-081)', () => {
    const item = (subjectKey: string, due: number): ReviewItem => ({
      subjectKey,
      kind: 'card',
      step: 0,
      due,
      enqueuedAt: 0,
      lastReviewedAt: null,
      lapses: 0,
    });
    const queue = reviewQueue(
      [
        item('card:recall:E', NOW - 1000),
        item('card:recall:A', NOW - 2 * DAY_MS),
        item('card:recall:D', NOW + 3 * DAY_MS),
        item('pair:A|D', NOW + DAY_MS),
      ],
      NOW,
    );
    expect(queue.due.map((r) => [r.item.subjectKey, r.days])).toEqual([
      ['card:recall:A', 2],
      ['card:recall:E', 0],
    ]);
    expect(queue.upcoming.map((r) => [r.item.subjectKey, r.days])).toEqual([
      ['pair:A|D', 1],
      ['card:recall:D', 3],
    ]);
    expect(reviewQueue([], NOW)).toEqual({ due: [], upcoming: [] });
  });
});
