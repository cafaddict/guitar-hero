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

/** Progression unlock rules as data (SPEC §7.4) — no per-stage if-statements in code. */
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
  /** Every core pair among chords unlocked so far reaches `value` on `days` different days. */
  z.object({ kind: z.literal('unlockedPairsAtLeast'), value: z.number(), days: z.number().int().min(1) }),
  /** Recall quiz (Q2) passed within the time limit for every unlocked chord class. */
  z.object({ kind: z.literal('recallUnlocked') }),
  z.object({ kind: z.literal('sessionsInStageAtLeast'), count: z.number().int().min(1) }),
  z.object({ kind: z.literal('examPassed') }),
]);
export type UnlockRule = z.infer<typeof unlockRuleSchema>;

export const exerciseRefSchema = z.object({
  type: z.string(),
  /** Free-form parameters understood by the plugin (validated by its own paramsSchema). */
  params: z.record(z.string(), z.unknown()).default({}),
});
export type ExerciseRef = z.infer<typeof exerciseRefSchema>;

export const stageSchema = z.object({
  stage: z.number().int().min(0).max(11),
  name: z.string(),
  summary: z.string(),
  learn: z.array(z.string()),
  tips: z.array(z.string()),
  /** Voicing ids first introduced in this stage. */
  newChords: z.array(z.string()),
  /** Directed one-minute-change focus pairs, e.g. 'A>D'. */
  focusPairs: z.array(z.string()),
  /** Rhythm focus: pattern ids with practice mode. */
  rhythm: z.array(z.object({ patternId: z.string(), mode: z.enum(['mute', 'single', 'progression']) })),
  /** Technique / quiz blocks rotated by the routine generator. */
  technique: z.array(exerciseRefSchema),
  unlockRules: z.array(unlockRuleSchema),
  minSessions: z.number().int().min(1),
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
  sections: z
    .array(z.object({ name: z.string(), bars: z.array(z.string()).min(1), repeat: z.number().int().min(1) }))
    .min(1),
});
export type PracticeSong = z.infer<typeof songSchema>;

export const routineItemSchema = z.object({
  id: z.string(),
  exerciseType: z.string(),
  params: z.record(z.string(), z.unknown()),
  durationSec: z.number().int().min(0),
  block: z.enum([
    'tuning',
    'warmup',
    'stageReview',
    'chord',
    'changes',
    'rest',
    'rhythm',
    'technique',
    'review',
    'song',
  ]),
  subjectKey: z.string().optional(),
  note: z.string().optional(),
});
export type RoutineItem = z.infer<typeof routineItemSchema>;

export const routineTemplateSchema = z.object({
  id: z.string(),
  source: z.enum(['generated', 'user']),
  name: z.string(),
  createdAt: z.number(),
  items: z.array(routineItemSchema),
});
export type RoutineTemplate = z.infer<typeof routineTemplateSchema>;
