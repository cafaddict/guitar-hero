/**
 * Routine items (domain/routine.ts) describe what to practise in routine vocabulary (direction 'A>D', pair
 * 'A|D', durationSec …). This maps them onto each plugin's params, filling the rest from the plugin defaults;
 * the plugin schema validates the result and drops keys it does not know.
 */
import type { RoutineItem } from '../../content/schemas';
import { songById } from '../../content/songs';
import { parseDirected, parsePairId } from '../../domain/pairs';
import type { ExerciseDefinition } from '../../exercises/registry';
import type { ContentContext } from '../../exercises/types';

const clampMs = (seconds: number, minMs: number, maxMs: number) =>
  Math.min(maxMs, Math.max(minMs, Math.round(seconds * 1000)));

export function pluginParamsFor(
  item: Pick<RoutineItem, 'exerciseType' | 'params' | 'durationSec'>,
  definition: ExerciseDefinition,
  content: ContentContext,
): unknown {
  const defaults = definition.defaultParams(content) as Record<string, unknown>;
  const p = item.params;
  const merged: Record<string, unknown> = { ...defaults, ...p };
  switch (item.exerciseType) {
    case 'E1':
      merged.blockMs = clampMs(item.durationSec, 60_000, 180_000);
      break;
    case 'E2': {
      const [from, to] = parseDirected(String(p.direction));
      Object.assign(merged, { from, to, durationMs: clampMs(Number(p.durationSec ?? 60), 30_000, 120_000) });
      break;
    }
    case 'E4': {
      const [from, to] = parsePairId(String(p.pair));
      Object.assign(merged, { from, to, durationMs: clampMs(item.durationSec, 60_000, 120_000) });
      break;
    }
    case 'E7':
      merged.durationMs = clampMs(item.durationSec, 60_000, 120_000);
      break;
    case 'S':
      // Without a pinned tempo the routine's song plays at its own default tempo (not the default song's).
      if (p.bpm === undefined) merged.bpm = songById(String(p.songId)).bpmDefault;
      break;
  }
  return definition.parseParams(merged);
}
