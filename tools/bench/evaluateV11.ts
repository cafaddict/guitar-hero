/**
 * Runs the v1.1 detectors on rendered v1.1 cases exactly as the app would (SPEC v1.1 §14.8).
 */
import { voicingById } from '../../src/content/voicings';
import { STANDARD_TUNING } from '../../src/domain/theory';
import { backingTemplateRises } from '../../src/dsp/backingMask';
import { classifySet } from '../../src/dsp/modeC';
import { DEFAULT_ONSET_PARAMS, detectStrums } from '../../src/dsp/onset';
import { detectSequenceOnsets, type SequenceSlot, verifySequence } from '../../src/dsp/sequence';
import { selectTakeEvent } from '../../src/dsp/take';
import { analyzeTiming } from '../../src/dsp/timing';
import { type BetaCase, evaluateBeta, type OutcomeBeta } from './betaBench';
import type { BackingBleedCase, ModeCSetStage8Case, SequenceCase, SwingCase, V11Case } from './casesV11';
import { BLEED_INTRO_BARS } from './casesV11';
import type { Dims } from './evaluate';
import { renderModeD } from './render';
import { renderBackingBleed, renderModeCSetStage8, renderSequenceCase } from './renderV11';
import type { Thresholds } from './thresholds';

export interface OutcomeSeq {
  mode: 'seq';
  id: string;
  dims: Dims;
  noteCount: number;
  truthOnsets: number;
  detectedOnsets: number;
  /** Detected-vs-true onset matches within ±onsetMatchMs (clean cases). */
  matchedOnsets: number;
  okNotes: number;
  flawless: boolean;
  uncertain: boolean;
  /** Whether the injected defect was judged exactly (null for clean). */
  defectDetected: boolean | null;
  statuses: string[];
  processingMs: number;
}

