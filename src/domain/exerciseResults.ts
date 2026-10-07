/**
 * Result schemas and pure metric extraction for every v1 exercise type (SPEC §11.2).
 * Plugins (features/exercises) reuse these so that rebuildDerived() can recompute metrics from attempts
 * without loading any UI code.
 */
import { z } from 'zod';
import { pairDirKey, pairKey, parseDirected } from './pairs';
import type { MetricSampleInput } from './records';

export const stringStatusSchema = z.enum([
  'OK',
  'MUTED',
  'WRONG_NOTE',
  'UNEXPECTED',
  'WEAK',
  'UNVERIFIABLE',
  'NOT_PLAYED',
]);
export type StringStatusValue = z.infer<typeof stringStatusSchema>;
export const selfStringStatusSchema = z.enum(['clean', 'muted', 'buzz']);

export const tuningResultSchema = z.object({
  strings: z.array(z.object({ idx: z.number().int(), cents: z.number().nullable(), inTune: z.boolean() })),
  complete: z.boolean(),
  durationMs: z.number(),
});

export const chordCheckAttemptSchema = z.object({
  perString: z.array(
    z.object({
      idx: z.number().int(),
      status: stringStatusSchema.nullable(),
      selfStatus: selfStringStatusSchema.nullable(),
      cents: z.number().nullable(),
      confidence: z.number(),
      semitones: z.number().nullable(),
    }),
  ),
  clean: z.boolean(),
  strumVerdict: z.enum(['PASS', 'FAIL', 'RETRY']).nullable(),
  /** Ear-first: share of strings where self-judgement matched the app (null when not in ear-first mode). */
  selfAgreement: z.number().nullable(),
});
export const chordCheckResultSchema = z.object({
  voicingId: z.string(),
  mode: z.enum(['pluck', 'strum', 'manual']),
  earFirst: z.boolean(),
  attempts: z.array(chordCheckAttemptSchema),
  cleanRatio: z.number(),
});

export const oneMinuteResultSchema = z.object({
  pair: z.string(),
  direction: z.string(),
  durationMs: z.number().positive(),
  countMode: z.enum(['auto', 'tap', 'manual']),
  detectedChanges: z.number().int().min(0),
  correctedChanges: z.number().int().min(0).nullable(),
  tapChanges: z.number().int().min(0).nullable(),
  lowConfidenceEvents: z.number().int().min(0),
  changeTimestampsMs: z.array(z.number()),
});

export const anchorDrillResultSchema = z.object({
  pair: z.string(),
  kind: z.enum(['anchor', 'air']),
  durationMs: z.number(),
  selfReportSuccess: z.number().int().min(0).max(10).nullable(),
});

export const strumResultSchema = z.object({
  patternId: z.string(),
  bpm: z.number(),
  bars: z.number().int(),
  mode: z.enum(['mute', 'single', 'progression']),
  hits: z.number().int(),
  misses: z.number().int(),
  extras: z.number().int(),
  meanOffsetMs: z.number().nullable(),
  sdOffsetMs: z.number().nullable(),
  hitRate: z.number(),
  hitRateCorrected: z.number(),
  cuesHidden: z.boolean(),
  /** Ladder decision taken from this run. */
  ladder: z.enum(['up', 'down', 'stay']),
  passed: z.boolean(),
  source: z.enum(['mic', 'self']),
});

export const oneBeatResultSchema = z.object({
  progression: z.array(z.string()),
  patternId: z.string(),
  bpm: z.number(),
  bars: z.number().int(),
  barsInWindow: z.number().int(),
  stops: z.number().int(),
  beat1DelayMsMean: z.number().nullable(),
  missingBarRatio: z.number(),
  passed: z.boolean(),
  source: z.enum(['mic', 'self']),
});

export const stretchResultSchema = z.object({
  startFret: z.number().int(),
  durationMs: z.number(),
  pain: z.number().int().min(0).max(10).nullable(),
});

export const altPickResultSchema = z.object({
  stringIdx: z.number().int(),
  bpm: z.number(),
  bars: z.number().int(),
  hitRate: z.number(),
  ioiCv: z.number().nullable(),
  passed: z.boolean(),
  source: z.enum(['mic', 'self']),
});

