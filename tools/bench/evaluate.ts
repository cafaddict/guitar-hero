/**
 * Runs the detectors on rendered cases exactly as the app would: onset detection first, then the
 * verifier/classifier on a [onset − 500 ms, onset + 400 ms] segment (Mode A/B) or the whole take (C/D).
 */
import { voicingById } from '../../src/content/voicings';
import { STANDARD_TUNING } from '../../src/domain/theory';
import { verifyPluck } from '../../src/dsp/modeA';
import { verifyStrum } from '../../src/dsp/modeB';
import { ChangeCounter, classifyPair, classifySet } from '../../src/dsp/modeC';
import { DEFAULT_ONSET_PARAMS, detectStrums } from '../../src/dsp/onset';
import { estimateRtt } from '../../src/dsp/rtt';
import { energyOnset, selectTakeEvent } from '../../src/dsp/take';
import { analyzeTiming } from '../../src/dsp/timing';
import { analyzeTuning } from '../../src/dsp/tuner';
import type {
  BenchCase,
  ModeACase,
  ModeBCase,
  ModeCCase,
  ModeCSetCase,
  ModeDCase,
  RttCase,
  TunerCase,
} from './cases';
import {
  renderModeA,
  renderModeB,
  renderModeC,
  renderModeCSet,
  renderModeD,
  renderRtt,
  renderTuner,
} from './render';
import type { Thresholds } from './thresholds';

export interface Dims {
  sampleRate: number;
  model: string;
  snrDb: number;
  micHighpassHz: number;
  reverb: string;
  voicing: string;
  condition: string;
}

export interface OutcomeA {
  mode: 'A';
  id: string;
  dims: Dims;
  status: string;
  verdict: string;
  semitonesExpected: number;
  semitones: number | null;
  cents: number | null;
  decayRatio: number | null;
  processingMs: number;
}

export interface OutcomeB {
  mode: 'B';
  id: string;
  dims: Dims;
  verdict: string;
  blamed: number[];
  unexpectedIdx: number[];
  targetIdx: number | null;
  processingMs: number;
}

export interface OutcomeC {
  mode: 'C';
  id: string;
  dims: Dims;
  truth: number;
  counted: number;
  held: number;
  events: number;
  detected: number;
}

export interface OutcomeCSet {
  mode: 'Cset';
  id: string;
  dims: Dims;
  correct: boolean;
  predicted: string;
}

export interface OutcomeD {
  mode: 'D';
  id: string;
  dims: Dims;
  kind: 'pattern' | 'sustain';
  truthCount: number;
  detectedCount: number;
  /** Detected-vs-truth matches within ±25 ms. */
  matched25: number;
  /** Absolute errors (ms) of matched detections (±50 ms matching). */
  absErrorsMs: number[];
  falseOnsets: number;
  /** Clicks not coinciding with a strum, and how many of them were (wrongly) detected. */
  isolatedClicks: number;
  clicksDetected: number;
  slotAgree: number;
  slotTotal: number;
}

export interface OutcomeTuner {
  mode: 'tuner';
  id: string;
  dims: Dims;
  errorCents: number | null;
  octaveError: boolean;
  timeToStableMs: number | null;
}

export interface OutcomeRtt {
  mode: 'rtt';
  id: string;
  dims: Dims;
  hasSignal: boolean;
  ok: boolean;
  errorMs: number | null;
}

export type Outcome = OutcomeA | OutcomeB | OutcomeC | OutcomeCSet | OutcomeD | OutcomeTuner | OutcomeRtt;

function dims(c: BenchCase, voicing: string, condition: string): Dims {
  return {
    sampleRate: c.sampleRate,
    model: c.model,
    snrDb: c.snrDb,
    micHighpassHz: c.micHighpassHz,
    reverb: c.reverb,
    voicing,
    condition,
  };
}

function segment(
  signal: Float32Array,
  onset: number,
  fs: number,
): { samples: Float32Array; onsetSample: number } {
  const pre = Math.round(0.5 * fs);
  const post = Math.round(0.4 * fs);
  const start = Math.max(0, onset - pre);
  return { samples: signal.slice(start, Math.min(signal.length, onset + post)), onsetSample: onset - start };
}

