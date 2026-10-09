/**
 * v1.1 benchmark areas (SPEC v1.1 §14.8): single-note sequences, swing, backing bleed, Stage 8–11 chord-set
 * classification and the beta (report-only) conditions. Pure and deterministic per split, built on the same
 * stratified sampling and common channel parameters as the v1 areas (cases.ts).
 */
import { patternById, patternSlotTimes } from '../../src/content/patterns';
import { RIFFS, riffById, riffNotes } from '../../src/content/riffs';
import {
  chromaticGroups,
  positionMidi,
  type ScaleStep,
  scaleById,
  scaleStepSequence,
} from '../../src/content/scales';
import { deriveSeed, gaussian, mulberry32, pick, type Rng, uniform } from '../../src/domain/prng';
import {
  assignDims,
  type CommonParams,
  commonParams,
  dimsAt,
  type ModeDCase,
  type Split,
  type TimingStrum,
} from './cases';
import { balanced, stratified } from './sampling';
import type { Thresholds } from './thresholds';

export interface Position {
  string: number;
  fret: number;
}

export interface SequenceNoteSpec extends Position {
  /** True onset in the recording (s). */
  time: number;
  midi: number;
  kind: 'note' | 'wrong' | 'extra';
  legato?: boolean;
}

export interface SequenceCase extends CommonParams {
  mode: 'seq';
  shape: string;
  /** Scale step 1–5 (scale shapes only). */
  step: number | null;
  bpm: number;
  noteValue: 'quarter' | 'eighth';
  condition: string;
  rttMs: number;
  rttGivenMs: number;
  /** Expected notes on the scheduled grid (s, before RTT). */
  slots: (Position & { time: number; midi: number })[];
  /** What the synthesized player actually plays. */
  played: SequenceNoteSpec[];
  /** Slot index the defect touches (wrong / missed), or null. */
  defectSlot: number | null;
  /** True time of the inserted extra note (s), or null. */
  extraTime: number | null;
  durationS: number;
}

const SCALE_SHAPES = ['em-pent-open', 'c-major-open', 'am-pent-pos1'] as const;
const GRID_START_S = 1.0;
const TAIL_S = 1.0;

/** Positions of one cycle of a shape, plus every position of the whole exercise (for extra notes). */
export function shapeCycle(
  shape: string,
  step: number | null,
  seed: number,
  rng: Rng,
): { cycle: Position[]; pool: Position[] } {
  if ((SCALE_SHAPES as readonly string[]).includes(shape)) {
    const scale = scaleById(shape);
    const order = scaleStepSequence(scale, step as ScaleStep, seed);
    return { cycle: order.map((i) => scale.notes[i]!), pool: [...scale.notes] };
  }
  if (shape === 'chromatic') {
    const groups = chromaticGroups(1 + Math.floor(rng() * 5));
    return { cycle: pick(rng, groups), pool: groups.flat() };
  }
  const riff = riffById(shape);
  const notes = riffNotes(riff);
  const pool = [...new Map(notes.map((n) => [`${n.string}:${n.fret}`, n])).values()];
  return { cycle: notes, pool };
}

