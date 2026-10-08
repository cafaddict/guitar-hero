import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../content/curriculum';
import { PRACTICE_SONGS } from '../../content/songs';
import { DEFAULT_SETTINGS } from '../../data/settings';
import { EMPTY_HISTORY } from '../../domain/history';
import { DAY_MS, initialProgression, type Session, type SkillState } from '../../domain/records';
import { generateRoutine } from '../../domain/routine';
import {
  backupReminderDue,
  practicedToday,
  routineInputFrom,
  type StoredState,
  stageChecklist,
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
});
