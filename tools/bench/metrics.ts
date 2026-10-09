/**
 * Metric definitions (SPEC §14.3 "지표 정의", fixed) and threshold judgement against thresholds.json.
 * Keys ending in "Max" pass when value ≤ threshold, "Min" when value ≥ threshold.
 */

import { BETA_METRICS } from './betaBench';
import type {
  Dims,
  Outcome,
  OutcomeA,
  OutcomeB,
  OutcomeC,
  OutcomeCSet,
  OutcomeD,
  OutcomeRtt,
  OutcomeTuner,
} from './evaluate';
import { BACKING_BLEED_METRICS, modeCSetStage8Metrics, SWING_METRICS, sequenceMetrics } from './metricsV11';
import type { Thresholds } from './thresholds';

export interface MetricResult {
  area: string;
  key: string;
  value: number;
  threshold: number;
  pass: boolean;
  n: number;
}

export interface Breakdown {
  area: string;
  key: string;
  dim: keyof Dims;
  rows: { value: string; metric: number; n: number }[];
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : Number.NaN);

function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

const confirmedNegative = (o: OutcomeA) =>
  ['MUTED', 'WRONG_NOTE', 'UNEXPECTED'].includes(o.status) || o.verdict === 'FAIL';
const isRetry = (o: OutcomeA) => o.verdict === 'RETRY';
const isWrong = (o: OutcomeA) => o.dims.condition.startsWith('wrong');

type MetricFn<T> = (items: T[]) => { value: number; n: number };

export const MODE_A_METRICS: Record<string, MetricFn<OutcomeA>> = {
  okFalseRejectMax: (xs) => {
    const s = xs.filter((o) => o.dims.condition === 'ok');
    return { value: ratio(s.filter(confirmedNegative).length, s.length), n: s.length };
  },
  okRetryMax: (xs) => {
    const s = xs.filter((o) => o.dims.condition === 'ok');
    return { value: ratio(s.filter(isRetry).length, s.length), n: s.length };
  },
  wrongNoteFalseAcceptMax: (xs) => {
    const s = xs.filter(isWrong);
    return { value: ratio(s.filter((o) => o.status === 'OK').length, s.length), n: s.length };
  },
  mutedFalseAcceptMax: (xs) => {
    const s = xs.filter((o) => o.dims.condition === 'muted');
    return { value: ratio(s.filter((o) => o.status === 'OK').length, s.length), n: s.length };
  },
  weakFundamentalOkMin: (xs) => {
    const s = xs.filter((o) => o.dims.condition === 'weak-fundamental');
    return { value: ratio(s.filter((o) => o.status === 'OK').length, s.length), n: s.length };
  },
  mutedDetectRateMin: (xs) => {
    const s = xs.filter((o) => o.dims.condition === 'muted');
    return { value: ratio(s.filter((o) => o.status === 'MUTED').length, s.length), n: s.length };
  },
  wrongNoteDetectRateMin: (xs) => {
    const s = xs.filter(isWrong);
    return {
      value: ratio(
        s.filter((o) => o.status === 'WRONG_NOTE' && o.semitones === o.semitonesExpected).length,
        s.length,
      ),
      n: s.length,
    };
  },
};

function modeBMetrics(minSnr: number): Record<string, MetricFn<OutcomeB>> {
  const strata = (xs: OutcomeB[], condition: string) =>
    xs.filter((o) => o.dims.condition === condition && o.dims.snrDb >= minSnr);
  return {
    cleanFailMax: (xs) => {
      const s = xs.filter((o) => o.dims.condition === 'clean');
      return { value: ratio(s.filter((o) => o.verdict === 'FAIL').length, s.length), n: s.length };
    },
    cleanRetryMax: (xs) => {
      const s = strata(xs, 'clean');
      return { value: ratio(s.filter((o) => o.verdict === 'RETRY').length, s.length), n: s.length };
    },
    verifiableMutedPassMax: (xs) => {
      const s = strata(xs, 'verifiable-muted');
      return { value: ratio(s.filter((o) => o.verdict === 'PASS').length, s.length), n: s.length };
    },
    verifiableMutedCorrectFlagMin: (xs) => {
      const s = strata(xs, 'verifiable-muted');
      return {
        value: ratio(
          s.filter((o) => o.verdict === 'FAIL' && o.blamed.length === 1 && o.blamed[0] === o.targetIdx)
            .length,
          s.length,
        ),
        n: s.length,
      };
    },
    xStringRingingUnexpectedFailMin: (xs) => {
      const s = strata(xs, 'x-string-ringing');
      return {
        value: ratio(
          s.filter(
            (o) => o.verdict === 'FAIL' && o.targetIdx !== null && o.unexpectedIdx.includes(o.targetIdx),
          ).length,
          s.length,
        ),
        n: s.length,
      };
    },
    xStringRingingPassMax: (xs) => {
      const s = strata(xs, 'x-string-ringing');
      return { value: ratio(s.filter((o) => o.verdict === 'PASS').length, s.length), n: s.length };
    },
    wrongFretVerifiablePassMax: (xs) => {
      const s = strata(xs, 'wrong-fret-verifiable');
      return { value: ratio(s.filter((o) => o.verdict === 'PASS').length, s.length), n: s.length };
    },
    dependentMutedMisattributionMax: (xs) => {
      const s = strata(xs, 'dependent-muted');
      return {
        value: ratio(
          s.filter((o) => o.verdict === 'FAIL' && o.blamed.some((b) => b !== o.targetIdx)).length,
          s.length,
        ),
        n: s.length,
      };
    },
  };
}