/** Greedy one-to-one matching by distance; returns the number of pairs within `tol` samples. */
export function matchCount(detected: readonly number[], truth: readonly number[], tol: number): number {
  const pairs: { d: number; t: number; dist: number }[] = [];
  detected.forEach((d, i) => {
    truth.forEach((tr, j) => {
      const dist = Math.abs(d - tr);
      if (dist <= tol) pairs.push({ d: i, t: j, dist });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);
  const usedD = new Set<number>();
  const usedT = new Set<number>();
  for (const p of pairs) {
    if (usedD.has(p.d) || usedT.has(p.t)) continue;
    usedD.add(p.d);
    usedT.add(p.t);
  }
  return usedD.size;
}

export function sequenceDims(c: SequenceCase): Dims {
  return {
    sampleRate: c.sampleRate,
    model: c.model,
    snrDb: c.snrDb,
    micHighpassHz: c.micHighpassHz,
    reverb: c.reverb,
    voicing: c.step === null ? c.shape : `${c.shape}#${c.step}`,
    condition: c.condition,
  };
}

export function evaluateSequence(c: SequenceCase, t: Thresholds): OutcomeSeq {
  const r = renderSequenceCase(c, t);
  const fs = c.sampleRate;
  const onsets = detectSequenceOnsets(r.signal, fs);
  const slots: SequenceSlot[] = c.slots.map((s) => ({
    time: s.time + c.rttGivenMs / 1000,
    midi: s.midi,
    stringIdx: 6 - s.string,
    cycle: 0,
  }));
  const res = verifySequence({
    samples: r.signal,
    sampleRate: fs,
    slots,
    bpm: c.bpm,
    onsets,
    deltaCents: c.deltaGivenCents,
  });
  const tol = (t.matrix.sequence.onsetMatchMs / 1000) * fs;
  const detected = onsets.map((o) => o.sample);
  let defectDetected: boolean | null = null;
  if (c.condition === 'wrong+1' || c.condition === 'wrong-1') {
    const note = res.notes[c.defectSlot!]!;
    defectDetected = note.status === 'WRONG_NOTE' && note.semitones === (c.condition === 'wrong+1' ? 1 : -1);
  } else if (c.condition === 'missed') {
    defectDetected = res.notes[c.defectSlot!]!.status === 'MISSED';
  } else if (c.condition === 'extra') {
    const at = c.extraTime! * fs;
    defectDetected = res.extras.some((e) => Math.abs(e - at) <= tol);
  }
  return {
    mode: 'seq',
    id: c.id,
    dims: sequenceDims(c),
    noteCount: c.slots.length,
    truthOnsets: r.truthSamples.length,
    detectedOnsets: detected.length,
    matchedOnsets: matchCount(detected, r.truthSamples, tol),
    okNotes: res.notes.filter((n) => n.status === 'OK').length,
    flawless: res.cycles[0]?.flawless ?? false,
    uncertain: res.cycles[0]?.uncertain ?? false,
    defectDetected,
    statuses: res.notes.map((n) => n.status),
    processingMs: res.processingMs,
  };
}

export interface OutcomeCSet8 {
  mode: 'Cset8';
  id: string;
  dims: Dims;
  correct: boolean;
  predicted: string;
}

/** classifySet over the case's stage set (every root distinct, so classes are the voicing ids). */
export function evaluateModeCSetStage8(c: ModeCSetStage8Case, t: Thresholds): OutcomeCSet8 {
  const r = renderModeCSetStage8(c, t);
  const fs = c.sampleRate;
  const set = t.matrix.modeCSetStage8to11.sets[c.setIdx]!;
  const dims: Dims = {
    sampleRate: fs,
    model: c.model,
    snrDb: c.snrDb,
    micHighpassHz: c.micHighpassHz,
    reverb: c.reverb,
    voicing: c.voicingId,
    condition: `set${c.setIdx}`,
  };
  // The app analyses the first onset of the take (selectTakeEvent); the true onset is never used to choose.
  const take = selectTakeEvent(detectStrums(r.signal, fs), fs);
  if (!take.ok) return { mode: 'Cset8', id: c.id, dims, correct: false, predicted: 'none' };
  const pre = Math.round(0.5 * fs);
  const start = Math.max(0, take.event.sample - pre);
  const candidates = set.map(voicingById);
  const res = classifySet(
    {
      samples: r.signal.slice(start, Math.min(r.signal.length, take.event.sample + Math.round(0.4 * fs))),
      sampleRate: fs,
      onsetSample: take.event.sample - start,
      tuning: STANDARD_TUNING,
      deltaCents: c.deltaGivenCents,
    },
    candidates,
  );
  const predicted = candidates[res.top]!.id;
  return { mode: 'Cset8', id: c.id, dims, correct: predicted === c.voicingId, predicted };
}

export interface OutcomeSwing {
  mode: 'swing';
  id: string;
  dims: Dims;
  truthCount: number;
  detectedCount: number;
  matched25: number;
  /** Absolute errors (ms) of detections matched within ±50 ms. */
  absErrorsMs: number[];
  /** Synthesized strums whose ±25 ms detection the timing judgement assigned to the right slot. */
  slotCorrect: number;
}

/** Greedy one-to-one pairs (detected index → truth index) within `tol` samples. */
export function matchPairs(
  detected: readonly number[],
  truth: readonly number[],
  tol: number,
): Map<number, number> {
  const pairs: { d: number; t: number; dist: number }[] = [];
  detected.forEach((d, i) => {
    truth.forEach((tr, j) => {
      const dist = Math.abs(d - tr);
      if (dist <= tol) pairs.push({ d: i, t: j, dist });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);
  const out = new Map<number, number>();
  const usedT = new Set<number>();
  for (const p of pairs) {
    if (out.has(p.d) || usedT.has(p.t)) continue;
    out.set(p.d, p.t);
    usedT.add(p.t);
  }
  return out;
}

export function evaluateSwing(c: SwingCase, t: Thresholds): OutcomeSwing {
  const r = renderModeD({ ...c, mode: 'D', kind: 'pattern' }, t);
  const fs = c.sampleRate;
  const clickSamples = c.clicks.map((k) => Math.round((k.time + c.rttGivenMs / 1000) * fs));
  const detected = detectStrums(r.signal, fs, DEFAULT_ONSET_PARAMS, { clickSamples }).map((e) => e.sample);
  const truth = r.truthSamples;
  const m25 = matchPairs(detected, truth, 0.025 * fs);
  const m50 = matchPairs(detected, truth, 0.05 * fs);
  // The detector judges with the swing grid of the ratio it is given (thresholds.matrix.swing.detectorGetsRatio).
  const timing = analyzeTiming(
    c.slots,
    detected.map((s) => s / fs),
    c.rttGivenMs / 1000,
    c.bpm,
  );
  let slotCorrect = 0;
  for (const [d, tr] of m25) if (timing.strumSlots[d] === c.strums[tr]!.slot) slotCorrect++;
  return {
    mode: 'swing',
    id: c.id,
    dims: {
      sampleRate: fs,
      model: c.model,
      snrDb: c.snrDb,
      micHighpassHz: c.micHighpassHz,
      reverb: c.reverb,
      voicing: c.voicingId,
      condition: `${c.patternId}${c.clickBleed ? '+bleed' : ''}`,
    },
    truthCount: truth.length,
    detectedCount: detected.length,
    matched25: m25.size,
    absErrorsMs: [...m50].map(([d, tr]) => (Math.abs(detected[d]! - truth[tr]!) / fs) * 1000),
    slotCorrect,
  };
}

export interface OutcomeBleed {
  mode: 'bleed';
  id: string;
  dims: Dims;
  truthCount: number;
  detectedCount: number;
  matched25: number;
  /** Backing events in the user's bars with no user strum within ±overlapExcludeMs. */
  isolatedBacking: number;
  /** …and how many of them a detected strum sits on (arrival ± attributionWindowMs). */
  backingCounted: number;
}

export function evaluateBackingBleed(c: BackingBleedCase, t: Thresholds): OutcomeBleed {
  const r = renderBackingBleed(c, t);
  const fs = c.sampleRate;
  const bb = t.matrix.backingBleed;
  // The detector knows the backing it played: event times (scheduled + given RTT) and the buffer itself.
  const start = Math.round((c.backingStartS + c.rttGivenMs / 1000) * fs);
  const eventSamples = r.backing.events.map((e) => Math.round(e.time * fs));
  const beatS = 60 / c.bpm;
  const introEnd = BLEED_INTRO_BARS * 4 * beatS;
  const backing = {
    arrivals: eventSamples.map((s) => start + s),
    templateRises: backingTemplateRises(r.backing.signal, eventSamples, fs),
    introCount: r.backing.events.filter((e) => e.time < introEnd - 1e-6).length,
  };
  const detected = detectStrums(r.signal, fs, DEFAULT_ONSET_PARAMS, { backing }).map((e) => e.sample);
  const truth = r.truthSamples;
  const overlap = (bb.overlapExcludeMs / 1000) * fs;
  const attribution = (bb.attributionWindowMs / 1000) * fs;
  let isolated = 0;
  let counted = 0;
  r.backingArrivalSamples.forEach((a, j) => {
    if (r.backing.events[j]!.time < introEnd - 1e-6) return; // the intro is calibration, not judged
    if (truth.some((u) => Math.abs(u - a) <= overlap)) return;
    isolated++;
    if (detected.some((d) => Math.abs(d - a) <= attribution)) counted++;
  });
  return {
    mode: 'bleed',
    id: c.id,
    dims: {
      sampleRate: fs,
      model: c.model,
      snrDb: c.snrDb,
      micHighpassHz: c.micHighpassHz,
      reverb: c.reverb,
      voicing: c.voicingId,
      condition: `rel${Math.round(c.relDb / 5) * 5}`,
    },
    truthCount: truth.length,
    detectedCount: detected.filter((d) => d >= truth[0]! - 0.05 * fs).length,
    matched25: matchPairs(detected, truth, 0.025 * fs).size,
    isolatedBacking: isolated,
    backingCounted: counted,
  };
}

export type OutcomeV11 = OutcomeSeq | OutcomeCSet8 | OutcomeSwing | OutcomeBleed | OutcomeBeta;

export function evaluateV11Case(c: V11Case | BetaCase, t: Thresholds): OutcomeV11 {
  switch (c.mode) {
    case 'beta':
      return evaluateBeta(c, t);
    case 'seq':
      return evaluateSequence(c, t);
    case 'Cset8':
      return evaluateModeCSetStage8(c, t);
    case 'swing':
      return evaluateSwing(c, t);
    case 'bleed':
      return evaluateBackingBleed(c, t);
  }
}
