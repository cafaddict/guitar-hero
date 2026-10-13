/**
 * Shared DSP result vocabulary (SPEC §10.1).
 */
export type StringStatus =
  | 'OK'
  | 'MUTED'
  | 'WRONG_NOTE'
  | 'UNEXPECTED'
  | 'WEAK'
  | 'UNVERIFIABLE'
  | 'NOT_PLAYED';
export type Verdict = 'PASS' | 'FAIL' | 'RETRY';
export type RetryReason =
  | 'LOW_LEVEL'
  | 'CLIPPING'
  | 'NOISY'
  | 'AMBIGUOUS'
  | 'NO_ONSET'
  | 'MULTIPLE_ONSETS'
  | 'DETUNED'
  /** The take is not a string sound (e.g. a knock on the guitar body, D-073). */
  | 'NOT_STRING';
export type Strictness = 'lenient' | 'normal' | 'strict';
/** How readily a quiet or non-string sound is taken as a pluck (settings "판정 감도", D-075). */
export type Sensitivity = 'low' | 'normal' | 'high';

export interface DspResultBase {
  detectorVersion: string;
  /** 0..1 */
  confidence: number;
  reasons: RetryReason[];
  processingMs: number;
}

export const CLIP_LEVEL = 0.98;
