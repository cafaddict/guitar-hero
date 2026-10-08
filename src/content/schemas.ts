/**
 * zod schemas for bundled content and user-editable content (SPEC §4.1 "콘텐츠 시드, import/export").
 * Types used across the app are inferred from these schemas.
 */
import { z } from 'zod';

const fingerCell = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal('T'),
  z.literal(0),
  z.null(),
]);
const fret = z.union([z.number().int().min(0).max(24), z.literal('x')]);

export const voicingSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  nameKo: z.string().optional(),
  frets: z.array(fret).length(6),
  fingers: z.array(fingerCell).length(6),
  barres: z
    .array(
      z.object({
        fret: z.number().int().min(1),
        fromIdx: z.number().int().min(0).max(5),
        toIdx: z.number().int().min(0).max(5),
        finger: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal('T')]),
      }),
    )
    .optional(),
  baseFret: z.number().int().min(1),
  stage: z.number().int().min(0).max(11),
  tags: z.array(z.string()),
});

/** Progression unlock rules as data (SPEC v1.1 §7.4) — no per-stage if-statements in code. */
export const unlockRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('countAtLeast'),
    /** Exact subject key, or a prefix ending with '*' (e.g. 'song:*'). */
    subject: z.string(),
    metric: z.string(),
    minValue: z.number(),
    count: z.number().int().min(1),
  }),
  z.object({ kind: z.literal('metricAtLeast'), subject: z.string(), metric: z.string(), value: z.number() }),
  z.object({
    kind: z.literal('distinctDaysAtLeast'),
    subject: z.string(),
    metric: z.string(),
    value: z.number(),
    days: z.number().int().min(1),
  }),
  /** Every core pair among chords unlocked so far reaches `value` on `days` different days (§7.1 "쌍 ≥30"). */
  z.object({ kind: z.literal('unlockedPairsAtLeast'), value: z.number(), days: z.number().int().min(1) }),
  /** At least `minCount` of `pairs` reach ≥ 30 on two different days (Stage 11: 6 of 8). */
  z.object({
    kind: z.literal('pairsPassedAtLeast'),
    pairs: z.array(z.string()).min(1),
    minCount: z.number().int().min(1),
  }),
  /** §7.1 "Q2: X 3초 안 정답": each chord's recall card answered within 3 s on two different days. */
  z.object({ kind: z.literal('recallPassed'), voicingIds: z.array(z.string()).min(1) }),
  z.object({ kind: z.literal('sessionsInStageAtLeast'), count: z.number().int().min(1) }),
  /** Calendar days since entering the stage (Stage 8–11: 14). */
  z.object({ kind: z.literal('daysInStageAtLeast'), days: z.number().int().min(1) }),
  /** Distinct songs completed in perform (or hidden) stage with ≤ 2 stops, filtered by stage / chords. */
  z.object({
    kind: z.literal('songsCompletedAtLeast'),
    filter: z.object({ stage: z.number().int().optional(), anyChords: z.array(z.string()).optional() }),
    count: z.number().int().min(1),
  }),
  z.object({
    kind: z.literal('scaleStepGraduated'),
    scaleId: z.string(),
    step: z.number().int().min(1).max(5),
    bpm: z.number(),
  }),
  z.object({ kind: z.literal('scaleMemorized'), scaleId: z.string() }),
  /** One of `voicingIds` reaches `ratio` clean in its last `window` E1 attempts. */
  z.object({
    kind: z.literal('chordCleanRatioAtLeast'),
    voicingIds: z.array(z.string()).min(1),
    window: z.number().int().min(1),
    ratio: z.number(),
  }),
  /** A quiz run of `questions` questions in `scope` with accuracy and median reaction time limits. */
  z.object({
    kind: z.literal('quizRunAtLeast'),
    scope: z.string(),
    questions: z.number().int().min(1),
    accuracy: z.number(),
    medianReactionMsMax: z.number(),
  }),
  z.object({ kind: z.literal('examPassed') }),
]);
export type UnlockRule = z.infer<typeof unlockRuleSchema>;

export const exerciseRefSchema = z.object({
  type: z.string(),
  /** Free-form parameters understood by the plugin (validated by its own paramsSchema). */
  params: z.record(z.string(), z.unknown()).default({}),
});
export type ExerciseRef = z.infer<typeof exerciseRefSchema>;

/**
 * What practises a learn item (SPEC v1.1 §7.1): an exercise id ('E1', 'Q2', 'S'), an exercise variant
 * ('E5:P1' = pattern P1, 'E5:dynamics' = dynamics mode) or a self-check item ('K1:posture').
 */