export const quizResultSchema = z.object({
  questions: z.number().int().min(1),
  correct: z.number().int().min(0),
  meanReactionMs: z.number().nullable(),
});

export const recallResultSchema = z.object({
  items: z.array(
    z.object({
      chordClass: z.string(),
      voicingId: z.string(),
      correct: z.boolean(),
      reactionMs: z.number().nullable(),
      method: z.enum(['mic', 'self']),
    }),
  ),
});

export const songResultSchema = z.object({
  songId: z.string(),
  mode: z.enum(['learn', 'perform']),
  chartHidden: z.boolean(),
  bpm: z.number(),
  completed: z.boolean(),
  stops: z.number().int().min(0),
  memorized: z.boolean(),
  beat1HitRate: z.number().nullable(),
});

export const examResultSchema = z.object({
  item: z.enum(['1', '2', '3', '4', '5']),
  passed: z.boolean(),
  detail: z.record(z.string(), z.unknown()),
});

export type TuningResult = z.infer<typeof tuningResultSchema>;
export type ChordCheckResult = z.infer<typeof chordCheckResultSchema>;
export type ChordCheckAttempt = z.infer<typeof chordCheckAttemptSchema>;
export type OneMinuteResult = z.infer<typeof oneMinuteResultSchema>;
export type AnchorDrillResult = z.infer<typeof anchorDrillResultSchema>;
export type StrumResult = z.infer<typeof strumResultSchema>;
export type OneBeatResult = z.infer<typeof oneBeatResultSchema>;
export type StretchResult = z.infer<typeof stretchResultSchema>;
export type AltPickResult = z.infer<typeof altPickResultSchema>;
export type QuizResult = z.infer<typeof quizResultSchema>;
export type RecallResult = z.infer<typeof recallResultSchema>;
export type SongResult = z.infer<typeof songResultSchema>;
export type ExamResult = z.infer<typeof examResultSchema>;

/** Recall must be answered within this time to count as a pass (SPEC §7.1, §7.6-2). */
export const RECALL_LIMIT_MS = 3000;

/** Changes per minute from a one-minute-change result: corrected ?? tap/detected, scaled to 60 s. */
export function changesPerMinute(r: OneMinuteResult): number {
  const raw = r.correctedChanges ?? (r.countMode === 'tap' ? (r.tapChanges ?? 0) : r.detectedChanges);
  return (raw * 60_000) / r.durationMs;
}

const m = (subjectKey: string, metric: string, value: number): MetricSampleInput => ({
  subjectKey,
  metric,
  value,
});

type Extractor = (result: unknown) => MetricSampleInput[];

