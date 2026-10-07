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
  | 'DETUNED';
export type Strictness = 'lenient' | 'normal' | 'strict';

export interface DspResultBase {
  detectorVersion: string;
  /** 0..1 */
  confidence: number;
  reasons: RetryReason[];
  processingMs: number;
}

export const CLIP_LEVEL = 0.98;
