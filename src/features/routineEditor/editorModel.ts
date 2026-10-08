/**
 * Routine editor model (SPEC v1.1 §7.3-9). Pure: the user edits today's routine items (add, remove, reorder,
 * block time); saving stores the composition as the stage's user template. Items keep their template slot, so
 * the generator refills pairs, chords and tempos (rules 3, 6, 10) from the next session on.
 */
import type { ExerciseRef, RoutineItem, RoutineTemplate, StageDef } from '../../content/schemas';
import { stageTemplate, type TemplateSlot } from '../../domain/routineTemplates';

export const EDITOR_STEP_SEC = 30;
export const EDITOR_MIN_SEC = 30;
export const EDITOR_MAX_SEC = 900;

export function userTemplateId(stage: number): string {
  return `user-stage-${stage}`;
}

export interface AddOption {
  id: string;
  slot: TemplateSlot;
  exerciseType: string;
  params: Record<string, unknown>;
  sec: number;
}

/** What can be added: the stage template's slots and the stage's rotation entries as fixed items. */
export function addOptions(def: StageDef): AddOption[] {
  const seen = new Set<string>();
  const out: AddOption[] = [];
  for (const row of stageTemplate(def.stage).rows) {
    if (row.slot.kind === 'rest') continue;
    const id = JSON.stringify(row.slot);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, slot: row.slot, exerciseType: slotExercise(row.slot), params: {}, sec: row.sec });
  }
  const lists: readonly ExerciseRef[][] = [
    def.rotation.rhythm,
    def.rotation.scales,
    def.rotation.technique,
    def.rotation.knowledge,
  ];
  for (const entry of lists.flat()) {
    const slot: TemplateSlot = { kind: 'custom', exerciseType: entry.type, params: entry.params };
    const id = JSON.stringify(slot);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, slot, exerciseType: entry.type, params: { ...entry.params }, sec: 120 });
  }
  return out;
}

/** The exercise a template slot produces (for labels). */
export function slotExercise(slot: TemplateSlot): string {
  switch (slot.kind) {
    case 'tuning':
      return 'E0';
    case 'repertoire':
    case 'song':
    case 'songMemorize':
      return 'S';
    case 'strumFixed':
      return 'E5';
    case 'stretch':
      return 'E7';
    case 'selfCheck':
      return 'K1';
    case 'chordFixed':
    case 'chordNew':
    case 'chordWeak':
      return 'E1';
    case 'change':
      return slot.rule === 'pfc' ? 'E3' : 'E2';
    case 'rest':
      return 'REST';
    case 'drillFixed':
      return 'E4';
    case 'oneBeatFixed':
      return 'E6';
    case 'rotation':
      return slot.list;
    case 'fixed':
    case 'custom':
      return slot.exerciseType;
    case 'recall':
      return 'Q2';
  }
}

export function removeItem(items: readonly RoutineItem[], id: string): RoutineItem[] {
  return items.filter((item) => item.id !== id);
}

export function moveItem(items: readonly RoutineItem[], id: string, delta: -1 | 1): RoutineItem[] {
  const from = items.findIndex((item) => item.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= items.length) return [...items];
  const out = [...items];
  [out[from], out[to]] = [out[to]!, out[from]!];
  return out;
}

export function resizeItem(items: readonly RoutineItem[], id: string, deltaSec: number): RoutineItem[] {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          durationSec: Math.min(EDITOR_MAX_SEC, Math.max(EDITOR_MIN_SEC, item.durationSec + deltaSec)),
        }
      : item,
  );
}

export function addItem(items: readonly RoutineItem[], option: AddOption): RoutineItem[] {
  const n = items.reduce((max, item) => Math.max(max, Number(item.id.replace(/\D/g, '')) || 0), 0) + 1;
  return [
    ...items,
    {
      id: `u${String(n).padStart(2, '0')}`,
      exerciseType: option.exerciseType,
      params: option.params,
      durationSec: option.sec,
      block: 'technique',
      slot: JSON.stringify(option.slot),
    },
  ];
}

/** The saved form: one user template per stage, replacing an earlier one. */
export function toTemplate(items: readonly RoutineItem[], stage: number, now: number): RoutineTemplate {
  return {
    id: userTemplateId(stage),
    source: 'user',
    stage,
    name: `Stage ${stage}`,
    createdAt: now,
    items: items.map((item) => ({ ...item })),
  };
}
