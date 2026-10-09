/**
 * The app functions the curriculum simulation injects (SPEC v1.1 §14.9-1): the real plugin registry and
 * `pluginParamsFor`, the plugins' own `withHistory` and `toMetrics`, and the same `applyAttempt` the repository
 * uses.
 */
import { CURRICULUM } from '../../content/curriculum';
import { SEED_VOICINGS } from '../../content/voicings';
import { applyAttempt } from '../../domain/derive';
import { unlockedChordClasses } from '../../domain/progression';
import type { SimDeps } from '../../domain/simulate';
import { pluginParamsFor } from '../../features/session/routineParams';
import { registerAllExercises } from '../catalog';
import { exerciseDefinition } from '../registry';

export function simulationDeps(): SimDeps {
  registerAllExercises();
  const definition = (type: string) => {
    const d = exerciseDefinition(type);
    if (!d) throw new Error(`exercise ${type} is not registered`);
    return d;
  };
  return {
    paramsFor(item, stage, gVoicing) {
      return pluginParamsFor(item, definition(item.exerciseType), {
        voicings: SEED_VOICINGS,
        unlockedChordClasses: unlockedChordClasses(CURRICULUM, stage),
        gVoicing,
        stage,
      });
    },
    // Like ExerciseHost: the plugin's history adjustment sees its latest results (its own depth, ≥ 5).
    withHistory: (type, params, recentResults) => {
      const d = definition(type);
      return d.withHistory(params, recentResults.slice(0, Math.max(5, d.historyDepth)));
    },
    toMetrics: (type, result, params) => definition(type).toMetrics(result, params),
    applyAttempt,
  };
}
