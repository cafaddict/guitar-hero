import { describe, expect, it } from 'vitest';
import type { RoutineItem } from '../../content/schemas';
import { registerAllExercises } from '../../exercises/catalog';
import { exerciseDefinition } from '../../exercises/registry';
import { TEST_CONTENT } from '../../exercises/testing/fakes';
import { pluginParamsFor } from './routineParams';
import {
  acknowledgeBreak,
  breakDue,
  completeItem,
  isFinished,
  itemRemainingSec,
  pause,
  practiceMs,
  previousItem,
  resume,
  skipItem,
  startSession,
} from './sessionModel';

registerAllExercises();

const item = (
  id: string,
  exerciseType: string,
  params: Record<string, unknown>,
  durationSec = 60,
): RoutineItem => ({ id, exerciseType, params, durationSec, block: 'chord' });

describe('pluginParamsFor', () => {
  it('maps routine vocabulary onto plugin params', () => {
    const e2 = pluginParamsFor(
      item('a', 'E2', { direction: 'A>D', pair: 'A|D', durationSec: 60 }),
      exerciseDefinition('E2')!,
      TEST_CONTENT,
    );
    expect(e2).toEqual({ from: 'A', to: 'D', durationMs: 60_000, countMode: 'auto' });
    const e4 = pluginParamsFor(item('b', 'E4', { pair: 'C|G' }, 90), exerciseDefinition('E4')!, TEST_CONTENT);
    expect(e4).toEqual({ from: 'C', to: 'G', durationMs: 90_000 });
    const e1 = pluginParamsFor(
      item('c', 'E1', { voicingId: 'G-3f', mode: 'pluck' }, 90),
      exerciseDefinition('E1')!,
      TEST_CONTENT,
    );
    expect(e1).toMatchObject({ voicingId: 'G-3f', mode: 'pluck', blockMs: 90_000 });
    const q1 = pluginParamsFor(item('d', 'Q1', { questions: 10 }), exerciseDefinition('Q1')!, TEST_CONTENT);
    expect(q1).toEqual({ seed: 0 });
    const s = pluginParamsFor(
      item('e', 'S', { songId: 's03', mode: 'perform', chartHidden: true }),
      exerciseDefinition('S')!,
      TEST_CONTENT,
    );
    expect(s).toMatchObject({ songId: 's03', mode: 'perform', chartHidden: true, bpm: 65 });
  });

  it('accepts every item the routine generator can produce for stages 0–7', async () => {
    const { generateRoutine } = await import('../../domain/routine');
    const { CURRICULUM } = await import('../../content/curriculum');
    const { PRACTICE_SONGS } = await import('../../content/songs');
    const { contentContextFor } = await import('../../exercises/contentContext');
    for (let stage = 0; stage <= 7; stage++) {
      const plan = generateRoutine({
        stage,
        curriculum: CURRICULUM,
        songs: PRACTICE_SONGS,
        gVoicing: 'G-2f',
        skills: new Map(),
        now: Date.UTC(2026, 9, 8),
        lastPracticeAt: null,
        firstPracticeAt: null,
        lastSelfReport: null,
        sessionMinutes: 20,
        confirmedOverCap: false,
        dueReviews: [],
        changesDoneToday: 0,
        prescribedDrills: [],
        seed: stage,
      });
      const content = contentContextFor({ stage, gVoicing: 'G-2f' });
      for (const it of plan.items) {
        if (it.exerciseType === 'REST') continue;
        const definition = exerciseDefinition(it.exerciseType);
        expect(definition, it.exerciseType).toBeDefined();
        expect(
          () => pluginParamsFor(it, definition!, content),
          `${stage}:${it.exerciseType} ${JSON.stringify(it.params)}`,
        ).not.toThrow();
      }
    }
  });
});

describe('session model', () => {
  const items = [item('1', 'E0', {}, 120), item('2', 'REST', {}, 30), item('3', 'Q1', {}, 300)];

  it('walks items, records which produced attempts, supports skip and previous', () => {
    let s = startSession(0);
    s = completeItem(s, items, 100_000, true);
    expect(s.index).toBe(1);
    s = previousItem(s, 101_000);
    expect(s.index).toBe(0);
    s = completeItem(s, items, 102_000, true);
    s = completeItem(s, items, 132_000, false);
    s = skipItem(s, items, 140_000);
    expect(isFinished(s, items)).toBe(true);
    expect(s).toMatchObject({ done: ['1', '2'], recorded: ['1'], skipped: ['3'] });
  });

  it('practice time excludes pauses; the item budget counts down by clock difference', () => {
    let s = startSession(1000);
    expect(itemRemainingSec(s, items, 61_000)).toBe(60);
    s = pause(s, 61_000);
    expect(practiceMs(s, 500_000)).toBe(60_000);
    s = resume(s, 500_000);
    expect(itemRemainingSec(s, items, 530_000)).toBe(30);
  });

  it('break reminder after every 30 minutes of practice', () => {
    let s = startSession(0);
    expect(breakDue(s, 29 * 60_000)).toBe(false);
    expect(breakDue(s, 30 * 60_000)).toBe(true);
    s = acknowledgeBreak(s, 31 * 60_000);
    expect(breakDue(s, 45 * 60_000)).toBe(false);
    expect(breakDue(s, 60 * 60_000)).toBe(true);
  });
});
