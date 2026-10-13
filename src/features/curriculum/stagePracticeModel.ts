/**
 * Curriculum "이 단계 연습" (D-072): any stage's exercises, run now — one alone, or several as a session — with
 * the parameters the daily routine would give them at that stage (ladder tempos, pairs, chords, song stage, E7
 * start fret …, all from the records). The routine generator does the work: the chosen exercises become a
 * one-off user template for that stage, so the safety rules (pain halving, daily change cap, E11 minutes) apply
 * as they do every day.
 */
import { stageDef } from '../../content/curriculum';
import type { RoutineItem } from '../../content/schemas';
import { generateRoutine, type RoutineInput, type RoutineNotice } from '../../domain/routine';
import { contentContextFor } from '../../exercises/contentContext';
import type { ContentContext } from '../../exercises/types';
import { routineInputFrom, type StoredState } from '../home/homeModel';
import { type AddOption, addItem, addOptions, toTemplate } from '../routineEditor/editorModel';

/** The stage's exercises: its template slots and every rotation entry (a whole rotation list is not one). */
export function practiceOptions(stage: number): AddOption[] {
  return addOptions(stageDef(stage)).filter((o) => o.slot.kind !== 'rotation');
}

/** The stored state seen from `stage`: that stage's own session count (as the stage checklist counts it). */
export function stateAtStage(state: StoredState, stage: number): StoredState {
  const sessionsInStage =
    stage === state.progression.stage
      ? state.progression.sessionsInStage
      : state.sessions.filter((x) => x.endedAt !== null && x.completedItems > 0 && x.stage === stage).length;
  return { ...state, progression: { ...state.progression, stage, sessionsInStage } };
}

/** Content for running `stage`'s exercises (its chords and voicings), whatever the current stage is. */
export function stageContent(state: StoredState, stage: number): ContentContext {
  return contentContextFor({ stage, gVoicing: state.progression.gVoicing });
}

/**
 * Routine items for the chosen options at `stage`, in the chosen order: no rest, no split, and none of the
 * routine's own additions (due reviews are the daily routine's business).
 */
export function stageItems(
  state: StoredState,
  stage: number,
  chosen: readonly AddOption[],
  now: number,
): { items: RoutineItem[]; notices: RoutineNotice[] } {
  if (chosen.length === 0) return { items: [], notices: [] };
  const template = toTemplate(
    chosen.reduce<RoutineItem[]>((items, option) => addItem(items, option), []),
    stage,
    now,
  );
  const input: RoutineInput = {
    ...routineInputFrom(stateAtStage(state, stage), now),
    userTemplate: template,
    dueReviews: [],
  };
  const plan = generateRoutine(input);
  if (plan.kind === 'rest') return { items: [], notices: [] };
  return {
    items: plan.items.filter((item) => item.exerciseType !== 'REST'),
    // The one-off template and the day's gap review are the daily routine's business, not this choice's.
    notices: plan.notices.filter((n) => n.code !== 'userTemplate' && n.code !== 'gapReview'),
  };
}
