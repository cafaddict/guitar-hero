/** Display name of a skill subject key for the home cards (SPEC v1.1 §12.4: no internal ids in Korean text). */
import { patternById } from '../../content/patterns';
import { hasVoicing, voicingById } from '../../content/voicings';
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
    default:
      return subjectKey;
  }
}
