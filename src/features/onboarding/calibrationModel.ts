/**
 * Calibration wizard rules (SPEC §9.1) as pure functions: tuning verdicts, sample-rate sanity, template
 * aggregation, loopback RTT agreement, warnings and the persisted Calibration record.
 */
import type { CaptureDiagnostics } from '../../audio/devices';
import { isBluetoothLabel } from '../../audio/devices';
import type { Calibration } from '../../domain/records';
import { STRING_COUNT } from '../../domain/strings';
import { applyCents, centsBetween, midiToHz, STANDARD_TUNING } from '../../domain/theory';

export const TUNING_PASS_CENTS = 15;
export const NOISE_WARN_DBFS = -45;
export const NOISE_CHECK_S = 2;
export const TEMPLATE_PLUCKS = 3;
export const RTT_AGREE_MS = 3;
export const RTT_MAX_ATTEMPTS = 3;
export const SAMPLE_RATE_TOLERANCE = 0.01;

export type WarningCode =
  | 'NOISY'
  | 'PROCESSING_ON'
  | 'BLUETOOTH_INPUT'
  | 'BLUETOOTH_OUTPUT'
  | 'SAMPLE_RATE_SUSPECT'
  | 'RTT_TAP';

/** Open-string frequency, optionally shifted by the calibrated δ (cents). idx 0 = 6th string. */
export function openStringHz(idx: number, deltaCents = 0): number {
  const midi = STANDARD_TUNING.openMidi[idx];
  if (midi === undefined) throw new Error(`no string ${idx}`);
  return applyCents(midiToHz(midi), deltaCents);
}

export type TuningVerdict =
  | { kind: 'pass'; cents: number }
  | { kind: 'tooLow'; cents: number }
  | { kind: 'tooHigh'; cents: number }
  | { kind: 'otherNote'; cents: number };

/** |δ| ≤ 15 cents passes; within a semitone the user is told which way to turn; beyond: another note. */
export function judgeTuning(stableF0: number, expectedHz: number): TuningVerdict {
  const cents = centsBetween(stableF0, expectedHz);
  if (Math.abs(cents) <= TUNING_PASS_CENTS) return { kind: 'pass', cents };
  if (Math.abs(cents) > 100) return { kind: 'otherNote', cents };
  return cents < 0 ? { kind: 'tooLow', cents } : { kind: 'tooHigh', cents };
}

/**
 * Sample-rate sanity (SPEC §9.1-3): the first stable reading of every string is compared with its expected
 * frequency. A *uniform* ratio outside ±1% across ≥ 3 strings is the signature of a sample-rate mismatch
 * (or a guitar tuned to another reference) and is recorded as a warning; scattered offsets are just tuning.
 */
export function sampleRateSuspect(
  firstReadings: readonly { measuredHz: number; expectedHz: number }[],
): boolean {
  if (firstReadings.length < 3) return false;
  const ratios = firstReadings.map((r) => r.measuredHz / r.expectedHz).sort((a, b) => a - b);
  const median = ratios[ratios.length >> 1]!;
  const uniform = ratios.every((r) => Math.abs(r / median - 1) <= SAMPLE_RATE_TOLERANCE / 2);
  return uniform && Math.abs(median - 1) > SAMPLE_RATE_TOLERANCE;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : 0.5 * (sorted[mid - 1]! + sorted[mid]!);
}

export interface TemplateSample {
  harmonics: readonly number[];
  decayRatio: number | null;
}

/** Per-string template: per-harmonic median magnitude and median decay ratio of the accepted plucks. */
export function aggregateTemplate(
  samples: readonly TemplateSample[],
): { harmonics: number[]; decayRatio: number } | null {
  const usable = samples.filter(
    (s): s is TemplateSample & { decayRatio: number } =>
      s.decayRatio !== null && Number.isFinite(s.decayRatio),
  );
  if (usable.length === 0) return null;
  const count = Math.min(...usable.map((s) => s.harmonics.length));
  const harmonics = Array.from({ length: count }, (_, h) => median(usable.map((s) => s.harmonics[h]!)));
  return { harmonics, decayRatio: median(usable.map((s) => s.decayRatio)) };
}