export const MODE_C_METRICS: Record<string, MetricFn<OutcomeC>> = {
  absErrLe1RateMin: (xs) => ({
    value: ratio(xs.filter((o) => Math.abs(o.counted - o.truth) <= 1).length, xs.length),
    n: xs.length,
  }),
  overcountGe2RateMax: (xs) => ({
    value: ratio(xs.filter((o) => o.counted - o.truth >= 2).length, xs.length),
    n: xs.length,
  }),
  meanAbsErrMax: (xs) => ({
    value: xs.length ? xs.reduce((s, o) => s + Math.abs(o.counted - o.truth), 0) / xs.length : Number.NaN,
    n: xs.length,
  }),
};

function modeCSetMetrics(minSnr: number): Record<string, MetricFn<OutcomeCSet>> {
  return {
    top1AccuracyMin: (xs) => {
      const s = xs.filter((o) => o.dims.snrDb >= minSnr);
      return { value: ratio(s.filter((o) => o.correct).length, s.length), n: s.length };
    },
  };
}

export const MODE_D_METRICS: Record<string, MetricFn<OutcomeD>> = {
  onsetF1At25msMin: (xs) => {
    const s = xs.filter((o) => o.kind === 'pattern');
    const tp = s.reduce((a, o) => a + o.matched25, 0);
    const det = s.reduce((a, o) => a + o.detectedCount, 0);
    const tru = s.reduce((a, o) => a + o.truthCount, 0);
    const p = ratio(tp, det);
    const r = ratio(tp, tru);
    return { value: p + r > 0 ? (2 * p * r) / (p + r) : 0, n: tru };
  },
  timingAbsErrP95MsMax: (xs) => {
    const errs = xs.filter((o) => o.kind === 'pattern').flatMap((o) => o.absErrorsMs);
    return { value: percentile(errs, 0.95), n: errs.length };
  },
  timingAbsErrMedianMsMax: (xs) => {
    const errs = xs.filter((o) => o.kind === 'pattern').flatMap((o) => o.absErrorsMs);
    return { value: percentile(errs, 0.5), n: errs.length };
  },
  sustainFalseOnsetRateMax: (xs) => {
    const s = xs.filter((o) => o.kind === 'sustain');
    return { value: ratio(s.filter((o) => o.falseOnsets > 0).length, s.length), n: s.length };
  },
  clickBleedRejectRateMin: (xs) => {
    const iso = xs.reduce((a, o) => a + o.isolatedClicks, 0);
    const det = xs.reduce((a, o) => a + o.clicksDetected, 0);
    return { value: iso > 0 ? 1 - det / iso : Number.NaN, n: iso };
  },
  patternMissExtraAccuracyMin: (xs) => {
    const s = xs.filter((o) => o.kind === 'pattern');
    return {
      value: ratio(
        s.reduce((a, o) => a + o.slotAgree, 0),
        s.reduce((a, o) => a + o.slotTotal, 0),
      ),
      n: s.reduce((a, o) => a + o.slotTotal, 0),
    };
  },
};

const absOrInf = (o: OutcomeTuner) =>
  o.errorCents === null ? Number.POSITIVE_INFINITY : Math.abs(o.errorCents);

