import { describe, expect, it } from 'vitest';
import { CURRICULUM, PLAYABLE_STAGE_MAX } from '../../content/curriculum';
import { PRACTICE_SONGS } from '../../content/songs';
import { DEFAULT_SETTINGS } from '../../data/settings';
import { EMPTY_HISTORY } from '../../domain/history';
import { DAY_MS, initialProgression, type Session } from '../../domain/records';
import { registerAllExercises } from '../../exercises/catalog';
import { exerciseDefinition } from '../../exercises/registry';
import type { StoredState } from '../home/homeModel';
import { pluginParamsFor } from '../session/routineParams';
import { practiceOptions, stageContent, stageItems, stateAtStage } from './stagePracticeModel';

registerAllExercises();

const NOW = new Date(2026, 9, 12, 19).getTime();

function state(partial: Partial<StoredState> = {}): StoredState {
  return {
    progression: { ...initialProgression(NOW - 90 * DAY_MS), stage: 5, sessionsInStage: 2 },
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

describe('curriculum stage practice (D-072)', () => {
  it('every exercise of every stage 0–11 runs with valid parameters (or is honestly unavailable)', () => {
    const s = state();
    for (let stage = 0; stage <= PLAYABLE_STAGE_MAX; stage++) {
      const options = practiceOptions(stage);
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((o) => o.slot.kind === 'rotation')).toBe(false);
      let available = 0;
      for (const option of options) {
        const { items } = stageItems(s, stage, [option], NOW);
        if (items.length === 0) continue;
        available++;
        for (const item of items) {
          const definition = exerciseDefinition(item.exerciseType);
          expect(definition, `${stage} ${item.exerciseType}`).toBeDefined();
          const params = pluginParamsFor(item, definition!, stageContent(s, stage));
          expect(() => definition!.parseParams(params), `${stage} ${item.exerciseType}`).not.toThrow();
        }
      }
      // Most of a stage is playable straight away (K1 cards or change pairs may have nothing to do).
      expect(available / options.length).toBeGreaterThan(0.6);
    }
  });

  it('parameters come from the records like the daily routine (E6 ladder tempo at Stage 2)', () => {
    const subject = 'onebeat:A-D-E-A';
    const s = state({
      skills: new Map([
        [
          subject,
          {
            subjectKey: subject,
            lastPracticedAt: NOW - DAY_MS,
            metrics: {
              ladderBpm: {
                count: 3,
                last: 85,
                best: 85,
                lastAt: NOW,
                firstAt: NOW,
                recent: [85],
                dayBest: {},
              },
            },
          },
        ],
      ]),
    });
    const e6 = practiceOptions(2).find((o) => o.exerciseType === 'E6' && o.slot.kind === 'custom');
    expect(e6).toBeDefined();
    const { items } = stageItems(s, 2, [e6!], NOW);
    expect(items[0]).toMatchObject({ exerciseType: 'E6', params: { bpm: 85 } });
  });

  it('several picks keep their order and become one session list; another stage uses its own content', () => {
    const s = state();
    const options = practiceOptions(1);
    const chosen = [options[2]!, options[0]!];
    const { items } = stageItems(s, 1, chosen, NOW);
    expect(items.map((i) => i.exerciseType)).toEqual(chosen.map((o) => o.exerciseType));
    expect(stageContent(s, 1).stage).toBe(1);
    expect(stageContent(s, 1).unlockedChordClasses).not.toEqual(stageContent(s, 5).unlockedChordClasses);
  });

  it('a stage other than the current one is seen with its own session count', () => {
    const done = (stage: number): Session => ({
      id: `s${stage}${Math.random()}`,
      startedAt: NOW - DAY_MS,
      endedAt: NOW - DAY_MS + 60_000,
      routineId: 'custom',
      plannedItems: 1,
      completedItems: 1,
      selfReport: null,
      stage,
    });
    const s = state({ sessions: [done(2), done(2), done(3)] });
    expect(stateAtStage(s, 2).progression).toMatchObject({ stage: 2, sessionsInStage: 2 });
    expect(stateAtStage(s, 5).progression).toMatchObject({ stage: 5, sessionsInStage: 2 });
  });

  it('pain halving still applies to a curriculum pick', () => {
    const report = { pain: 6, difficulty: 3, note: '', dangerFlags: [] };
    const s = state({
      sessions: [
        {
          id: 'last',
          startedAt: NOW - DAY_MS,
          endedAt: NOW - DAY_MS + 60_000,
          routineId: null,
          plannedItems: 5,
          completedItems: 5,
          selfReport: report,
          stage: 5,
        },
      ],
    });
    const e1 = practiceOptions(5).find((o) => o.exerciseType === 'E1')!;
    const { notices } = stageItems(s, 5, [e1], NOW);
    expect(notices.map((n) => n.code)).toContain('painReduced');
  });
});
