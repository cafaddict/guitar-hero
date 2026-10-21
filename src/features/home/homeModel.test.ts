import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../content/curriculum';
import { PRACTICE_SONGS } from '../../content/songs';
import { DEFAULT_SETTINGS } from '../../data/settings';
import { EMPTY_HISTORY, practiceHistory } from '../../domain/history';
import {
  DAY_MS,
  initialProgression,
  type ReviewItem,
  type Session,
  type SkillState,
} from '../../domain/records';
import { generateRoutine } from '../../domain/routine';
import { itemTitle } from '../session/itemTitle';
import {
  backupReminderDue,
  practicedToday,
  reviewsServedBy,
  routineInputFrom,
  type StoredState,
  stageChecklist,
  todayPractice,
  weakPairs,
  weekPracticeMinutes,
} from './homeModel';

const NOW = new Date(2026, 9, 8, 19).getTime(); // Thursday
const session = (startedAt: number, minutes: number, extra: Partial<Session> = {}): Session => ({
  id: `s${startedAt}`,
  startedAt,
  endedAt: startedAt + minutes * 60_000,
  routineId: null,
  plannedItems: 5,
  completedItems: 5,
  selfReport: null,
  stage: 0,
  ...extra,
});

function state(partial: Partial<StoredState> = {}): StoredState {
  return {
    progression: initialProgression(NOW - 30 * DAY_MS),
    settings: DEFAULT_SETTINGS,
    skills: new Map(),
    reviews: [],
    sessions: [],
    changesDoneToday: 0,
    curriculum: CURRICULUM,
    songs: PRACTICE_SONGS,
    history: EMPTY_HISTORY,
    recentSamples: [],
    stretchStartFret: 5,
    userTemplates: [],
    ...partial,
  };
}