function tunerMetrics(minSnr: number): Record<string, MetricFn<OutcomeTuner>> {
  const judged = (xs: OutcomeTuner[]) => xs.filter((o) => o.dims.snrDb >= minSnr);
  return {
    medianAbsCentsMax: (xs) => ({ value: percentile(judged(xs).map(absOrInf), 0.5), n: judged(xs).length }),
    p95AbsCentsMax: (xs) => ({ value: percentile(judged(xs).map(absOrInf), 0.95), n: judged(xs).length }),
    octaveErrorRateMax: (xs) => ({
      value: ratio(judged(xs).filter((o) => o.octaveError).length, judged(xs).length),
      n: judged(xs).length,
    }),
    timeToStableMsP95Max: (xs) => ({
      value: percentile(
        judged(xs).map((o) => o.timeToStableMs ?? Number.POSITIVE_INFINITY),
        0.95,
      ),
      n: judged(xs).length,
    }),
  };
}

export const RTT_METRICS: Record<string, MetricFn<OutcomeRtt>> = {
  absErrP95MsMax: (xs) => {
    const s = xs.filter((o) => o.hasSignal);
    return {
      value: percentile(
        s.map((o) => (o.errorMs === null ? Number.POSITIVE_INFINITY : Math.abs(o.errorMs))),
        0.95,
      ),
      n: s.length,
    };
  },
  silentFailureReportRateMin: (xs) => {
    const s = xs.filter((o) => !o.hasSignal);
    return { value: ratio(s.filter((o) => !o.ok).length, s.length), n: s.length };
  },
};

export function judge(key: string, value: number, threshold: number): boolean {
  if (Number.isNaN(value)) return false;
  if (key.endsWith('Max')) return value <= threshold;
  if (key.endsWith('Min')) return value >= threshold;
  throw new Error(`metric key ${key} must end with Max or Min`);
}

function apply<T>(
  area: string,
  fns: Record<string, MetricFn<T>>,
  items: T[],
  thresholds: Record<string, number>,
): MetricResult[] {
  return Object.entries(fns).map(([key, fn]) => {
    const threshold = thresholds[key];
    if (threshold === undefined) throw new Error(`no threshold for ${area}.${key}`);
    const { value, n } = fn(items);
    return { area, key, value, threshold, pass: judge(key, value, threshold), n };
  });
}

