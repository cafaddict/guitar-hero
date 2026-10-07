/** Human title of a routine item: exercise name plus its subject (chord, pair, pattern, song). */
import type { RoutineItem } from '../../content/schemas';
import { songById } from '../../content/songs';
import { ko } from '../../i18n/ko';

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
    return `${title} · ${p.patternId}${typeof p.bpm === 'number' ? ` ${p.bpm} BPM` : ''}`;
  if (item.exerciseType === 'S' && typeof p.songId === 'string')
    return `${title} · ${songById(p.songId).title}`;
  return title;
}
