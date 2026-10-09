/**
 * v1.1 metric definitions (SPEC v1.1 §14.8, fixed). Same conventions as metrics.ts: "Max" keys pass when
 * value ≤ threshold, "Min" keys when value ≥ threshold.
 */
import type { OutcomeBleed, OutcomeCSet8, OutcomeSeq, OutcomeSwing } from './evaluateV11';

export type MetricFn<T> = (items: T[]) => { value: number; n: number };

const ratio = (num: number, den: number) => (den > 0 ? num / den : Number.NaN);

export function f1(tp: number, detected: number, truth: number): number {
  const p = ratio(tp, detected);
  const r = ratio(tp, truth);
  return p + r > 0 ? (2 * p * r) / (p + r) : 0;
}

/**
 * Sequence metrics. `gateNotes` = matrix.sequence.flawlessGateMaxCycleNotes and `gateSnr` =
 * synthetic.sequence.flawlessGateSnrDbMin: the flawless gate is judged on clean cycles of ≤ gateNotes notes at
 * SNR ≥ gateSnr, the uncertain rate on all clean cycles at SNR ≥ gateSnr (other strata are reported only).
 */
export function sequenceMetrics(gateNotes: number, gateSnr: number): Record<string, MetricFn<OutcomeSeq>> {
  const clean = (xs: OutcomeSeq[]) => xs.filter((o) => o.dims.condition === 'clean');
  const defect = (xs: OutcomeSeq[], ...conditions: string[]) =>
    xs.filter((o) => conditions.includes(o.dims.condition));
  const detectRate = (s: OutcomeSeq[]) => ({
    value: ratio(s.filter((o) => o.defectDetected === true).length, s.length),
    n: s.length,
  });
  return {
    noteOnsetF1At30msMin: (xs) => {
      const s = clean(xs);
      const sum = (f: (o: OutcomeSeq) => number) => s.reduce((a, o) => a + f(o), 0);
      return {
        value: f1(
          sum((o) => o.matchedOnsets),
          sum((o) => o.detectedOnsets),
          sum((o) => o.truthOnsets),
        ),
        n: sum((o) => o.truthOnsets),
      };
    },
    cleanNoteOkRateMin: (xs) => {
      const s = clean(xs);
      const notes = s.reduce((a, o) => a + o.noteCount, 0);
      return {
        value: ratio(
          s.reduce((a, o) => a + o.okNotes, 0),
          notes,
        ),
        n: notes,
      };
    },
    wrongNoteDetectRateMin: (xs) => detectRate(defect(xs, 'wrong+1', 'wrong-1')),
    missedDetectRateMin: (xs) => detectRate(defect(xs, 'missed')),
    extraDetectRateMin: (xs) => detectRate(defect(xs, 'extra')),
    faultyCycleFlawlessRateMax: (xs) => {
      const s = xs.filter((o) => o.dims.condition !== 'clean');
      return { value: ratio(s.filter((o) => o.flawless).length, s.length), n: s.length };
    },
    cleanCycleFlawlessRateMin: (xs) => {
      const s = clean(xs).filter((o) => o.noteCount <= gateNotes && o.dims.snrDb >= gateSnr);
      return { value: ratio(s.filter((o) => o.flawless).length, s.length), n: s.length };
    },
    cleanCycleUncertainRateMax: (xs) => {
      const s = clean(xs).filter((o) => o.dims.snrDb >= gateSnr);
      return { value: ratio(s.filter((o) => o.uncertain).length, s.length), n: s.length };
    },
  };
}

/** Stage 8–11 closed-set top-1 accuracy at SNR ≥ `minSnr` (§14.8). */
export function modeCSetStage8Metrics(minSnr: number): Record<string, MetricFn<OutcomeCSet8>> {
  return {
    top1AccuracyMin: (xs) => {
      const s = xs.filter((o) => o.dims.snrDb >= minSnr);
      return { value: ratio(s.filter((o) => o.correct).length, s.length), n: s.length };
    },
  };
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

/** Swing (§14.8): F1 and |error| p95 as in v1 Mode D; slot accuracy over every synthesized strum. */
export const SWING_METRICS: Record<string, MetricFn<OutcomeSwing>> = {
  onsetF1At25msMin: (xs) => {
    const sum = (f: (o: OutcomeSwing) => number) => xs.reduce((a, o) => a + f(o), 0);
    return {
      value: f1(
        sum((o) => o.matched25),
        sum((o) => o.detectedCount),
        sum((o) => o.truthCount),
      ),
      n: sum((o) => o.truthCount),
    };
  },
  timingAbsErrP95MsMax: (xs) => {
    const errs = xs.flatMap((o) => o.absErrorsMs);
    return { value: percentile(errs, 0.95), n: errs.length };
  },
  slotAssignmentAccuracyMin: (xs) => {
    const truth = xs.reduce((a, o) => a + o.truthCount, 0);
    return {
      value: ratio(
        xs.reduce((a, o) => a + o.slotCorrect, 0),
        truth,
      ),
      n: truth,
    };
  },
};

/** Backing bleed (§14.8): user-strum F1 (truth = user strums only) and backing events counted as strums. */
export const BACKING_BLEED_METRICS: Record<string, MetricFn<OutcomeBleed>> = {
  strumOnsetF1At25msMin: (xs) => {
    const sum = (f: (o: OutcomeBleed) => number) => xs.reduce((a, o) => a + f(o), 0);
    return {
      value: f1(
        sum((o) => o.matched25),
        sum((o) => o.detectedCount),
        sum((o) => o.truthCount),
      ),
      n: sum((o) => o.truthCount),
    };
  },
  backingHitFalseStrumRateMax: (xs) => {
    const iso = xs.reduce((a, o) => a + o.isolatedBacking, 0);
    return {
      value: ratio(
        xs.reduce((a, o) => a + o.backingCounted, 0),
        iso,
      ),
      n: iso,
    };
  },
};
