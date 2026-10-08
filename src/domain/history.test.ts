import { describe, expect, it } from 'vitest';
import { attemptAppearanceKeys, practiceDaysSince, practiceHistory, sessionsSince } from './history';
import { type Attempt, DAY_MS, type Session } from './records';

const T0 = new Date(2026, 9, 1, 19).getTime();
const session = (id: string, at: number, completedItems = 3, ended = true): Session => ({
  id,
  startedAt: at,
  endedAt: ended ? at + 1_200_000 : null,
  routineId: null,
  plannedItems: 5,
  completedItems,
  selfReport: null,
  stage: 2,
});
const attempt = (sessionId: string | null, exerciseType: string, result: unknown, routineKey?: string) =>
  ({ sessionId, exerciseType, result, routineKey }) as Pick<
    Attempt,
    'sessionId' | 'exerciseType' | 'result' | 'routineKey'
  >;

describe('practice history (SPEC v1.1 §7.3 input)', () => {
  it('numbers counted sessions, practice days and last appearances', () => {
    const sessions = [
      session('a', T0),
      session('b', T0 + DAY_MS),
      session('c', T0 + DAY_MS + 3_600_000), // second session that day
      session('empty', T0 + 2 * DAY_MS, 0), // nothing practised: not counted
      session('open', T0 + 3 * DAY_MS, 2, false), // never finished: not counted
    ];
    const attempts = [
      attempt('a', 'E5', { patternId: 'P1', mode: 'single' }, 'E5|strum:P1'),
      attempt('b', 'E2', { pair: 'A|D', direction: 'A>D' }, 'E2|pair:A|D'),
      attempt('c', 'K1', { items: [{ id: 'footTap', status: 'notYet' }] }, 'K1|check:footTap'),
      attempt(null, 'E5', { patternId: 'P2', mode: 'mute' }),
    ];
    const h = practiceHistory(sessions, attempts, T0 + 4 * DAY_MS);
    expect(h.sessionNumber).toBe(4);
    expect(h.practiceDay).toBe(3);
    expect(h.appearances.get('E5|strum:P1')).toEqual({ session: 1, day: 1 });
    expect(h.appearances.get('E2|pair:A|D')).toEqual({ session: 2, day: 2 });
    expect(h.appearances.get('K1|check:footTap')).toEqual({ session: 3, day: 2 });
    // Attempts outside a session do not count.
    expect(h.appearances.has('E5|strum:P2')).toBe(false);
    expect(sessionsSince(h, 'E5|strum:P1')).toBe(3);
    expect(practiceDaysSince(h, 'E2|pair:A|D')).toBe(1);
    expect(sessionsSince(h, 'nope')).toBe(Number.POSITIVE_INFINITY);
    // Practising again today keeps today's practice day.
    expect(practiceHistory(sessions, attempts, T0 + DAY_MS + 7_200_000).practiceDay).toBe(2);
  });

  it('a routine attempt counts as its routine item; attempts started elsewhere count by their result', () => {
    // A pattern review run from the rhythm block is not the pattern's plain rotation entry.
    expect(
      attemptAppearanceKeys(
        attempt('s', 'E5', { patternId: 'P0', mode: 'progression' }, 'E5|strum:P0:progression'),
      ),
    ).toEqual(['E5|strum:P0:progression']);
    expect(
      attemptAppearanceKeys(attempt('s', 'E5', { patternId: 'P0', mode: 'mute', cuesHidden: true })),
    ).toEqual(['E5|strum:P0', 'E5|strum:P0:mute', 'E5|strum:P0:hidden']);
    // One self-check run covers each of its cards.
    expect(
      attemptAppearanceKeys(
        attempt('s', 'K1', { items: [{ id: 'posture' }, { id: 'pick' }] }, 'K1|check:posture+pick'),
      ),
    ).toEqual(['K1|check:posture+pick', 'K1|check:posture', 'K1|check:pick']);
  });
});
