/** Content context for runners from the stored progression (stage, unlocked chord classes, G voicing). */
import { CURRICULUM, PLAYABLE_STAGE_MAX } from '../content/curriculum';
import { SEED_VOICINGS } from '../content/voicings';
import { unlockedChordClasses } from '../domain/progression';
import type { ProgressionState } from '../domain/records';
import type { ContentContext } from './types';

export function contentContextFor(progression: Pick<ProgressionState, 'stage' | 'gVoicing'>): ContentContext {
  const stage = Math.min(progression.stage, PLAYABLE_STAGE_MAX);
  return {
    voicings: SEED_VOICINGS,
    unlockedChordClasses: unlockedChordClasses(CURRICULUM, stage),
    gVoicing: progression.gVoicing,
    stage,
  };
}