export const practiceRefSchema = z.string().regex(/^(E\d{1,2}|Q\d|S|K1)(:[A-Za-z0-9]+)?$/);
export type PracticeRef = z.infer<typeof practiceRefSchema>;

export const learnItemSchema = z.object({
  text: z.string().min(1),
  practicedBy: z.array(practiceRefSchema).min(1),
});
export type LearnItem = z.infer<typeof learnItemSchema>;

/** Rotation lists of a stage (SPEC v1.1 §7.3-2): one entry per day, each at most 2 long. */
export const rotationSchema = z.object({
  rhythm: z.array(exerciseRefSchema).max(2),
  scales: z.array(exerciseRefSchema).max(2),
  technique: z.array(exerciseRefSchema).max(2),
  knowledge: z.array(exerciseRefSchema).max(2),
});
export type Rotation = z.infer<typeof rotationSchema>;

export const stageSchema = z.object({
  stage: z.number().int().min(0).max(11),
  name: z.string(),
  summary: z.string(),
  learn: z.array(learnItemSchema).min(1),
  tips: z.array(z.string()),
  /** Voicing ids first introduced in this stage. */
  newChords: z.array(z.string()),
  /** Stage 8–11 change pairs (§6.5, undirected 'A|B' by chord class); empty = core pairs among unlocked chords. */
  stagePairs: z.array(z.string()),
  /** One chord per bar for the E5 progression mode (≥ 2 different chords; empty for Stage 0). */
  rhythmProgression: z.array(z.string()),
  rotation: rotationSchema,
  unlockRules: z.array(unlockRuleSchema),
  minSessions: z.number().int().min(1),
  /** Minimum calendar days in the stage (Stage 8–11: 14). */
  minDays: z.number().int().min(0),
  locked: z.boolean(),
});
export type StageDef = z.infer<typeof stageSchema>;

export const songSchema = z.object({
  id: z.string(),
  title: z.string(),
  stage: z.number().int().min(1).max(11),
  timeSignature: z.enum(['4/4', '6/8']),
  bpmDefault: z.number().int().min(30).max(240),
  bpmMin: z.number().int().min(30).max(240),
  patternId: z.string(),
  /** Shuffle = 2:1 swung eighths (SPEC v1.1 §6.6, §6.10); absent = straight. */
  feel: z.enum(['straight', 'shuffle']).optional(),
  /** Palm-mute instruction (judging is beta). */
  palmMute: z.boolean().optional(),
  sections: z
    .array(z.object({ name: z.string(), bars: z.array(z.string()).min(1), repeat: z.number().int().min(1) }))
    .min(1),
});
export type PracticeSong = z.infer<typeof songSchema>;

export const ROUTINE_BLOCKS = [
  'tuning',
  'repertoire',
  'warmup',
  'selfCheck',
  'stageReview',
  'chord',
  'changes',
  'rest',
  'drill',
  'rhythm',
  'scale',
  'technique',
  'recall',
  'knowledge',
  'review',
  'song',
] as const;
export type RoutineBlock = (typeof ROUTINE_BLOCKS)[number];

export const routineItemSchema = z.object({
  id: z.string(),
  exerciseType: z.string(),
  params: z.record(z.string(), z.unknown()),
  durationSec: z.number().int().min(0),
  block: z.enum(ROUTINE_BLOCKS),
  subjectKey: z.string().optional(),
  /**
   * Identity of the item for "last appearance" (SPEC v1.1 §7.3 input): `<exercise>|<subject>`. Stored on the
   * attempt so rotation guarantees do not depend on what a plugin's result happens to contain.
   */
  key: z.string().optional(),
  /** The template slot that produced the item; a saved user template re-fills params from it (§7.3-9). */
  slot: z.string().optional(),
  /** A due review this item also serves (same subject key, §7.3-6). */
  reviewOf: z.string().optional(),
  note: z.string().optional(),
});
export type RoutineItem = z.infer<typeof routineItemSchema>;

export const routineTemplateSchema = z.object({
  id: z.string(),
  source: z.enum(['generated', 'user']),
  /** The stage whose routine this template replaces (user templates are per stage, §7.3-9). */
  stage: z.number().int().min(0).max(11).optional(),
  name: z.string(),
  createdAt: z.number(),
  items: z.array(routineItemSchema),
});
export type RoutineTemplate = z.infer<typeof routineTemplateSchema>;
