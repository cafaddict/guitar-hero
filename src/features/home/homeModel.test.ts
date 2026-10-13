import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../content/curriculum';
import { PRACTICE_SONGS } from '../../content/songs';
import { DEFAULT_SETTINGS } from '../../data/settings';
import { EMPTY_HISTORY, practiceHistory } from '../../domain/history';
import { DAY_MS, initialProgression, type Session, type SkillState } from '../../domain/records';
import { generateRoutine } from '../../domain/routine';
import { itemTitle } from '../session/itemTitle';
import {
  backupReminderDue,
  practicedToday,
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
    expect(practicedToday(sessions, NOW)).toBe(true);
    expect(backupReminderDue(null, sessions, NOW)).toBe(true);
    expect(backupReminderDue(NOW - 6 * DAY_MS, sessions, NOW)).toBe(false);
    expect(backupReminderDue(null, [], NOW)).toBe(false);
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
});