export type LoopbackMeasurement = { ok: true; rttMs: number; madMs: number } | { ok: false; reason: string };

export type LoopbackDecision =
  | { kind: 'done'; rttMs: number; madMs: number; agreeing: [number, number] }
  | { kind: 'again' }
  | { kind: 'fallback'; reason: 'NO_SIGNAL' | 'INCONSISTENT' };

/**
 * Loopback RTT is accepted when two consecutive measurements succeed and agree within 3 ms (their mean is
 * stored). Two failures or no agreement within three attempts → tap calibration fallback.
 */
export function decideLoopback(measurements: readonly LoopbackMeasurement[]): LoopbackDecision {
  const last = measurements.at(-1);
  const prev = measurements.at(-2);
  if (last?.ok && prev?.ok && Math.abs(last.rttMs - prev.rttMs) <= RTT_AGREE_MS) {
    return {
      kind: 'done',
      rttMs: (last.rttMs + prev.rttMs) / 2,
      madMs: Math.max(last.madMs, prev.madMs),
      agreeing: [prev.rttMs, last.rttMs],
    };
  }
  const failures = measurements.filter((m) => !m.ok).length;
  if (failures >= 2) return { kind: 'fallback', reason: 'NO_SIGNAL' };
  if (measurements.length >= RTT_MAX_ATTEMPTS) return { kind: 'fallback', reason: 'INCONSISTENT' };
  return { kind: 'again' };
}

export interface CalibrationDraft {
  id: string;
  createdAt: number;
  diagnostics: CaptureDiagnostics;
  outputDeviceLabel: string;
  noise: { noiseDbfs: number; thirdOctaveDb: number[] };
  tuningCents: (number | null)[];
  firstReadings: { measuredHz: number; expectedHz: number }[];
  templates: ({ harmonics: number[]; decayRatio: number } | null)[];
  rtt: { rttMs: number; madMs: number; method: 'loopback' | 'tap' };
}

export function calibrationWarnings(draft: Omit<CalibrationDraft, 'id' | 'createdAt'>): WarningCode[] {
  const warnings: WarningCode[] = [];
  if (draft.noise.noiseDbfs > NOISE_WARN_DBFS) warnings.push('NOISY');
  if (draft.diagnostics.processingOn.length > 0) warnings.push('PROCESSING_ON');
  if (draft.diagnostics.bluetooth) warnings.push('BLUETOOTH_INPUT');
  if (isBluetoothLabel(draft.outputDeviceLabel)) warnings.push('BLUETOOTH_OUTPUT');
  if (sampleRateSuspect(draft.firstReadings)) warnings.push('SAMPLE_RATE_SUSPECT');
  if (draft.rtt.method === 'tap') warnings.push('RTT_TAP');
  return warnings;
}

/** Completed draft → persisted record. Every string must have a tuning δ and a template. */
export function buildCalibration(draft: CalibrationDraft): Calibration {
  if (draft.tuningCents.length !== STRING_COUNT || draft.tuningCents.some((c) => c === null))
    throw new Error('tuning incomplete');
  if (draft.templates.length !== STRING_COUNT || draft.templates.some((t) => t === null))
    throw new Error('templates incomplete');
  const d = draft.diagnostics;
  return {
    id: draft.id,
    createdAt: draft.createdAt,
    inputDeviceLabel: d.label,
    outputDeviceLabel: draft.outputDeviceLabel,
    sampleRate: d.contextSampleRate,
    trackSettings: {
      ...d.settings,
      processingOn: d.processingOn,
      baseLatencyMs: d.baseLatencyMs,
      outputLatencyMs: d.outputLatencyMs,
    },
    noiseFloorDbfs: draft.noise.noiseDbfs,
    noiseThirdOctaveDb: draft.noise.thirdOctaveDb,
    tuningCents: draft.tuningCents as number[],
    stringTemplates: draft.templates as { harmonics: number[]; decayRatio: number }[],
    rttMs: draft.rtt.rttMs,
    rttMethod: draft.rtt.method,
    rttMadMs: draft.rtt.madMs,
    warnings: calibrationWarnings(draft),
  };
}
