import { describe, expect, it } from 'vitest';
import { buildDiagnostics, captureConstraints } from '../../audio/devices';
import {
  aggregateTemplate,
  buildCalibration,
  type CalibrationDraft,
  decideLoopback,
  judgeTuning,
  openStringHz,
  sampleRateSuspect,
} from './calibrationModel';

describe('judgeTuning', () => {
  it('passes within ±15 cents and guides the direction otherwise', () => {
    const e2 = openStringHz(0);
    expect(e2).toBeCloseTo(82.407, 3);
    expect(judgeTuning(e2 * 2 ** (14 / 1200), e2).kind).toBe('pass');
    expect(judgeTuning(e2 * 2 ** (-14.99 / 1200), e2).kind).toBe('pass');
    expect(judgeTuning(e2 * 2 ** (-16 / 1200), e2).kind).toBe('tooLow');
    expect(judgeTuning(e2 * 2 ** (40 / 1200), e2).kind).toBe('tooHigh');
    expect(judgeTuning(e2 * 2 ** (200 / 1200), e2).kind).toBe('otherNote');
  });

  it('applies the calibrated δ to expected frequencies', () => {
    expect(openStringHz(5, 10) / openStringHz(5)).toBeCloseTo(2 ** (10 / 1200), 12);
  });
});

describe('sampleRateSuspect', () => {
  const readings = (ratios: number[]) =>
    ratios.map((r, i) => ({ measuredHz: openStringHz(i) * r, expectedHz: openStringHz(i) }));
  it('flags a uniform offset beyond ±1% (44.1 kHz audio treated as 48 kHz → −8.1%)', () => {
    expect(sampleRateSuspect(readings(Array(6).fill(44100 / 48000)))).toBe(true);
  });
  it('ignores scattered detuning and small uniform offsets', () => {
    expect(sampleRateSuspect(readings([0.97, 1.02, 0.99, 1.04, 0.98, 1.0]))).toBe(false);
    expect(sampleRateSuspect(readings(Array(6).fill(1.005)))).toBe(false);
    expect(sampleRateSuspect(readings([0.9, 0.9]))).toBe(false);
  });
});

describe('aggregateTemplate', () => {
  it('takes per-harmonic medians and the median decay ratio of usable plucks', () => {
    const t = aggregateTemplate([
      { harmonics: [1, 0.5, 0.2], decayRatio: 0.4 },
      { harmonics: [1, 0.7, 0.1], decayRatio: 0.5 },
      { harmonics: [1, 0.6, 0.3], decayRatio: null },
      { harmonics: [1, 0.9, 0.4], decayRatio: 0.6 },
    ]);
    expect(t).toEqual({ harmonics: [1, 0.7, 0.2], decayRatio: 0.5 });
    expect(aggregateTemplate([{ harmonics: [1], decayRatio: null }])).toBeNull();
  });
});

describe('decideLoopback', () => {
  const ok = (rttMs: number) => ({ ok: true as const, rttMs, madMs: 0.2 });
  const fail = { ok: false as const, reason: 'NO_SIGNAL' };
  it('accepts two consecutive agreeing measurements (mean)', () => {
    expect(decideLoopback([ok(40)])).toEqual({ kind: 'again' });
    expect(decideLoopback([ok(40), ok(42)])).toEqual({
      kind: 'done',
      rttMs: 41,
      madMs: 0.2,
      agreeing: [40, 42],
    });
  });
  it('measures again on disagreement, falls back to tap after three attempts or two failures', () => {
    expect(decideLoopback([ok(40), ok(48)])).toEqual({ kind: 'again' });
    expect(decideLoopback([ok(40), ok(48), ok(49)]).kind).toBe('done');
    expect(decideLoopback([ok(40), ok(48), ok(60)])).toEqual({ kind: 'fallback', reason: 'INCONSISTENT' });
    expect(decideLoopback([fail, fail])).toEqual({ kind: 'fallback', reason: 'NO_SIGNAL' });
    expect(decideLoopback([fail, ok(40)])).toEqual({ kind: 'again' });
  });
});

describe('buildCalibration', () => {
  const diagnostics = buildDiagnostics({
    requested: captureConstraints(null),
    trackSettings: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: true,
      sampleRate: 48000,
    },
    label: 'MacBook Pro Microphone',
    contextSampleRate: 48000,
    baseLatencyS: 0.01,
    outputLatencyS: 0.02,
    now: 5,
  });
  const draft: CalibrationDraft = {
    id: 'cal-1',
    createdAt: 10,
    diagnostics,
    outputDeviceLabel: 'AirPods Pro',
    noise: { noiseDbfs: -40, thirdOctaveDb: [-80, -82] },
    tuningCents: [1, -2, 3, 0, 4, -5],
    firstReadings: [],
    templates: Array.from({ length: 6 }, () => ({ harmonics: [1, 0.5], decayRatio: 0.4 })),
    rtt: { rttMs: 41, madMs: 0.3, method: 'tap' },
  };

  it('produces a JSON-serializable record with warnings', () => {
    const c = buildCalibration(draft);
    expect(c).toMatchObject({
      id: 'cal-1',
      inputDeviceLabel: 'MacBook Pro Microphone',
      outputDeviceLabel: 'AirPods Pro',
      sampleRate: 48000,
      rttMs: 41,
      rttMethod: 'tap',
      noiseFloorDbfs: -40,
    });
    expect(c.warnings).toEqual(['NOISY', 'PROCESSING_ON', 'BLUETOOTH_OUTPUT', 'RTT_TAP']);
    expect(c.trackSettings).toMatchObject({ autoGainControl: true, processingOn: ['autoGainControl'] });
    expect(JSON.parse(JSON.stringify(c))).toEqual(c);
  });

  it('refuses incomplete tuning or templates', () => {
    expect(() => buildCalibration({ ...draft, tuningCents: [1, null, 3, 0, 4, -5] })).toThrow('tuning');
    expect(() => buildCalibration({ ...draft, templates: [...draft.templates.slice(0, 5), null] })).toThrow(
      'templates',
    );
  });
});
