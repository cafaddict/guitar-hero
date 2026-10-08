/**
 * What happens at the start of every session (SPEC v1.1 §7.4), shared by the app and the simulation: expired
 * prescriptions are dropped, `detectStagnation` adds new ones (one per subject), and the G voicing switch is
 * suggested. Pure.
 */
import { modeOpenBpm } from '../content/patterns';
import { RIFF_TARGET_EXTRA_BPM, riffById } from '../content/riffs';
import type { GVoicing } from '../content/voicings';
import {
  detectStagnation,
  type LadderTargets,
  modeGraduated,
  PRESCRIPTION_SESSIONS,
  pairPassed,
  SLOWER_TEMPO_DAYS,
  type Stagnation,
  suggestedGVoicing,
} from './progression';
import {
  DAY_MS,
  type MetricSample,
  type Prescription,
  type ProgressionState,
  type SkillState,
} from './records';
import { chordLevel } from './skills';

/** E8 has no graduation tempo of its own; its stage rule asks for 70 BPM (§7.1 Stage 6). */
export const ALT_PICK_GOAL_BPM = 70;
/** E10 steps graduate at 80 BPM (§11.13). */
export const SCALE_GRADUATION_BPM = 80;

/** When a ladder subject stops being watched for stagnation: graduated, or at its goal tempo (§7.4). */
export const LADDER_TARGETS = (skills: ReadonlyMap<string, SkillState>): LadderTargets => ({
  done(subjectKey, currentBpm) {
    const parts = subjectKey.split(':');
    if (parts[0] === 'strum' && parts.length === 3) {
      const [, patternId, mode] = parts as [string, string, 'mute' | 'single' | 'progression'];
      return modeGraduated(skills, patternId, mode) || currentBpm >= modeOpenBpm(patternId);
    }
    if (parts[0] === 'altpick') return currentBpm >= ALT_PICK_GOAL_BPM;
    if (parts[0] === 'scale') {
      const graduated = (skills.get(subjectKey)?.metrics.streakBpm?.best ?? 0) >= SCALE_GRADUATION_BPM;
      return graduated || currentBpm >= SCALE_GRADUATION_BPM;
    }
    if (parts[0] === 'riff') {
      try {
        return currentBpm >= riffById(parts[1]!).bpm + RIFF_TARGET_EXTRA_BPM;
      } catch {
        return true;
      }
    }
    return false;
  },
});

export interface SessionPrepInput {
  progression: ProgressionState;
  skills: ReadonlyMap<string, SkillState>;
  /** Metric samples of at least the last 14 days. */
  recentSamples: readonly MetricSample[];
  /** Number of the session about to start. */
  sessionNumber: number;
  now: number;
}

export interface SessionPrep {
  progression: ProgressionState;
  added: Prescription[];
  expired: Prescription[];
  /** A G voicing switch to offer on the home screen (null = none). */
  gSuggestion: GVoicing | null;
  stagnations: Stagnation[];
}

/** A prescription ends after its sessions or date, or once its goal is reached (pair passed, chord acquired). */
export function prescriptionExpired(
  p: Prescription,
  skills: ReadonlyMap<string, SkillState>,
  sessionNumber: number,
  now: number,
): boolean {
  if (sessionNumber - p.startedSession >= p.expiresAfterSessions) return true;
  if (p.expiresAt !== undefined && now >= p.expiresAt) return true;
  if (
    (p.kind === 'omcToPfc' || p.kind === 'pfcToOmc') &&
    pairPassed(skills, p.subjectKey.slice('pair:'.length))
  )
    return true;
  if (p.kind === 'pluckMode') {
    const level = chordLevel(skills.get(p.subjectKey));
    if (level === 'acquired' || level === 'mastered') return true;
  }
  return false;
}

export function prepareSession(input: SessionPrepInput): SessionPrep {
  const { progression, skills, sessionNumber, now } = input;
  const expired: Prescription[] = [];
  const kept: Prescription[] = [];
  for (const p of progression.prescriptions) {
    (prescriptionExpired(p, skills, sessionNumber, now) ? expired : kept).push(p);
  }
  const stagnations = detectStagnation(skills, input.recentSamples, now, LADDER_TARGETS(skills));
  const added: Prescription[] = [];
  for (const s of stagnations) {
    // One prescription per subject at a time (§7.4).
    if (kept.some((p) => p.subjectKey === s.subjectKey) || added.some((p) => p.subjectKey === s.subjectKey))
      continue;
    added.push({
      kind: s.prescription,
      subjectKey: s.subjectKey,
      startedSession: sessionNumber,
      startedAt: now,
      expiresAfterSessions: PRESCRIPTION_SESSIONS,
      ...(s.prescription === 'slowerTempo' ? { expiresAt: now + SLOWER_TEMPO_DAYS * DAY_MS } : {}),
      reason: 'stagnation',
    });
  }
  const suggestion = suggestedGVoicing(progression, skills);
  return {
    progression: { ...progression, prescriptions: [...kept, ...added] },
    added,
    expired,
    gSuggestion: suggestion === progression.gVoicing ? null : suggestion,
    stagnations,
  };
}