function breakdown<T extends { dims: Dims }>(
  area: string,
  fns: Record<string, MetricFn<T>>,
  items: T[],
  dimsList: (keyof Dims)[],
): Breakdown[] {
  const out: Breakdown[] = [];
  for (const [key, fn] of Object.entries(fns)) {
    for (const dim of dimsList) {
      const groups = new Map<string, T[]>();
      for (const item of items) {
        const v = String(item.dims[dim]);
        groups.set(v, [...(groups.get(v) ?? []), item]);
      }
      const rows = [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
        .map(([value, group]) => {
          const r = fn(group);
          return { value, metric: r.value, n: r.n };
        })
        .filter((r) => r.n > 0);
      out.push({ area, key, dim, rows });
    }
  }
  return out;
}

export interface Evaluation {
  metrics: MetricResult[];
  /** Report-only beta metrics (thresholds.beta.targets): never part of the pass/fail decision. */
  betaMetrics: MetricResult[];
  breakdowns: Breakdown[];
}

/** Metric keys judged per area (parameter keys such as detectionStrataSnrDbMin are excluded). */
/** Performance metrics measured by run.ts (sequential timing on this machine). */
export const PERF_KEYS = [
  'verifyStrumMedianMsMax',
  'verifyPluckMedianMsMax',
  'workletBlockAvgMsMax',
] as const;

/** Keys in thresholds.synthetic that are parameters (strata limits), not judged metrics. */
export const PARAMETER_KEYS: Readonly<Record<string, readonly string[]>> = {
  modeB: ['detectionStrataSnrDbMin'],
  modeCSet: ['snrDbMin'],
  coverage: ['modeBVerifiableRatioMustBeAtLeastDefaultRule'],
  sequence: ['flawlessGateSnrDbMin'],
  modeCSetStage8to11: ['snrDbMin'],
};

export const JUDGED_KEYS = {
  perf: [...PERF_KEYS],
  modeA: Object.keys(MODE_A_METRICS),
  modeB: Object.keys(modeBMetrics(0)),
  modeC: Object.keys(MODE_C_METRICS),
  modeCSet: Object.keys(modeCSetMetrics(0)),
  modeD: Object.keys(MODE_D_METRICS),
  tuner: Object.keys(tunerMetrics(0)),
  rtt: Object.keys(RTT_METRICS),
  sequence: Object.keys(sequenceMetrics(0, 0)),
  modeCSetStage8to11: Object.keys(modeCSetStage8Metrics(0)),
  swing: Object.keys(SWING_METRICS),
  backingBleed: Object.keys(BACKING_BLEED_METRICS),
};

export function evaluateOutcomes(outcomes: readonly Outcome[], t: Thresholds): Evaluation {
  const by = <M extends Outcome['mode']>(mode: M) =>
    outcomes.filter((o): o is Extract<Outcome, { mode: M }> => o.mode === mode);
  const s = t.synthetic;
  const a = by('A');
  const b = by('B');
  const c = by('C');
  const cs = by('Cset');
  const d = by('D');
  const tu = by('tuner');
  const r = by('rtt');
  const seq = by('seq');
  const cs8 = by('Cset8');
  const sw = by('swing');
  const bl = by('bleed');
  const be = by('beta');
  const modeCSet8 = modeCSetStage8Metrics(s.modeCSetStage8to11.snrDbMin!);
  const sequence = sequenceMetrics(
    t.matrix.sequence.flawlessGateMaxCycleNotes,
    s.sequence.flawlessGateSnrDbMin!,
  );
  const modeB = modeBMetrics(s.modeB.detectionStrataSnrDbMin!);
  const modeCSet = modeCSetMetrics(s.modeCSet.snrDbMin!);
  const tuner = tunerMetrics(t.matrix.tuner.snrDbMin);
  const metrics: MetricResult[] = [];
  if (a.length) metrics.push(...apply('modeA', MODE_A_METRICS, a, s.modeA));
  if (b.length) metrics.push(...apply('modeB', modeB, b, s.modeB));
  if (c.length) metrics.push(...apply('modeC', MODE_C_METRICS, c, s.modeC));
  if (cs.length) metrics.push(...apply('modeCSet', modeCSet, cs, s.modeCSet));
  if (d.length) metrics.push(...apply('modeD', MODE_D_METRICS, d, s.modeD));
  if (tu.length) metrics.push(...apply('tuner', tuner, tu, s.tuner));
  if (r.length) metrics.push(...apply('rtt', RTT_METRICS, r, s.rtt));
  if (seq.length) metrics.push(...apply('sequence', sequence, seq, s.sequence));
  if (cs8.length) metrics.push(...apply('modeCSetStage8to11', modeCSet8, cs8, s.modeCSetStage8to11));
  if (sw.length) metrics.push(...apply('swing', SWING_METRICS, sw, s.swing));
  if (bl.length) metrics.push(...apply('backingBleed', BACKING_BLEED_METRICS, bl, s.backingBleed));
  const dims: (keyof Dims)[] = ['snrDb', 'micHighpassHz', 'model', 'sampleRate', 'reverb', 'voicing'];
  const breakdowns = [
    ...breakdown('modeA', MODE_A_METRICS, a, dims),
    ...breakdown('modeB', modeB, b, dims),
    ...breakdown(
      'modeC',
      MODE_C_METRICS,
      c,
      dims.filter((x) => x !== 'voicing'),
    ),
    ...breakdown('modeCSet', modeCSet, cs, dims),
    ...breakdown('modeD', MODE_D_METRICS, d, [...dims.filter((x) => x !== 'voicing'), 'condition']),
    ...breakdown('tuner', tuner, tu, dims),
    ...breakdown('rtt', RTT_METRICS, r, ['snrDb', 'micHighpassHz', 'sampleRate', 'reverb']),
    ...breakdown('sequence', sequence, seq, dims),
    ...breakdown('modeCSetStage8to11', modeCSet8, cs8, [...dims, 'condition']),
    ...breakdown('swing', SWING_METRICS, sw, [...dims.filter((x) => x !== 'voicing'), 'condition']),
    ...breakdown('backingBleed', BACKING_BLEED_METRICS, bl, [...dims, 'condition']),
  ];
  const betaMetrics = be.length ? apply('beta', BETA_METRICS, be, t.beta.targets) : [];
  return { metrics, betaMetrics, breakdowns };
}

/** Exit code of `bench:dsp`: only the hard metrics of the test split decide (beta never does, integrity 10). */
export function benchExitCode(
  split: 'dev' | 'test',
  hard: readonly MetricResult[],
  _beta: readonly MetricResult[],
): 0 | 1 {
  return split === 'test' && hard.some((m) => !m.pass) ? 1 : 0;
}