export function buildSequence(t: Thresholds, split: Split): SequenceCase[] {
  const range = t.splitSeeds[split];
  const m = t.matrix.sequence;
  const n = t.minimumTestSizes.sequenceCycles;
  const rng = mulberry32(deriveSeed(range[0], 'sequence'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  const shapes = balanced(m.shapes, n, rng);
  const conditions = balanced(m.conditions, n, rng);
  const noteValues = balanced(m.noteValues, n, rng);
  const bpms = stratified(m.bpm, n, rng);
  const rtts = stratified(m.rttMs, n, rng);
  // Steps are balanced inside the scale-shape cases only.
  const scaleIdx = shapes.flatMap((s, i) => ((SCALE_SHAPES as readonly string[]).includes(s) ? [i] : []));
  const stepList = balanced(m.scaleSteps, scaleIdx.length, rng);
  const steps = new Map(scaleIdx.map((i, k) => [i, stepList[k]!]));
  const out: SequenceCase[] = [];
  for (let i = 0; i < n; i++) {
    const common = commonParams(t, range, 'seq', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'sequence'));
    const shape = shapes[i]!;
    const step = steps.get(i) ?? null;
    const { cycle, pool } = shapeCycle(shape, step, deriveSeed(common.seed, 'step'), crng);
    const bpm = bpms[i]!;
    const noteValue = noteValues[i]!;
    const ioi = (noteValue === 'quarter' ? 60 : 30) / bpm;
    const rttMs = rtts[i]!;
    const rttGivenMs = rttMs + uniform(crng, -2, 2);
    const slots = cycle.map((p, k) => ({ ...p, time: GRID_START_S + k * ioi, midi: positionMidi(p) }));
    const human = () => rttMs / 1000 + (gaussian(crng) * m.humanJitterSdMs) / 1000;
    const played: SequenceNoteSpec[] = slots.map((s) => ({
      string: s.string,
      fret: s.fret,
      midi: s.midi,
      time: s.time + human(),
      kind: 'note',
    }));
    const condition = conditions[i]!;
    let defectSlot: number | null = null;
    let extraTime: number | null = null;
    if (condition === 'wrong+1' || condition === 'wrong-1') {
      const offset = condition === 'wrong+1' ? 1 : -1;
      const candidates = played.flatMap((p, k) => (p.fret + offset >= 0 ? [k] : []));
      defectSlot = pick(crng, candidates);
      const p = played[defectSlot]!;
      played[defectSlot] = { ...p, fret: p.fret + offset, midi: p.midi + offset, kind: 'wrong' };
    } else if (condition === 'missed') {
      defectSlot = 1 + Math.floor(crng() * (slots.length - 2));
      played.splice(defectSlot, 1);
    } else if (condition === 'extra') {
      const k = Math.floor(crng() * (slots.length - 1));
      const prev = slots[k]!;
      const others = pool.filter((p) => p.string !== prev.string);
      const extra = pick(crng, others.length ? others : pool);
      extraTime =
        (slots[k]!.time + slots[k + 1]!.time) / 2 +
        rttMs / 1000 +
        uniform(crng, -m.extraOffsetJitterMs, m.extraOffsetJitterMs) / 1000;
      played.splice(k + 1, 0, { ...extra, midi: positionMidi(extra), time: extraTime, kind: 'extra' });
    }
    out.push({
      ...common,
      mode: 'seq',
      shape,
      step,
      bpm,
      noteValue,
      condition,
      rttMs,
      rttGivenMs,
      slots,
      played,
      defectSlot,
      extraTime,
      durationS: (played.at(-1)?.time ?? GRID_START_S) + Math.min(2, ioi) + TAIL_S,
    });
  }
  return out;
}

export interface ModeCSetStage8Case extends CommonParams {
  mode: 'Cset8';
  /** Index into matrix.modeCSetStage8to11.sets. */
  setIdx: number;
  voicingId: string;
  spreadMs: number;
  direction: 'down' | 'up';
}

/** Stage 8–11 closed-set strums (§14.8): a stage set, then a voicing inside it, clean, SNR ≥ snrDbMin. */
export function buildModeCSetStage8(t: Thresholds, split: Split): ModeCSetStage8Case[] {
  const range = t.splitSeeds[split];
  const n = t.minimumTestSizes.modeCSetStage8to11Strums;
  const rng = mulberry32(deriveSeed(range[0], 'modeCSet8'));
  const snrs = t.matrix.snrDb.filter((s) => s >= t.synthetic.modeCSetStage8to11.snrDbMin!);
  const dims = assignDims(t, n, rng, snrs);
  const sets = t.matrix.modeCSetStage8to11.sets;
  const setIdx = balanced(
    sets.map((_, i) => i),
    n,
    rng,
  );
  const spreads = stratified(t.matrix.strumSpreadMs, n, rng);
  return setIdx.map((s, i) => {
    const common = commonParams(t, range, 'Cset8', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'set'));
    return {
      ...common,
      mode: 'Cset8',
      setIdx: s,
      voicingId: pick(crng, sets[s]!),
      spreadMs: spreads[i]!,
      direction: crng() < 0.75 ? 'down' : 'up',
    };
  });
}

/** Swing strum timing (§14.8): Mode D's sequence model on the P7/P8 shuffle grid, every slot strummed. */
export interface SwingCase extends Omit<ModeDCase, 'mode' | 'kind'> {
  mode: 'swing';
  kind: 'pattern';
  swingRatio: number;
}

const SWING_BARS = 4;

