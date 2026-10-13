/** Display name of a skill subject key for the home cards (SPEC v1.1 §12.4: no internal ids in Korean text). */
import { patternById } from '../../content/patterns';
import { songById } from '../../content/songs';
import { hasVoicing, voicingById } from '../../content/voicings';
import type { ReviewItem } from '../../domain/records';
import { stringNumber } from '../../domain/strings';
import { ko } from '../../i18n/ko';

const chordName = (id: string) => (hasVoicing(id) ? (voicingById(id).nameKo ?? voicingById(id).symbol) : id);

export function subjectLabel(subjectKey: string): string {
  const [kind, a = '', b] = subjectKey.split(':');
  switch (kind) {
    case 'pair':
    case 'pfc':
      return a.replace('|', '–').replace('>', ' → ');
    case 'chord':
      return chordName(a);
    case 'strum': {
      let label = a;
      try {
        label = patternById(a).label;
      } catch {
        // an unknown pattern id stays as it is
      }
      const mode = b === 'mute' || b === 'single' || b === 'progression' ? ko.exercises.e5.modes[b] : null;
      return mode ? `${label} (${mode})` : label;
    }
    case 'altpick':
      return ko.home.subjects.altpick(stringNumber(Number(a)));
    case 'riff':
      return ko.home.subjects.riff(a);
    case 'scale':
      return ko.home.subjects.scale(a, b ?? '');
    case 'song':
      try {
        return songById(a).title;
      } catch {
        return a;
      }
    case 'card': {
      const rest = subjectKey.split(':').slice(2);
      if (a === 'recall') return chordName(rest[0] ?? '');
      if (a === 'note') {
        try {
          return ko.home.subjects.notePosition(stringNumber(Number(rest[0])), Number(rest[1]));
        } catch {
          return subjectKey;
        }
      }
      if (a === 'ear') return ko.home.subjects.earKind[rest[0] ?? ''] ?? subjectKey;
      return subjectKey;
    }
    default:
      return subjectKey;
  }
}

/** A review queue item by name: its kind (a knowledge card by its quiz) and its subject (SPEC v1.1 §7.5). */
export function reviewLabel(item: Pick<ReviewItem, 'subjectKey' | 'kind'>): string {
  const t = ko.home.reviewKinds;
  const card = item.kind === 'card' ? item.subjectKey.split(':')[1] : undefined;
  const kind =
    card === 'recall' || card === 'note' || card === 'ear'
      ? t[card]
      : item.kind === 'card'
        ? ''
        : t[item.kind];
  const subject = subjectLabel(item.subjectKey);
  // "리프 R1", "스케일 … 1단계" already say what they are.
  return !kind || subject.startsWith(kind) ? subject : `${kind} · ${subject}`;
}