/** Pure metric extractors per exercise type (SPEC §11.2 "핵심 지표(subjectKey)"). */
export const METRIC_EXTRACTORS: Readonly<Record<string, Extractor>> = {
  E0: (raw) => {
    const r = tuningResultSchema.parse(raw);
    return [m('tuning:session', 'complete', r.complete ? 1 : 0)];
  },
  E1: (raw) => {
    const r = chordCheckResultSchema.parse(raw);
    const key = `chord:${r.voicingId}`;
    const out: MetricSampleInput[] = [];
    for (const attempt of r.attempts) {
      if (r.mode === 'strum') {
        if (attempt.strumVerdict) out.push(m(key, 'strumPass', attempt.strumVerdict === 'PASS' ? 1 : 0));
        continue;
      }
      out.push(m(key, 'clean', attempt.clean ? 1 : 0));
      for (const s of attempt.perString) {
        const judged = r.mode === 'manual' ? s.selfStatus : s.status;
        if (judged === null || judged === 'WEAK' || judged === 'NOT_PLAYED' || judged === 'UNVERIFIABLE')
          continue;
        const ok = judged === 'OK' || judged === 'clean';
        out.push(m(`chordstring:${r.voicingId}:${s.idx}`, 'clean', ok ? 1 : 0));
      }
      if (attempt.selfAgreement !== null) out.push(m(key, 'selfAgreement', attempt.selfAgreement));
    }
    return out;
  },
  E2: (raw) => {
    const r = oneMinuteResultSchema.parse(raw);
    const cpm = changesPerMinute(r);
    const [from, to] = parseDirected(r.direction);
    return [m(pairDirKey(from, to), 'cpm', cpm), m(pairKey(from, to), 'cpm', cpm)];
  },
  E4: (raw) => {
    const r = anchorDrillResultSchema.parse(raw);
    const out = [m(`pair:${r.pair}`, 'drill', 1)];
    if (r.selfReportSuccess !== null) out.push(m(`pair:${r.pair}`, 'airSuccess', r.selfReportSuccess / 10));
    return out;
  },
  E5: (raw) => {
    const r = strumResultSchema.parse(raw);
    const base = `strum:${r.patternId}`;
    const out = [m(base, 'hitRate', r.hitRate), m(`${base}:${r.mode}`, 'hitRate', r.hitRate)];
    if (r.sdOffsetMs !== null) out.push(m(base, 'sdOffsetMs', r.sdOffsetMs));
    if (r.meanOffsetMs !== null) out.push(m(base, 'meanOffsetMs', r.meanOffsetMs));
    if (r.passed) {
      out.push(m(base, 'passBpm', r.bpm), m(`${base}:${r.mode}`, 'passBpm', r.bpm));
      if (r.cuesHidden) out.push(m(`${base}:hidden`, 'passBpm', r.bpm));
    }
    return out;
  },
  E6: (raw) => {
    const r = oneBeatResultSchema.parse(raw);
    const key = `onebeat:${r.progression.join('-')}`;
    const out = [m(key, 'barSuccess', r.bars > 0 ? r.barsInWindow / r.bars : 0)];
    if (r.passed) out.push(m(key, 'passBpm', r.bpm));
    return out;
  },
  E7: (raw) => {
    const r = stretchResultSchema.parse(raw);
    const out = [m('stretch', 'startFret', r.startFret)];
    if (r.pain !== null) out.push(m('stretch', 'pain', r.pain));
    return out;
  },
  E8: (raw) => {
    const r = altPickResultSchema.parse(raw);
    const key = `altpick:${r.stringIdx}`;
    const out = [m(key, 'hitRate', r.hitRate)];
    if (r.ioiCv !== null) out.push(m(key, 'ioiCv', r.ioiCv));
    if (r.passed) out.push(m(key, 'passBpm', r.bpm), m('altpick:any', 'passBpm', r.bpm));
    return out;
  },
  Q1: (raw) => {
    const r = quizResultSchema.parse(raw);
    return [m('quiz:diagram', 'accuracy', r.correct / r.questions)];
  },
  Q2: (raw) => {
    const r = recallResultSchema.parse(raw);
    return r.items.flatMap((item) => {
      const pass = item.correct && item.reactionMs !== null && item.reactionMs <= RECALL_LIMIT_MS;
      const out = [m(`recall:${item.chordClass}`, 'pass', pass ? 1 : 0)];
      if (item.reactionMs !== null) out.push(m(`recall:${item.chordClass}`, 'reactionMs', item.reactionMs));
      return out;
    });
  },
  Q3: (raw) => {
    const r = quizResultSchema.parse(raw);
    return [m('quiz:opennotes', 'accuracy', r.correct / r.questions)];
  },
  Q4: (raw) => {
    const r = quizResultSchema.parse(raw);
    const out = [m('ear:majmin', 'accuracy', r.correct / r.questions)];
    if (r.meanReactionMs !== null) out.push(m('ear:majmin', 'reactionMs', r.meanReactionMs));
    return out;
  },
  S: (raw) => {
    const r = songResultSchema.parse(raw);
    const key = `song:${r.songId}`;
    const out = [
      m(key, 'completed', r.completed ? 1 : 0),
      m(key, 'stops', r.stops),
      m(key, 'memorized', r.memorized ? 1 : 0),
    ];
    if (r.chartHidden) out.push(m(key, 'hiddenCompleted', r.completed ? 1 : 0));
    if (r.beat1HitRate !== null) out.push(m(key, 'beat1HitRate', r.beat1HitRate));
    return out;
  },
  EXAM: (raw) => {
    const r = examResultSchema.parse(raw);
    return [m(`exam:${r.item}`, 'pass', r.passed ? 1 : 0)];
  },
};

export function extractMetrics(exerciseType: string, result: unknown): MetricSampleInput[] {
  const extractor = METRIC_EXTRACTORS[exerciseType];
  if (!extractor) throw new Error(`no metric extractor for exercise type ${exerciseType}`);
  return extractor(result);
}