function evaluateA(c: ModeACase, t: Thresholds): OutcomeA {
  const r = renderModeA(c, t);
  const v = voicingById(c.voicingId);
  // The app analyses the first onset of the take (selectTakeEvent); the true onset is never used to choose.
  // With no flux onset at all, the pluck flow falls back to the energy onset (armed for the whole take).
  const take = selectTakeEvent(detectStrums(r.signal, c.sampleRate), c.sampleRate);
  const fallback =
    !take.ok && take.reason === 'NO_ONSET'
      ? energyOnset(r.signal, c.sampleRate, Math.round(0.25 * c.sampleRate), r.signal.length)
      : null;
  const event = take.ok ? take.event : fallback !== null ? { sample: fallback } : null;
  const base = {
    mode: 'A' as const,
    id: c.id,
    dims: dims(c, c.voicingId, c.condition),
    semitonesExpected: c.fretOffset,
  };
  if (!event)
    return {
      ...base,
      status: 'NOT_PLAYED',
      verdict: 'RETRY',
      semitones: null,
      cents: null,
      decayRatio: null,
      processingMs: 0,
    };
  const seg = segment(r.signal, event.sample, c.sampleRate);
  const fret = v.frets[c.stringIdx] as number;
  const expectedF0 =
    440 *
    2 ** ((STANDARD_TUNING.openMidi[c.stringIdx]! + fret - 69) / 12) *
    2 ** (c.deltaGivenCents[c.stringIdx]! / 1200);
  const res = verifyPluck({
    samples: seg.samples,
    sampleRate: c.sampleRate,
    onsetSample: seg.onsetSample,
    expectedF0,
  });
  return {
    ...base,
    status: res.status,
    verdict: res.verdict,
    semitones: res.semitones,
    cents: res.cents,
    decayRatio: res.decayRatio,
    processingMs: res.processingMs,
  };
}

function evaluateB(c: ModeBCase, t: Thresholds): OutcomeB {
  const r = renderModeB(c, t);
  // The app analyses the first onset of the take (selectTakeEvent); the true onset is never used to choose.
  const take = selectTakeEvent(detectStrums(r.signal, c.sampleRate), c.sampleRate);
  const event = take.ok ? take.event : null;
  const base = {
    mode: 'B' as const,
    id: c.id,
    dims: dims(c, c.voicingId, c.condition),
    targetIdx: c.targetIdx,
  };
  if (!event) return { ...base, verdict: 'RETRY', blamed: [], unexpectedIdx: [], processingMs: 0 };
  const seg = segment(r.signal, event.sample, c.sampleRate);
  const res = verifyStrum({
    samples: seg.samples,
    sampleRate: c.sampleRate,
    onsetSample: seg.onsetSample,
    voicing: voicingById(c.voicingId),
    tuning: STANDARD_TUNING,
    deltaCents: c.deltaGivenCents,
  });
  return {
    ...base,
    verdict: res.verdict,
    blamed: res.blamed,
    unexpectedIdx: res.unexpected.map((u) => u.idx).filter((i): i is number => i !== null),
    processingMs: res.processingMs,
  };
}

function evaluateC(c: ModeCCase, t: Thresholds): OutcomeC {
  const r = renderModeC(c, t);
  const fs = c.sampleRate;
  const events = detectStrums(r.signal, fs);
  const counter = new ChangeCounter();
  const pair = [voicingById(c.pair[0]), voicingById(c.pair[1])] as const;
  // The counter starts in the first chord, so the opening strum (classified as that chord) never counts.
  for (const e of events) {
    const cls = classifyPair(
      {
        samples: r.signal,
        sampleRate: fs,
        onsetSample: e.sample,
        tuning: STANDARD_TUNING,
        deltaCents: c.deltaGivenCents,
      },
      pair,
    );
    counter.push(cls, (e.sample / fs) * 1000);
  }
  return {
    mode: 'C',
    id: c.id,
    dims: dims(c, c.pair.join('|'), 'sequence'),
    truth: c.truthChanges,
    counted: counter.count,
    held: counter.held,
    events: c.events.length,
    detected: events.length,
  };
}

function evaluateCSet(c: ModeCSetCase, t: Thresholds): OutcomeCSet {
  const r = renderModeCSet(c, t);
  // The app analyses the first onset of the take (selectTakeEvent); the true onset is never used to choose.
  const take = selectTakeEvent(detectStrums(r.signal, c.sampleRate), c.sampleRate);
  const event = take.ok ? take.event : null;
  const candidates = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G-2f', 'G-3f'].map(voicingById);
  const classOf = (id: string) => (id.startsWith('G-') ? 'G' : id);
  if (!event)
    return { mode: 'Cset', id: c.id, dims: dims(c, c.voicingId, 'clean'), correct: false, predicted: 'none' };
  const seg = segment(r.signal, event.sample, c.sampleRate);
  const res = classifySet(
    {
      samples: seg.samples,
      sampleRate: c.sampleRate,
      onsetSample: seg.onsetSample,
      tuning: STANDARD_TUNING,
      deltaCents: c.deltaGivenCents,
    },
    candidates,
    (v) => classOf(v.id),
  );
  const predicted = classOf(candidates[res.top]!.id);
  return {
    mode: 'Cset',
    id: c.id,
    dims: dims(c, c.voicingId, 'clean'),
    correct: predicted === classOf(c.voicingId),
    predicted,
  };
}

