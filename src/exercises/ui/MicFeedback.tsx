/**
 * Practice-screen microphone feedback (SPEC v1.1 §12.1, research 03:93–94): a live level meter with the
 * calibrated noise floor and the minimum level a judgement needs, and the confidence of the latest judgement
 * (확실 / 아마도 / 불확실; strum checks are beta and say "참고(베타)").
 */
import { useEffect, useMemo, useState } from 'react';
import { audioEngine } from '../../app/services';
import { ko } from '../../i18n/ko';
import { LevelMeter } from '../../ui/LevelMeter';
import type { ExerciseContext, JudgedEvent } from '../types';

/** Mode A WEAK threshold: noise + 10 dB (SPEC §10.5-3). */
export const JUDGE_MIN_ABOVE_NOISE_DB = 10;
const readLevel = () => audioEngine.latestLevel;

export type ConfidenceLabel = 'sure' | 'likely' | 'unsure' | 'beta';

/** Label of a judged event, or null when it carries no verdict (plain onsets, a strum timing). */
export function confidenceLabel(event: Pick<JudgedEvent, 'jobKind' | 'result'>): ConfidenceLabel | null {
  if (event.jobKind === 'strum') return 'beta';
  const confidence = (event.result as { confidence?: unknown } | null)?.confidence;
  if (typeof confidence !== 'number') return null;
  return confidence >= 0.8 ? 'sure' : confidence >= 0.5 ? 'likely' : 'unsure';
}

export function MicFeedback({ ctx }: { ctx: ExerciseContext }) {
  const [label, setLabel] = useState<ConfidenceLabel | null>(null);
  useEffect(() => {
    if (!ctx.audio) return;
    return ctx.audio.onJudged((event) => {
      const next = confidenceLabel(event);
      if (next) setLabel(next);
    });
  }, [ctx.audio]);
  const noise = ctx.calibration?.noiseFloorDbfs;
  const lines = useMemo(
    () =>
      noise === undefined
        ? []
        : [
            { db: noise, label: ko.micFeedback.noiseFloor, tone: 'muted' as const },
            { db: noise + JUDGE_MIN_ABOVE_NOISE_DB, label: ko.micFeedback.minLevel, tone: 'info' as const },
          ],
    [noise],
  );
  if (!ctx.audio) return null;
  return (
    <section className="mt-4 flex flex-col gap-1.5 rounded-xl bg-surface p-3" data-testid="mic-feedback">
      <LevelMeter read={readLevel} label={ko.diagnostics.level} lines={lines} />
      <p aria-live="polite" className="text-sm" data-testid="judge-confidence" data-confidence={label ?? ''}>
        {label ? ko.micFeedback.confidence[label] : ko.micFeedback.waiting}
      </p>
    </section>
  );
}
