/**
 * SPEC §14.6 rule 2: the benchmark generator covers every thresholds.json matrix value, uses the split seed
 * ranges verbatim, meets the minimum sample sizes, and judges with the thresholds object loaded from the file.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { nameToMidi } from '../../src/domain/theory';
import { DEFAULT_COLLISION_PARAMS } from '../../src/domain/voicing';
import { MODE_B_COLLISION_PARAMS } from '../../src/dsp/modeB';
import { buildCases, type CaseSet } from '../../tools/bench/cases';
import type { Outcome } from '../../tools/bench/evaluate';
import { evaluateOutcomes, JUDGED_KEYS, PARAMETER_KEYS } from '../../tools/bench/metrics';
import { loadThresholds, THRESHOLDS_PATH } from '../../tools/bench/thresholds';

const raw = JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8'));
const t = loadThresholds();
const test: CaseSet = buildCases(t, 'test');
const dev: CaseSet = buildCases(t, 'dev');

function coversRange(
  values: readonly number[],
  [min, max]: readonly [number, number],
  fraction: number,
  log = false,
): boolean {
  const f = (x: number) => (log ? Math.log(x) : x);
  const span = f(max) - f(min);
  const low = values.some((v) => f(v) - f(min) <= fraction * span && v >= min);
  const high = values.some((v) => f(max) - f(v) <= fraction * span && v <= max);
  const inside = values.every((v) => v >= min - 1e-9 && v <= max + 1e-9);
  return low && high && inside;
}

describe('§14.6-2 thresholds are the frozen file', () => {
  it('loadThresholds() returns the file content unchanged', () => {
    expect(t).toEqual(raw);
  });

  it('every threshold in the file is judged, and every judged key is in the file (both directions)', () => {
    const areas = new Set([...Object.keys(raw.synthetic), ...Object.keys(JUDGED_KEYS)]);
    for (const area of areas) {
      const fileKeys = Object.keys(raw.synthetic[area] ?? {}).filter(
        (k) => !(PARAMETER_KEYS[area] ?? []).includes(k),
      );
      const judged = (JUDGED_KEYS as Record<string, readonly string[]>)[area] ?? [];
      expect([...judged].sort(), area).toEqual(fileKeys.sort());
    }
    expect(raw.synthetic.coverage.modeBVerifiableRatioMustBeAtLeastDefaultRule).toBe(true);
  });

  it('the judging code uses the file values', () => {
    const dims = {
      sampleRate: 48000,
      model: 'additive',
      snrDb: 40,
      micHighpassHz: 0,
      reverb: 'none',
      voicing: 'C',
      condition: '',
    };
    const outcomes: Outcome[] = [
      ...t.matrix.modeAConditions.map(
        (condition, i): Outcome => ({
          mode: 'A',
          id: `a${i}`,
          dims: { ...dims, condition },
          status: 'OK',
          verdict: 'PASS',
          semitonesExpected: 0,
          semitones: 0,
          cents: 0,
          decayRatio: 1,
          processingMs: 1,
        }),
      ),
      ...t.matrix.modeBConditions.map(
        (condition, i): Outcome => ({
          mode: 'B',
          id: `b${i}`,
          dims: { ...dims, condition },
          verdict: 'PASS',
          blamed: [],
          unexpectedIdx: [],
          targetIdx: null,
          processingMs: 1,
        }),
      ),
      { mode: 'C', id: 'c', dims, truth: 10, counted: 10, held: 0, events: 10, detected: 10 },
      { mode: 'Cset', id: 'cs', dims, correct: true, predicted: 'C' },
      {
        mode: 'D',
        id: 'd',
        dims,
        kind: 'pattern',
        truthCount: 1,
        detectedCount: 1,
        matched25: 1,
        absErrorsMs: [1],
        falseOnsets: 0,
        isolatedClicks: 1,
        clicksDetected: 0,
        slotAgree: 1,
        slotTotal: 1,
      },
      {
        mode: 'D',
        id: 'ds',
        dims,
        kind: 'sustain',
        truthCount: 1,
        detectedCount: 1,
        matched25: 1,
        absErrorsMs: [],
        falseOnsets: 0,
        isolatedClicks: 0,
        clicksDetected: 0,
        slotAgree: 0,
        slotTotal: 0,
      },
      { mode: 'tuner', id: 't', dims, errorCents: 0, octaveError: false, timeToStableMs: 100 },
      { mode: 'rtt', id: 'r', dims, hasSignal: true, ok: true, errorMs: 0 },
      { mode: 'rtt', id: 'r2', dims, hasSignal: false, ok: false, errorMs: null },
    ];
    const { metrics } = evaluateOutcomes(outcomes, t);
    const expected = Object.entries(JUDGED_KEYS).flatMap(([area, keys]) =>
      area === 'perf' ? [] : keys.map((k) => `${area}.${k}`),
    );
    expect(metrics.map((m) => `${m.area}.${m.key}`).sort()).toEqual(expected.sort());
    for (const m of metrics) expect(m.threshold, `${m.area}.${m.key}`).toBe(raw.synthetic[m.area][m.key]);
  });

  it('SNR strata: Mode B low-SNR samples count only toward cleanFailMax; tuner below 20 dB is not judged', () => {
    const dims = {
      sampleRate: 48000,
      model: 'additive',
      snrDb: 15,
      micHighpassHz: 0,
      reverb: 'none',
      voicing: 'C',
      condition: '',
    };
    const lowB: Outcome[] = raw.matrix.modeBConditions.map(
      (condition: string, i: number): Outcome => ({
        mode: 'B',
        id: `b${i}`,
        dims: { ...dims, condition },
        verdict: 'FAIL',
        blamed: [0],
        unexpectedIdx: [],
        targetIdx: 1,
        processingMs: 1,
      }),
    );
    const highB: Outcome[] = raw.matrix.modeBConditions.map(
      (condition: string, i: number): Outcome => ({
        mode: 'B',
        id: `h${i}`,
        dims: { ...dims, snrDb: 25, condition },
        verdict: 'PASS',
        blamed: [],
        unexpectedIdx: [],
        targetIdx: 1,
        processingMs: 1,
      }),
    );
    const { metrics } = evaluateOutcomes([...lowB, ...highB], t);
    const get = (key: string) => metrics.find((m) => m.key === key)!;
    expect(get('cleanFailMax').n).toBe(2);
    expect(get('cleanFailMax').value).toBe(0.5);
    for (const m of metrics.filter((x) => x.area === 'modeB' && x.key !== 'cleanFailMax'))
      expect(m.n, m.key).toBe(1);
    const tuner = evaluateOutcomes(
      [
        {
          mode: 'tuner',
          id: 'lo',
          dims: { ...dims, snrDb: 15 },
          errorCents: 1000,
          octaveError: true,
          timeToStableMs: null,
        },
        {
          mode: 'tuner',
          id: 'hi',
          dims: { ...dims, snrDb: 25 },
          errorCents: 0.1,
          octaveError: false,
          timeToStableMs: 120,
        },
      ],
      t,
    ).metrics;
    expect(tuner.find((m) => m.key === 'octaveErrorRateMax')).toMatchObject({ n: 1, value: 0 });
  });

  it('the strum verifier uses the §6.3 default collision rule (coverage cannot drop)', () => {
    expect(MODE_B_COLLISION_PARAMS).toEqual(DEFAULT_COLLISION_PARAMS);
  });
});

describe('§14.6-2 split seeds', () => {
  it.each([
    ['dev', dev],
    ['test', test],
  ] as const)('%s cases derive from thresholds.splitSeeds only', (split, cases) => {
    const [lo, hi] = raw.splitSeeds[split];
    const all = [
      ...cases.modeA,
      ...cases.modeB,
      ...cases.modeC,
      ...cases.modeCSet,
      ...cases.modeD,
      ...cases.tuner,
      ...cases.rtt,
    ];
    for (const c of all) {
      expect(c.baseSeed).toBeGreaterThanOrEqual(lo);
      expect(c.baseSeed).toBeLessThanOrEqual(hi);
    }
    expect(new Set(all.map((c) => c.baseSeed)).size).toBe(Math.min(all.length, hi - lo + 1));
  });

  it('dev and test splits never share a case seed', () => {
    const seeds = (c: CaseSet) =>
      new Set(
        [...c.modeA, ...c.modeB, ...c.modeC, ...c.modeCSet, ...c.modeD, ...c.tuner, ...c.rtt].map(
          (x) => x.seed,
        ),
      );
    const d = seeds(dev);
    for (const s of seeds(test)) expect(d.has(s)).toBe(false);
  });
});

describe('§14.6-2 / AC-S8 test-split matrix and sizes', () => {
  const m = raw.matrix;
  const frac = m.rangeEndpointCoverageFraction;

  it('meets the minimum sample sizes (and per-condition minimums)', () => {
    const min = raw.minimumTestSizes;
    expect(test.modeA.length).toBeGreaterThanOrEqual(min.modeA);
    expect(test.modeB.length).toBeGreaterThanOrEqual(min.modeB);
    expect(test.modeC.length).toBeGreaterThanOrEqual(min.modeCSequences);
    expect(test.modeCSet.length).toBeGreaterThanOrEqual(min.modeCSetStrums);
    expect(
      test.modeD.filter((c) => c.kind === 'pattern').reduce((s, c) => s + c.strums.length, 0),
    ).toBeGreaterThanOrEqual(min.modeDEvents);
    expect(test.tuner.length).toBeGreaterThanOrEqual(min.tuner);
    expect(test.rtt.filter((c) => c.hasSignal).length).toBeGreaterThanOrEqual(min.rtt);
    for (const condition of m.modeAConditions) {
      expect(test.modeA.filter((c) => c.condition === condition).length).toBeGreaterThanOrEqual(
        Math.ceil(min.modeA / m.modeAConditions.length),
      );
    }
    // Mode B is judged at SNR ≥ detectionStrataSnrDbMin, so the per-condition minimum must hold there.
    const strata = raw.synthetic.modeB.detectionStrataSnrDbMin;
    for (const condition of m.modeBConditions) {
      expect(
        test.modeB.filter((c) => c.condition === condition && c.snrDb >= strata).length,
      ).toBeGreaterThanOrEqual(Math.ceil(min.modeB / m.modeBConditions.length));
    }
  });

  it.each(['modeA', 'modeB', 'modeC', 'modeD'] as const)('%s covers every set value', (mode) => {
    const cases = test[mode];
    for (const sr of m.sampleRates)
      expect(
        cases.some((c) => c.sampleRate === sr),
        `${mode} sampleRate ${sr}`,
      ).toBe(true);
    for (const model of m.synthModels)
      expect(
        cases.some((c) => c.model === model),
        `${mode} model ${model}`,
      ).toBe(true);
    for (const snr of m.snrDb)
      expect(
        cases.some((c) => c.snrDb === snr),
        `${mode} snr ${snr}`,
      ).toBe(true);
    for (const hpf of m.micHighpassHz)
      expect(
        cases.some((c) => c.micHighpassHz === hpf),
        `${mode} hpf ${hpf}`,
      ).toBe(true);
    for (const reverb of m.reverb)
      expect(
        cases.some((c) => c.reverb === reverb),
        `${mode} reverb ${reverb}`,
      ).toBe(true);
    expect(
      coversRange(
        cases.filter((c) => c.model === 'additive').map((c) => c.inharmonicityB),
        m.additiveInharmonicityB,
        frac,
        true,
      ),
    ).toBe(true);
    for (const c of cases) {
      expect(c.stringGainDb.every((g) => Math.abs(g) <= m.stringGainJitterDb)).toBe(true);
      expect(c.detuneCents.every((d) => Math.abs(d) <= m.detuneCentsMax)).toBe(true);
      for (const [i, d] of c.deltaGivenCents.entries()) {
        expect(Math.abs(d - c.detuneCents[i]!)).toBeLessThanOrEqual(m.calibrationResidualCentsMax);
      }
    }
  });

  it('Mode A/B cover every voicing and condition; spreads cover 0–40 ms', () => {
    for (const v of m.voicings) {
      expect(
        test.modeA.some((c) => c.voicingId === v),
        `A ${v}`,
      ).toBe(true);
      expect(
        test.modeB.some((c) => c.voicingId === v),
        `B ${v}`,
      ).toBe(true);
    }
    for (const cond of m.modeAConditions) expect(test.modeA.some((c) => c.condition === cond)).toBe(true);
    for (const cond of m.modeBConditions) expect(test.modeB.some((c) => c.condition === cond)).toBe(true);
    expect(
      coversRange(
        test.modeB.map((c) => c.spreadMs),
        m.strumSpreadMs,
        frac,
      ),
    ).toBe(true);
  });

  it('Mode C sequences: 60 s, changes/min range, all 25 pairs with both G voicings', () => {
    expect(
      coversRange(
        test.modeC.map((c) => c.changesPerMin),
        m.modeC.changesPerMin,
        frac,
      ),
    ).toBe(true);
    const pairs = new Set(
      test.modeC.map((c) =>
        c.pair
          .map((p) => (p.startsWith('G-') ? 'G' : p))
          .sort()
          .join('|'),
      ),
    );
    expect(pairs.size).toBe(25);
    expect(test.modeC.some((c) => c.pair.includes('G-2f'))).toBe(true);
    expect(test.modeC.some((c) => c.pair.includes('G-3f'))).toBe(true);
    for (const c of test.modeC) {
      expect(c.events.at(-1)!.time - c.events[0]!.time).toBeLessThanOrEqual(m.modeC.sequenceSeconds);
      expect(c.truthChanges).toBe(c.events.filter((e) => e.kind === 'arrival').length);
    }
    const events = test.modeC.flatMap((c) => c.events.filter((e) => e.kind !== 'first'));
    expect(events.some((e) => e.kind === 'same')).toBe(true);
    expect(events.some((e) => e.kind === 'open')).toBe(true);
    expect(events.some((e) => e.mutedIdx !== null)).toBe(true);
  });

  it('Mode D covers BPM, human offset, RTT ranges, bleed in half the sequences, and sustain cases', () => {
    const patterns = test.modeD.filter((c) => c.kind === 'pattern');
    expect(
      coversRange(
        patterns.map((c) => c.bpm),
        m.modeD.bpm,
        frac,
      ),
    ).toBe(true);
    expect(
      coversRange(
        patterns.map((c) => c.humanMeanOffsetMs),
        m.modeD.humanMeanOffsetMs,
        frac,
      ),
    ).toBe(true);
    expect(
      coversRange(
        patterns.map((c) => c.rttMs),
        m.modeD.rttMs,
        frac,
      ),
    ).toBe(true);
    expect(patterns.filter((c) => c.clickBleed).length / patterns.length).toBeCloseTo(
      m.modeD.clickBleedSequenceFraction,
      1,
    );
    for (const c of patterns)
      expect(Math.abs(c.rttGivenMs - c.rttMs)).toBeLessThanOrEqual(m.modeD.rttGivenToDetectorJitterMs);
    expect(test.modeD.some((c) => c.kind === 'sustain')).toBe(true);
  });

  it('tuner covers E2–E5 and ±50 cents at SNR ≥ 20; RTT covers 10–300 ms with and without reverb plus silence', () => {
    const lo = nameToMidi(m.tuner.noteRange[0]);
    const hi = nameToMidi(m.tuner.noteRange[1]);
    for (let midi = lo; midi <= hi; midi++)
      expect(
        test.tuner.some((c) => c.midi === midi),
        `midi ${midi}`,
      ).toBe(true);
    expect(
      coversRange(
        test.tuner.map((c) => c.detune),
        [-m.tuner.detuneCentsMax, m.tuner.detuneCentsMax],
        frac,
      ),
    ).toBe(true);
    expect(test.tuner.every((c) => c.snrDb >= m.tuner.snrDbMin)).toBe(true);
    const signal = test.rtt.filter((c) => c.hasSignal);
    expect(
      coversRange(
        signal.map((c) => c.latencyMs),
        m.rtt.latencyMs,
        frac,
      ),
    ).toBe(true);
    for (const r of m.rtt.reverb) expect(signal.some((c) => c.reverb === r)).toBe(true);
    expect(signal.every((c) => c.snrDb >= m.rtt.snrDbMin)).toBe(true);
    expect(test.rtt.some((c) => !c.hasSignal)).toBe(true);
  });

  it('classifySet strums cover the 8 beginner classes at SNR ≥ 25', () => {
    const classes = new Set(test.modeCSet.map((c) => (c.voicingId.startsWith('G-') ? 'G' : c.voicingId)));
    expect(classes.size).toBe(8);
    expect(test.modeCSet.every((c) => c.snrDb >= raw.synthetic.modeCSet.snrDbMin)).toBe(true);
  });
});