function evaluateD(c: ModeDCase, t: Thresholds): OutcomeD {
  const r = renderModeD(c, t);
  const fs = c.sampleRate;
  const clickSamples = c.clicks.map((k) => Math.round((k.time + c.rttGivenMs / 1000) * fs));
  const events = detectStrums(r.signal, fs, DEFAULT_ONSET_PARAMS, { clickSamples });
  const detected = events.map((e) => e.sample);
  const truth = r.truthSamples;
  // F1 matching (±25 ms, one-to-one, greedy by distance) and timing errors (±50 ms).
  const match = (tolMs: number) => {
    const tol = (tolMs / 1000) * fs;
    const pairs: { d: number; tr: number; dist: number }[] = [];
    for (const [i, d] of detected.entries()) {
      for (const [j, tr] of truth.entries())
        if (Math.abs(d - tr) <= tol) pairs.push({ d: i, tr: j, dist: Math.abs(d - tr) });
    }
    pairs.sort((a, b) => a.dist - b.dist);
    const usedD = new Set<number>();
    const usedT = new Set<number>();
    const matched: { d: number; tr: number }[] = [];
    for (const p of pairs) {
      if (usedD.has(p.d) || usedT.has(p.tr)) continue;
      usedD.add(p.d);
      usedT.add(p.tr);
      matched.push(p);
    }
    return matched;
  };
  const m25 = match(25);
  const m50 = match(50);
  const absErrorsMs = m50.map((p) => (Math.abs(detected[p.d]! - truth[p.tr]!) / fs) * 1000);
  const base = {
    mode: 'D' as const,
    id: c.id,
    dims: dims(
      c,
      c.voicingId,
      c.kind === 'sustain' ? 'sustain' : `${c.patternId}${c.clickBleed ? '+bleed' : ''}`,
    ),
    kind: c.kind,
  };
  if (c.kind === 'sustain') {
    const falseOnsets = detected.filter((d) => Math.abs(d - truth[0]!) > 0.06 * fs).length;
    return {
      ...base,
      truthCount: truth.length,
      detectedCount: detected.length,
      matched25: m25.length,
      absErrorsMs,
      falseOnsets,
      isolatedClicks: 0,
      clicksDetected: 0,
      slotAgree: 0,
      slotTotal: 0,
    };
  }
  // Click bleed: clicks with no true strum within ±50 ms must not be detected (no detection within ±25 ms).
  let isolated = 0;
  let clicksDetected = 0;
  if (c.clickBleed) {
    for (const arrival of r.clickArrivalSamples) {
      if (truth.some((tr) => Math.abs(tr - arrival) <= 0.05 * fs)) continue;
      isolated++;
      if (detected.some((d) => Math.abs(d - arrival) <= 0.025 * fs)) clicksDetected++;
    }
  }
  // Slot judgements: truth (true times, true RTT) vs detector (detected times, given RTT).
  const truthJ = analyzeTiming(
    c.slots,
    truth.map((s) => s / fs),
    c.rttMs / 1000,
    c.bpm,
  ).judgements;
  const detJ = analyzeTiming(
    c.slots,
    detected.map((s) => s / fs),
    c.rttGivenMs / 1000,
    c.bpm,
  ).judgements;
  const agree = truthJ.filter((j, i) => j === detJ[i]).length;
  return {
    ...base,
    truthCount: truth.length,
    detectedCount: detected.length,
    matched25: m25.length,
    absErrorsMs,
    falseOnsets: 0,
    isolatedClicks: isolated,
    clicksDetected,
    slotAgree: agree,
    slotTotal: truthJ.length,
  };
}

function evaluateTuner(c: TunerCase, t: Thresholds): OutcomeTuner {
  const r = renderTuner(c, t);
  // The tuner runs continuously from the start of the recording; time-to-stable is measured from the onset.
  const res = analyzeTuning(
    r.signal,
    c.sampleRate,
    0,
    { kind: 'chromatic' },
    undefined,
    undefined,
    r.onsetSample,
  );
  const errorCents = res.stableF0 === null ? null : 1200 * Math.log2(res.stableF0 / r.trueF0);
  return {
    mode: 'tuner',
    id: c.id,
    dims: dims(c, `midi${c.midi}`, 'tuner'),
    errorCents,
    octaveError: errorCents !== null && Math.abs(errorCents) > 600,
    timeToStableMs: res.timeToStableMs,
  };
}

function evaluateRtt(c: RttCase, t: Thresholds): OutcomeRtt {
  const r = renderRtt(c, t);
  const res = estimateRtt(r.signal, c.sampleRate, r.recordingStartS, r.scheduledS);
  return {
    mode: 'rtt',
    id: c.id,
    dims: dims(c, '-', c.hasSignal ? 'signal' : 'silent'),
    hasSignal: c.hasSignal,
    ok: res.ok,
    errorMs: res.ok ? res.rttMs - c.latencyMs : null,
  };
}

export function evaluateCase(c: BenchCase, t: Thresholds): Outcome {
  switch (c.mode) {
    case 'A':
      return evaluateA(c, t);
    case 'B':
      return evaluateB(c, t);
    case 'C':
      return evaluateC(c, t);
    case 'Cset':
      return evaluateCSet(c, t);
    case 'D':
      return evaluateD(c, t);
    case 'tuner':
      return evaluateTuner(c, t);
    case 'rtt':
      return evaluateRtt(c, t);
  }
}