describe('home model', () => {
  it('routine input: same day → same routine; last report and first practice from finished sessions', () => {
    const report = { pain: 6, difficulty: 3, note: '', dangerFlags: [] };
    const s = state({
      sessions: [
        session(NOW - 3 * DAY_MS, 20),
        session(NOW - DAY_MS, 25, { selfReport: report }),
        session(NOW - 1000, 0, { endedAt: null }),
      ],
    });
    const input = routineInputFrom(s, NOW);
    expect(input.firstPracticeAt).toBe(NOW - 3 * DAY_MS);
    expect(input.lastPracticeAt).toBe(NOW - DAY_MS);
    expect(input.lastSelfReport).toEqual(report);
    expect(generateRoutine(routineInputFrom(s, NOW + 3600_000))).toEqual(generateRoutine(input));
    expect(routineInputFrom(s, NOW + DAY_MS).seed).not.toBe(input.seed);
  });

  it('week minutes, today and the backup reminder', () => {
    const sessions = [
      session(NOW - 10 * DAY_MS, 30),
      session(NOW - 2 * DAY_MS, 20),
      session(NOW - 3600_000, 15),
    ];
    expect(weekPracticeMinutes(sessions, NOW)).toBe(35);
    // A session left open overnight counts its practice time (pauses excluded), not start → report.
    const overnight = session(NOW - 3600_000, 11 * 60, { practiceMs: 25 * 60_000 });
    expect(weekPracticeMinutes([overnight], NOW)).toBe(25);
    expect(practicedToday(sessions, [], NOW)).toBe(true);
    expect(backupReminderDue(null, sessions, NOW)).toBe(true);
    expect(backupReminderDue(NOW - 6 * DAY_MS, sessions, NOW)).toBe(false);
    expect(backupReminderDue(null, [], NOW)).toBe(false);
  });

  it('today counts a session holding practice, finished or not, like the rotation does (D-095)', () => {
    const open = session(NOW - 3600_000, 0, { id: 'open', endedAt: null, completedItems: 0 });
    // Left with the self report's "나가기" before D-095 (or a reload): open, but it holds a run.
    expect(practicedToday([open], [{ sessionId: 'open' }], NOW)).toBe(true);
    expect(practicedToday([open], [], NOW)).toBe(false);
    // Ended with nothing played (started, then "세션 끝내기" at once): no practice today.
    expect(practicedToday([session(NOW - 3600_000, 5, { completedItems: 0 })], [], NOW)).toBe(false);
    // Single runs outside a session are listed, but the routine has not moved on.
    expect(practicedToday([], [{ sessionId: null }], NOW)).toBe(false);
    // A session from yesterday is not today's.
    expect(practicedToday([session(NOW - DAY_MS, 20)], [], NOW)).toBe(false);
  });

  it('an exam attempt reads as the exam item, not its internal id (§12.4)', () => {
    const lines = todayPractice(
      [{ exerciseType: 'EXAM', params: { item: '3' }, startedAt: NOW - 60_000 }],
      NOW,
    );
    expect(lines.map((l) => l.title)).toEqual(['졸업 시험 · 3번 항목']);
  });

  it('weak pairs: lowest recent medians first, then unpractised', () => {
    const skill = (key: string, values: number[]): [string, SkillState] => [
      key,
      {
        subjectKey: key,
        lastPracticedAt: NOW,
        metrics: {
          cpm: {
            count: values.length,
            best: Math.max(...values),
            last: values.at(-1)!,
            recent: values,
            dayBest: {},
            lastAt: 0,
            firstAt: 0,
          },
        },
      },
    ];
    const skills = new Map([
      skill('pair:A|D', [20, 22, 24]),
      skill('pair:A|E', [10, 12, 11]),
      skill('pair:D|E', [30, 30, 31]),
    ]);
    const top = weakPairs(skills, CURRICULUM, 2, 3);
    expect(top.map((p) => p.pairId)).toEqual(['A|E', 'A|D', 'D|E']);
    expect(top[0]!.median).toBe(11);
  });

  it('stage checklist evaluates the current stage rules', () => {
    const evaluation = stageChecklist(state(), NOW)!;
    expect(evaluation.stage).toBe(0);
    expect(evaluation.rules.length).toBeGreaterThan(0);
    expect(evaluation.allMet).toBe(false);
  });

  it("today's practice: first-start order, one line per routine item with its latest title, single runs too", () => {
    const at = (minutes: number) => NOW - 60 * 60_000 + minutes * 60_000;
    const lines = todayPractice(
      [
        {
          exerciseType: 'E5',
          params: { patternId: 'P0', bpm: 55 },
          startedAt: at(6),
          routineKey: 'E5|strum:P0',
        },
        { exerciseType: 'E2', params: { from: 'E', to: 'A' }, startedAt: at(2), routineKey: 'E2|pair:A>E' },
        {
          exerciseType: 'E5',
          params: { patternId: 'P0', bpm: 50 },
          startedAt: at(4),
          routineKey: 'E5|strum:P0',
        },
        { exerciseType: 'E4', params: { from: 'A', to: 'E' }, startedAt: at(8), routineKey: null },
        { exerciseType: 'E17', params: { riffId: 'R1' }, startedAt: at(10) },
        // yesterday's run is not today's practice
        { exerciseType: 'E1', params: { voicingId: 'E' }, startedAt: NOW - DAY_MS, routineKey: 'E1|chord:E' },
      ],
      NOW,
    );
    expect(lines.map((l) => [l.title, l.count])).toEqual([
      ['1분 코드 체인지 · E → A', 1],
      ['스트러밍 패턴 사다리 · D D D D · 55 BPM', 2],
      ['앵커·공중 체인지 드릴 · A ↔ E', 1],
      ['단음 리프 · R1', 1],
    ]);
  });

  it("after a session the next routine's rotation moves on — the done list shows what was played (D-078)", () => {
    const base = state({
      progression: { ...initialProgression(NOW - 30 * DAY_MS), stage: 2, sessionsInStage: 1 },
    });
    const first = generateRoutine(routineInputFrom(base, NOW));
    if (first.kind !== 'practice') throw new Error('expected a practice day');
    const technique = first.items.find((i) => i.block === 'technique');
    expect(technique?.exerciseType).toBe('E17');
    const played = session(NOW - 30 * 60_000, 20, { id: 'today', stage: 2 });
    const attempts = first.items
      .filter((i) => i.exerciseType !== 'REST')
      .map((i, n) => ({
        sessionId: played.id,
        exerciseType: i.exerciseType,
        params: i.params,
        result: {},
        routineKey: i.key ?? null,
        startedAt: played.startedAt + n * 60_000,
      }));
    const after = state({
      progression: base.progression,
      sessions: [played],
      history: practiceHistory([played], attempts, NOW),
    });
    const next = generateRoutine(routineInputFrom(after, NOW));
    if (next.kind !== 'practice') throw new Error('expected a practice day');
    expect(next.items.find((i) => i.block === 'technique')?.exerciseType).toBe('E4');
    expect(todayPractice(attempts, NOW).map((l) => l.title)).toContain(itemTitle(technique!));
  });

  it("the home review count is what today's routine serves, not a review block that no longer exists (D-081)", () => {
    const due = (subjectKey: string, kind: ReviewItem['kind']): ReviewItem => ({
      subjectKey,
      kind,
      step: 0,
      due: NOW - DAY_MS,
      enqueuedAt: NOW - 2 * DAY_MS,
      lastReviewedAt: null,
      lapses: 0,
    });
    const reviews = [due('card:recall:E', 'card'), due('card:recall:A', 'card')];
    const s = state({
      progression: { ...initialProgression(NOW - 30 * DAY_MS), stage: 2, sessionsInStage: 1 },
      reviews,
    });
    const plan = generateRoutine(routineInputFrom(s, NOW));
    if (plan.kind !== 'practice') throw new Error('expected a practice day');
    // v1.1 (D-058) puts reviews in blocks of their kind: the old count (block === 'review') was always 0.
    expect(plan.items.some((i) => i.block === 'review')).toBe(false);
    const keys = new Set(reviews.map((r) => r.subjectKey));
    const served = plan.items.flatMap((i) => reviewsServedBy(i, keys));
    expect(served.sort()).toEqual(['card:recall:A', 'card:recall:E']);
    expect(plan.items.find((i) => reviewsServedBy(i, keys).length > 0)?.exerciseType).toBe('Q2');
  });

  it("reviewsServedBy: an item's reviewOf and the due cards a quiz asks first, each once", () => {
    const due = new Set(['pair:A|D', 'card:note:0:3', 'card:recall:E']);
    expect(
      reviewsServedBy({ exerciseType: 'E2', params: { direction: 'A>D' }, reviewOf: 'pair:A|D' }, due),
    ).toEqual(['pair:A|D']);
    expect(
      reviewsServedBy({ exerciseType: 'Q3', params: { focus: ['card:note:0:3', 'card:note:1:2'] } }, due),
    ).toEqual(['card:note:0:3']);
    expect(reviewsServedBy({ exerciseType: 'Q2', params: { chordClasses: ['E', 'D', 'E'] } }, due)).toEqual([
      'card:recall:E',
    ]);
    expect(reviewsServedBy({ exerciseType: 'E1', params: {}, reviewOf: 'chord:C' }, due)).toEqual([]);
  });
});
