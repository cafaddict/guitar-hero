/**
 * DSP worker message protocol (SPEC §8.3): discriminated unions validated with zod on the worker side.
 * Every judgement carries detectorVersion and processingMs.
 */
import { z } from 'zod';
import { voicingSchema } from '../../content/schemas';
import type { ChordVoicing } from '../../domain/voicing';
import type { PluckResult } from '../../dsp/modeA';
import type { TimingAnalysis } from '../../dsp/timing';

const strictness = z.enum(['lenient', 'normal', 'strict']);
/** zod emits `field?: T | undefined`; the domain type uses exact optional properties, so drop undefined keys. */
const workerVoicing = voicingSchema.transform(
  ({ nameKo, barres, ...rest }): ChordVoicing => ({
    ...rest,
    ...(nameKo !== undefined ? { nameKo } : {}),
    ...(barres !== undefined ? { barres } : {}),
  }),
);

export const jobSchema = z.discriminatedUnion('kind', [
  /** Onset times only (timing exercises). */
  z.object({ kind: z.literal('onsets') }),
  /** Mode A: one expected string. `silent` = x-string check. */
  z.object({
    kind: z.literal('pluck'),
    expectedF0: z.number().positive(),
    templateDecayRatio: z.number().optional(),
    strictness: strictness.default('lenient'),
    silent: z.boolean().default(false),
  }),
  /** Calibration template: one open-string pluck → harmonic profile + decay ratio (SPEC §9.1-4). */
  z.object({ kind: z.literal('template'), expectedF0: z.number().positive() }),
  /** Mode B: strum verification (beta). */
  z.object({
    kind: z.literal('strum'),
    voicing: workerVoicing,
    deltaCents: z.array(z.number()).length(6).optional(),
    strictness: strictness.default('lenient'),
  }),
  /** Mode C: one-minute change pair. */
  z.object({
    kind: z.literal('pair'),
    voicings: z.tuple([workerVoicing, workerVoicing]),
    deltaCents: z.array(z.number()).length(6).optional(),
  }),
  /** Mode C: recall quiz set. */
  z.object({
    kind: z.literal('set'),
    voicings: z.array(workerVoicing).min(2),
    deltaCents: z.array(z.number()).length(6).optional(),
  }),
]);
export type Job = z.infer<typeof jobSchema>;

export const rangeRequestSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rtt'), scheduledSamples: z.array(z.number()) }),
  z.object({ kind: z.literal('noise') }),
  z.object({ kind: z.literal('raw') }),
  /** Mode A fallback (src/dsp/take.ts energyOnset) when the flux detector found no pluck after arming. */
  z.object({
    kind: z.literal('pluck'),
    expectedF0: z.number().positive(),
    templateDecayRatio: z.number().optional(),
    strictness: strictness.default('lenient'),
    silent: z.boolean().default(false),
  }),
]);
export type RangeRequest = z.infer<typeof rangeRequestSchema>;

export const mainToWorkerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('config'), sampleRate: z.number().positive() }),
  z.object({ type: z.literal('job'), job: jobSchema.nullable() }),
  z.object({ type: z.literal('tuner'), enabled: z.boolean(), expectedF0: z.number().positive().nullable() }),
  z.object({ type: z.literal('analyzeRange'), id: z.number().int(), request: rangeRequestSchema }),
  /** Mode D: strums (context s) against the scheduled grid (SPEC §10.8). */
  z.object({
    type: z.literal('analyzeTiming'),
    id: z.number().int(),
    slots: z.array(z.object({ time: z.number(), expected: z.boolean() })),
    strumTimes: z.array(z.number()),
    rttS: z.number(),
    bpm: z.number().positive(),
    personalOffsetMs: z.number().nullable(),
  }),
]);
export type MainToWorker = z.infer<typeof mainToWorkerSchema>;

/** Result of a 'template' job: the Mode A measurement plus |H_h| / |H_1| for h = 1..8 over [+30, +130 ms]. */
/** Result of a 'pluck' range request: the fallback onset (offset in the range) and its Mode A judgement. */
export interface PluckFallbackResult {
  onsetOffset: number;
  pluck: PluckResult;
}

export interface TemplateResult {
  pluck: PluckResult;
  harmonics: number[];
}

export interface OnsetMessage {
  type: 'onset';
  /** Absolute capture sample of the refined (first-string) onset. */
  sample: number;
  strength: number;
  /** Job-specific judgement for this onset (null for 'onsets' jobs). */
  result: unknown;
  jobKind: Job['kind'] | null;
  detectorVersion: string;
  processingMs: number;
}

export interface TunerMessage {
  type: 'tuner';
  endSample: number;
  reading: { f0: number; midi: number; cents: number; clarity: number } | null;
  stableF0: number | null;
}

export interface RangeResultMessage {
  type: 'rangeResult';
  id: number;
  result: unknown;
  /** Raw samples, only for 'raw' requests (transferred). */
  samples?: Float32Array;
  detectorVersion: string;
  processingMs: number;
}

export interface TimingResultMessage {
  type: 'timingResult';
  id: number;
  result: TimingAnalysis;
  detectorVersion: string;
  processingMs: number;
}

export type WorkerToMain =
  | OnsetMessage
  | TunerMessage
  | RangeResultMessage
  | TimingResultMessage
  | { type: 'error'; message: string };
