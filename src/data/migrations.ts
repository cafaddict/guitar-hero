/**
 * Schema migrations shared by the Dexie upgrade and the export-file import (SPEC v1.1 §13.2–13.3), so a v1
 * database and a v1 backup file end up in the same v2 shape.
 *
 * v1 → v2: the progression row trades `prescribedDrills` (pair ids drilled after a conditional promotion) for
 * `prescriptions`, gains `completedBeginner2`. Review rows already carry `kind` (v2 only indexes it).
 */
import type { Prescription, ProgressionState } from '../domain/records';

/** Sessions that count as "the user's n-th session" (SPEC v1.1 §7.3 input): finished with something practised. */
export function countedSessions(sessions: readonly Record<string, unknown>[]): number {
  return sessions.filter((s) => s.endedAt !== null && s.endedAt !== undefined && Number(s.completedItems) > 0)
    .length;
}

/** Conditional-promotion pair drills expire 8 sessions after they started (SPEC v1.1 §7.4). */
export const CONDITIONAL_PRESCRIPTION_SESSIONS = 8;

export function progressionV1toV2(row: Record<string, unknown>, sessionCount: number): ProgressionState {
  const { prescribedDrills, ...rest } = row as Record<string, unknown> & { prescribedDrills?: unknown };
  const drills = Array.isArray(prescribedDrills) ? prescribedDrills.map(String) : [];
  const sessionsInStage = Number(rest.sessionsInStage ?? 0);
  const startedAt = Number(rest.stageEnteredAt ?? 0);
  const prescriptions: Prescription[] = drills.map((pairId) => ({
    kind: 'omcToPfc',
    subjectKey: `pair:${pairId}`,
    // The drills were carried into the current stage when it was entered.
    startedSession: Math.max(0, sessionCount - sessionsInStage),
    startedAt,
    expiresAfterSessions: CONDITIONAL_PRESCRIPTION_SESSIONS,
    reason: 'conditionalPromotion',
  }));
  return {
    ...(rest as unknown as ProgressionState),
    completedBeginner2: Boolean(rest.completedBeginner2 ?? false),
    prescriptions: Array.isArray(rest.prescriptions) ? (rest.prescriptions as Prescription[]) : prescriptions,
  };
}
