import { describe, expect, it } from 'vitest';
import { CURRICULUM, stageDef } from '../../content/curriculum';
import { PRACTICE_SONGS } from '../../content/songs';
import { EMPTY_HISTORY } from '../../domain/history';
import { generateRoutine, type RoutineInput } from '../../domain/routine';
import {
  addItem,
  addOptions,
  moveItem,
  removeItem,
  resizeItem,
  toTemplate,
  userTemplateId,
} from './editorModel';

const NOW = new Date(2026, 9, 8, 19).getTime();
const input = (overrides: Partial<RoutineInput> = {}): RoutineInput => ({
  stage: 4,
  curriculum: CURRICULUM,
  songs: PRACTICE_SONGS,
  gVoicing: 'G-2f',
  skills: new Map(),
  now: NOW,
  lastPracticeAt: NOW - 86_400_000,
  firstPracticeAt: NOW - 40 * 86_400_000,
  lastSelfReport: null,
  sessionMinutes: null,
  confirmedOverCap: false,
  dueReviews: [],
  changesDoneToday: 0,
  prescriptions: [],
  history: EMPTY_HISTORY,
  sessionsInStage: 4,
  stretchStartFret: 5,
  userTemplate: null,
  seed: 1,
  ...overrides,
});

describe('routine editor (SPEC v1.1 §7.3-9)', () => {
  it('edits items, saves them as the stage template, and the generator uses it from the next session', () => {
    const plan = generateRoutine(input());
    let items = removeItem(plan.items, plan.items.find((i) => i.exerciseType === 'Q2')!.id);
    items = resizeItem(items, items.find((i) => i.block === 'song')!.id, 60);
    items = moveItem(items, items[1]!.id, 1);
    const option = addOptions(stageDef(4)).find((o) => o.slot.kind === 'custom' && o.exerciseType === 'E17')!;
    items = addItem(items, option);
    const template = toTemplate(items, 4, NOW);
    expect(template).toMatchObject({ id: userTemplateId(4), source: 'user', stage: 4 });

    const edited = generateRoutine(input({ userTemplate: template }));
    expect(edited.notices).toContainEqual({ code: 'userTemplate' });
    expect(edited.items.some((i) => i.exerciseType === 'Q2')).toBe(false);
    expect(edited.items.find((i) => i.block === 'song')?.durationSec).toBe(600);
    expect(edited.items.some((i) => i.exerciseType === 'E17')).toBe(true);
    // Params are refilled by the rules (e.g. the E17 ladder tempo, the pair slots), not frozen.
    const ladderSkills = new Map([
      [
        'riff:R2',
        {
          subjectKey: 'riff:R2',
          lastPracticedAt: NOW,
          metrics: {
            ladderBpm: { count: 1, last: 70, best: 70, lastAt: NOW, firstAt: NOW, recent: [70], dayBest: {} },
          },
        },
      ],
    ]);
    const refilled = generateRoutine(input({ userTemplate: template, skills: ladderSkills }));
    expect(refilled.items.find((i) => i.exerciseType === 'E17')?.params.bpm).toBe(70);
  });

  it('keeps block times within 30 s – 15 min and moves stay inside the list', () => {
    const plan = generateRoutine(input());
    const first = plan.items[0]!;
    expect(resizeItem(plan.items, first.id, -600)[0]!.durationSec).toBe(30);
    expect(resizeItem(plan.items, first.id, 2000)[0]!.durationSec).toBe(900);
    expect(moveItem(plan.items, first.id, -1)).toEqual(plan.items);
  });

  it('the 4-week cap still applies to an edited routine (§7.3-9)', () => {
    const plan = generateRoutine(input());
    const longer = toTemplate(resizeItem(plan.items, plan.items.at(-1)!.id, 600), 4, NOW);
    const early = generateRoutine(input({ userTemplate: longer, firstPracticeAt: NOW - 5 * 86_400_000 }));
    expect(early.needsCapConfirmation).toBe(true);
    expect(early.totalSec).toBeLessThanOrEqual(1200);
    expect(CURRICULUM.length).toBe(12);
  });
});