export function buildSwing(t: Thresholds, split: Split): SwingCase[] {
  const range = t.splitSeeds[split];
  const md = t.matrix.modeD;
  const sw = t.matrix.swing;
  const n = Math.ceil(t.minimumTestSizes.swingEvents / (SWING_BARS * 8));
  const rng = mulberry32(deriveSeed(range[0], 'swing'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  const patterns = balanced(sw.patterns, n, rng);
  const ratios = stratified(sw.swingRatio, n, rng);
  const bpms = stratified(sw.bpm, n, rng);
  const offsets = stratified(md.humanMeanOffsetMs, n, rng);
  const rtts = stratified(md.rttMs, n, rng);
  const bleed = balanced([true, false], n, rng);
  const voicingIds = balanced(t.matrix.voicings, n, rng);
  return Array.from({ length: n }, (_, i): SwingCase => {
    const common = commonParams(t, range, 'swing', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'timing'));
    const pattern = patternById(patterns[i]!);
    const bpm = bpms[i]!;
    const swingRatio = ratios[i]!;
    const rttMs = rtts[i]!;
    const gridStart = 1.0;
    const slots = patternSlotTimes(pattern, gridStart, bpm, SWING_BARS, swingRatio);
    const beatS = 60 / bpm;
    const clicks = Array.from({ length: SWING_BARS * 4 }, (_, b) => ({
      time: gridStart + b * beatS,
      accent: b % 4 === 0,
    }));
    const strums: TimingStrum[] = slots.map((slot, k) => ({
      time: slot.time + rttMs / 1000 + (offsets[i]! + gaussian(crng) * md.humanJitterSdMs) / 1000,
      slot: k,
      spreadMs: uniform(crng, t.matrix.strumSpreadMs[0], t.matrix.strumSpreadMs[1]),
      direction: pattern.slots[k % pattern.slots.length] === 'U' ? 'up' : 'down',
    }));
    return {
      ...common,
      mode: 'swing',
      kind: 'pattern',
      swingRatio,
      voicingId: voicingIds[i]!,
      patternId: pattern.id,
      bpm,
      bars: SWING_BARS,
      humanMeanOffsetMs: offsets[i]!,
      rttMs,
      rttGivenMs: rttMs + uniform(crng, -md.rttGivenToDetectorJitterMs, md.rttGivenToDetectorJitterMs),
      clickBleed: bleed[i]!,
      slots,
      clicks,
      strums,
      durationS: Math.max(strums.at(-1)!.time, slots.at(-1)!.time) + rttMs / 1000 + 1.0,
    };
  });
}

/**
 * Speaker backing bleed (§14.8): the user strums P0 (Mode D human model) while the backing (bass on beats 1
 * and 3 + P3 strums, same chord) leaks into the microphone at relDb re. the user strums, RTT-delayed.
 */
export interface BackingBleedCase extends CommonParams {
  mode: 'bleed';
  voicingId: string;
  bpm: number;
  bars: number;
  relDb: number;
  rttMs: number;
  rttGivenMs: number;
  humanMeanOffsetMs: number;
  /** Scheduled grid start of the user's bar 1 (s); the backing plays from `backingStartS`. */
  gridStartS: number;
  backingStartS: number;
  strums: TimingStrum[];
  clicks: { time: number; accent: boolean }[];
  durationS: number;
}

export const BLEED_BARS = 4;
/** One bar of backing alone before the user joins (the bleed level is learned from it, §10.12). */
export const BLEED_INTRO_BARS = 1;

export function buildBackingBleed(t: Thresholds, split: Split): BackingBleedCase[] {
  const range = t.splitSeeds[split];
  const md = t.matrix.modeD;
  const bb = t.matrix.backingBleed;
  // Isolated backing events per bar: P3 strums on slots 3, 5 and 7 (the user's P0 covers 0, 2, 4, 6).
  const n = Math.ceil(t.minimumTestSizes.backingBleedEvents / (3 * BLEED_BARS));
  const rng = mulberry32(deriveSeed(range[0], 'bleed'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  const rel = stratified(bb.relDb, n, rng);
  const bpms = stratified(md.bpm, n, rng);
  const offsets = stratified(md.humanMeanOffsetMs, n, rng);
  const rtts = stratified(md.rttMs, n, rng);
  const voicingIds = balanced(t.matrix.voicings, n, rng);
  const user = patternById(bb.userPattern);
  return Array.from({ length: n }, (_, i): BackingBleedCase => {
    const common = commonParams(t, range, 'bleed', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'timing'));
    const bpm = bpms[i]!;
    const beatS = 60 / bpm;
    const backingStartS = 1.0;
    const gridStartS = backingStartS + BLEED_INTRO_BARS * 4 * beatS;
    const rttMs = rtts[i]!;
    const slots = patternSlotTimes(user, gridStartS, bpm, BLEED_BARS);
    const strums: TimingStrum[] = slots.flatMap((slot, k) =>
      slot.expected
        ? [
            {
              time: slot.time + rttMs / 1000 + (offsets[i]! + gaussian(crng) * md.humanJitterSdMs) / 1000,
              slot: k,
              spreadMs: uniform(crng, t.matrix.strumSpreadMs[0], t.matrix.strumSpreadMs[1]),
              direction: 'down' as const,
            },
          ]
        : [],
    );
    const clicks = Array.from({ length: (BLEED_INTRO_BARS + BLEED_BARS) * 4 }, (_, b) => ({
      time: backingStartS + b * beatS,
      accent: b % 4 === 0,
    }));
    return {
      ...common,
      mode: 'bleed',
      voicingId: voicingIds[i]!,
      bpm,
      bars: BLEED_BARS,
      relDb: rel[i]!,
      rttMs,
      rttGivenMs: rttMs + uniform(crng, -md.rttGivenToDetectorJitterMs, md.rttGivenToDetectorJitterMs),
      humanMeanOffsetMs: offsets[i]!,
      gridStartS,
      backingStartS,
      strums,
      clicks,
      durationS: gridStartS + BLEED_BARS * 4 * beatS + rttMs / 1000 + 1.5,
    };
  });
}

export type V11Case = SequenceCase | ModeCSetStage8Case | SwingCase | BackingBleedCase;

export { patternById, patternSlotTimes, RIFFS };
