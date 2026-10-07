/**
 * Strum-mode verifiability coverage for the Stage 0–7 voicings (SPEC §14.3 "커버리지", AC-D2).
 */
import { SEED_VOICINGS } from '../content/voicings';
import type { Tuning } from './theory';
import { type CollisionParams, DEFAULT_COLLISION_PARAMS, partialCollisionMap } from './voicing';

export interface CoverageRow {
  voicingId: string;
  playedStrings: number;
  verifiableStrings: number;
  ratio: number;
  /** String indices that are verifiable in strum mode. */
  verifiableIdx: number[];
}

export interface CoverageReport {
  rows: CoverageRow[];
  overallRatio: number;
}

export function beginnerCoverageReport(
  tuning: Tuning,
  params: CollisionParams = DEFAULT_COLLISION_PARAMS,
): CoverageReport {
  const rows = SEED_VOICINGS.filter((v) => v.stage <= 7).map((voicing) => {
    const map = partialCollisionMap(voicing, tuning, params);
    const verifiable = map.filter((s) => s.verifiable);
    return {
      voicingId: voicing.id,
      playedStrings: map.length,
      verifiableStrings: verifiable.length,
      ratio: verifiable.length / map.length,
      verifiableIdx: verifiable.map((s) => s.idx),
    };
  });
  const played = rows.reduce((sum, r) => sum + r.playedStrings, 0);
  const verifiable = rows.reduce((sum, r) => sum + r.verifiableStrings, 0);
  return { rows, overallRatio: played > 0 ? verifiable / played : 0 };
}
