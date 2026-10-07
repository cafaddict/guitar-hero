/**
 * Record types shared by the data layer and the pure domain engines (SPEC §13).
 * Attempts are facts (append-only); metric samples and skill states are caches derived from them.
 */

export interface MetricSampleInput {
  subjectKey: string;
  metric: string;
  value: number;
}

export interface MetricSample extends MetricSampleInput {
  /** Auto-increment key in IndexedDB (absent before insertion). */
  seq?: number;
  at: number;
  /** Local calendar day 'YYYY-MM-DD' of `at`. */
  day: string;
  attemptId: string;
}

export interface SelfReport {
  /** 0..10 */
  pain: number;
  /** Sharp pain, numbness, joint or wrist pain → rest advice (SPEC §7.3 rule 7). */
  dangerFlags: readonly ('sharp' | 'numbness' | 'joint')[];
  /** 1..5 */
  difficulty: number;
  note: string;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt: number | null;
  routineId: string | null;
  plannedItems: number;
  completedItems: number;
  selfReport: SelfReport | null;
  stage: number;
  /** Practice time without pauses (§8.5 clock differences); absent on sessions stored before it existed. */
  practiceMs?: number;
}

/** Practice time of a finished session: the paused-excluded time when stored, else start → end. */
export function sessionPracticeMs(session: Session): number {
  if (session.endedAt === null) return 0;
  return session.practiceMs ?? session.endedAt - session.startedAt;
}

export interface Attempt {
  id: string;
  sessionId: string | null;
  exerciseType: string;
  exerciseVersion: number;
  startedAt: number;
  endedAt: number;
  /** Parameter snapshot. */
  params: unknown;
  /** Plugin result (validated by the plugin's resultSchema). Includes auto, corrected and self-reported values. */
  result: unknown;
  /** DSP detector version when the microphone judged anything; null for manual-only attempts. */
  detectorVersion: string | null;
  /** Mean DSP processing time per judged event (ms); 0 when no DSP ran. */
  processingMs: number;
  /** Review subject when the attempt was scheduled from the review queue. */
  reviewOf: string | null;
}

export interface MetricSummary {
  count: number;
  last: number;
  best: number;
  lastAt: number;
  firstAt: number;
  /** Most recent values, oldest first (at most RECENT_LIMIT). */
  recent: number[];
  /** Best value per local day. */
  dayBest: Record<string, number>;
}

export interface SkillState {
  subjectKey: string;
  lastPracticedAt: number;
  metrics: Record<string, MetricSummary>;
}

export type ReviewKind = 'chord' | 'pair' | 'pattern' | 'song';

export interface ReviewItem {
  subjectKey: string;
  kind: ReviewKind;
  step: number;
  due: number;
  enqueuedAt: number;
  lastReviewedAt: number | null;
  lapses: number;
}

export interface ProgressionState {
  key: 'current';
  stage: number;
  stageEnteredAt: number;
  /** Sessions completed since entering the current stage. */
  sessionsInStage: number;
  gVoicing: 'G-2f' | 'G-3f';
  history: { stage: number; enteredAt: number; leftAt: number; conditional: boolean }[];
  /** Graduation exam (SPEC §7.6) items '1'..'5' → time passed. */
  exam: Record<string, number>;
  completedBeginner1: boolean;
  /** Conditional promotion prescriptions carried into the next stage (pair ids needing anchor/air drills). */
  prescribedDrills: string[];
}

export const RECENT_LIMIT = 10;

/** Local calendar day key. */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export const DAY_MS = 86_400_000;

/** Start of the local day containing `ms`. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function initialProgression(now: number): ProgressionState {
  return {
    key: 'current',
    stage: 0,
    stageEnteredAt: now,
    sessionsInStage: 0,
    gVoicing: 'G-2f',
    history: [],
    exam: {},
    completedBeginner1: false,
    prescribedDrills: [],
  };
}

/** Calibration result (SPEC §9.1). JSON-serializable. */
export interface Calibration {
  id: string;
  createdAt: number;
  inputDeviceLabel: string;
  outputDeviceLabel: string;
  sampleRate: number;
  trackSettings: Record<string, unknown>;
  noiseFloorDbfs: number;
  noiseThirdOctaveDb?: number[];
  /** δ[i] cents per string, idx 0 = 6th string. */
  tuningCents: number[];
  stringTemplates: { harmonics: number[]; decayRatio: number }[];
  rttMs: number;
  rttMethod: 'loopback' | 'tap';
  rttMadMs: number;
  warnings: string[];
}

/** Recording-kit clip metadata (audio lives in OPFS). */
export interface RecordingMeta {
  id: string;
  createdAt: number;
  label: string;
  /** e.g. 'chord-clean-strum', 'chord-pluck', 'chord-muted', 'x-string', 'one-minute', 'strum-grid'. */
  kind: string;
  voicingId: string | null;
  expected: Record<string, unknown>;
  sampleRate: number;
  durationMs: number;
  device: string;
  calibrationId: string | null;
  fileName: string;
}
