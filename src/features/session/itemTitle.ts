/** Human title of a routine item: exercise name plus its subject (chord, pair, pattern, riff, song). */
import { patternById } from '../../content/patterns';
import type { RoutineItem } from '../../content/schemas';
import { songById } from '../../content/songs';
import { ko } from '../../i18n/ko';

/** A pattern's strum letters ("D DU UDU"), not its internal id (SPEC v1.1 §12.4); an unknown id stays as it is. */
function patternLabel(id: string): string {
  try {
    return patternById(id).label;
  } catch {
    return id;
  }
}

export function itemTitle(item: Pick<RoutineItem, 'exerciseType' | 'params'>): string {
  if (item.exerciseType === 'REST') return ko.home.restItem;
  const title =
    ko.exercises.titles[item.exerciseType as keyof typeof ko.exercises.titles] ?? item.exerciseType;
  const p = item.params;
  if (item.exerciseType === 'E1' && typeof p.voicingId === 'string') return `${title} · ${p.voicingId}`;
  if (item.exerciseType === 'E2' && typeof p.direction === 'string')
    return `${title} · ${p.direction.replace('>', ' → ')}`;
  if (item.exerciseType === 'E4' && typeof p.pair === 'string')
    return `${title} · ${p.pair.replace('|', ' ↔ ')}`;
  if (item.exerciseType === 'E5' && typeof p.patternId === 'string')
    return `${title} · ${patternLabel(p.patternId)}${typeof p.bpm === 'number' ? ` · ${p.bpm} BPM` : ''}`;
  if (item.exerciseType === 'E6' && Array.isArray(p.progression))
    return `${title} · ${p.progression.join('–')}`;
  if (item.exerciseType === 'E17' && typeof p.riffId === 'string') return `${title} · ${p.riffId}`;
  if (item.exerciseType === 'S' && typeof p.songId === 'string')
    return `${title} · ${songById(p.songId).title}`;
  return title;
}

/**
 * Title of a stored attempt in the same words as its routine item: the plugin's `from`/`to` (E2, E4) read back as
 * the routine's direction and pair.
 */
export function attemptTitle(attempt: { exerciseType: string; params: unknown }): string {
  const raw = (attempt.params ?? {}) as Record<string, unknown>;
  const params: Record<string, unknown> = { ...raw };
  if (typeof raw.from === 'string' && typeof raw.to === 'string') {
    if (attempt.exerciseType === 'E2') params.direction = `${raw.from}>${raw.to}`;
    if (attempt.exerciseType === 'E4') params.pair = `${raw.from}|${raw.to}`;
  }
  return itemTitle({ exerciseType: attempt.exerciseType, params });
}
