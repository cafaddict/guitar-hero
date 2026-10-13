/**
 * A riff read out in words, bar by bar (D-080): "1마디: 6번 줄 개방 ×2 → 6번 줄 3프렛(3번 손가락) ×2". It is the
 * text alternative of the TAB picture and a way in for a learner who cannot read TAB yet (Q5 comes at Stage 4).
 */
import type { Riff, RiffNote } from '../../content/riffs';
import { ko } from '../../i18n/ko';

function noteText(note: RiffNote): string {
  const t = ko.exercises.e17.spell;
  return note.fret === 0 ? t.open(note.string) : t.fretted(note.string, note.fret, note.finger);
}

/** Consecutive repeats of one note are written once with "×n". */
function barText(notes: readonly RiffNote[]): string {
  const t = ko.exercises.e17.spell;
  const runs: { note: RiffNote; count: number }[] = [];
  for (const note of notes) {
    const last = runs.at(-1);
    if (last && last.note.string === note.string && last.note.fret === note.fret) last.count += 1;
    else runs.push({ note, count: 1 });
  }
  return runs.map((r) => noteText(r.note) + (r.count > 1 ? t.times(r.count) : '')).join(t.joiner);
}

export function riffSpelled(riff: Riff): string[] {
  return riff.bars.map((notes, i) => ko.exercises.e17.spell.bar(i + 1, barText(notes)));
}
