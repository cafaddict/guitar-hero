/**
 * Benchmark case generation (SPEC §14.3). Pure and deterministic per split: dev seeds 1000–1999,
 * test seeds 9000–9999 (from thresholds.json). Every matrix set value appears in balanced proportion and
 * every continuous range is stratified; impossible combinations are excluded and counted (§14.3-5).
 */

import { patternById, STRUM_PATTERNS } from '../../src/content/patterns';
import { voicingById } from '../../src/content/voicings';
import { CORE_PAIRS } from '../../src/domain/pairs';
import { deriveSeed, gaussian, mulberry32, pick, type Rng, uniform } from '../../src/domain/prng';
import { midiToHz, nameToMidi, STANDARD_TUNING } from '../../src/domain/theory';
import { type ChordVoicing, expectedNotes, partialCollisionMap } from '../../src/domain/voicing';
import type { NoiseColor, ReverbKind } from '../../src/dsp/synth/channel';
import type { SynthModel } from '../../src/dsp/synth/note';
import { balanced, perCondition, stratified } from './sampling';
import type { Thresholds } from './thresholds';

export type Split = 'dev' | 'test';

export interface CommonParams {
  id: string;
  seed: number;
  /** Split seed (inside thresholds.splitSeeds[split]) this case derives from. */
  baseSeed: number;
  sampleRate: number;
  model: SynthModel;
  inharmonicityB: number;
  snrDb: number;
  micHighpassHz: number;
  reverb: ReverbKind;
  noiseColor: NoiseColor;
  lowpass8k: boolean;
  /** Per-string gain jitter (dB, ±stringGainJitterDb). */
  stringGainDb: number[];
  /** Actual per-string tuning offset (cents, ±detuneCentsMax). */
  detuneCents: number[];
  /** Calibration δ handed to the detector = detune + residual (±calibrationResidualCentsMax). */
  deltaGivenCents: number[];
}

export interface ModeACase extends CommonParams {
  mode: 'A';
  condition: string;
  voicingId: string;
  stringIdx: number;
  fretOffset: number;
  muted: boolean;
  fundamentalDb: number;
}

export interface ModeBCase extends CommonParams {
  mode: 'B';
  condition: string;
  voicingId: string;
  /** String muted / rung / mis-fretted by the condition (null for clean). */
  targetIdx: number | null;
  fretOffset: number;
  spreadMs: number;
  direction: 'down' | 'up';
}

export interface StrumEventSpec {
  time: number;
  chord: 0 | 1 | 'open';
  kind: 'first' | 'arrival' | 'same' | 'open';
  mutedIdx: number | null;
  spreadMs: number;
  direction: 'down' | 'up';
}

export interface ModeCCase extends CommonParams {
  mode: 'C';
  pair: [string, string];
  changesPerMin: number;
  events: StrumEventSpec[];
  truthChanges: number;
  durationS: number;
}

export interface ModeCSetCase extends CommonParams {
  mode: 'Cset';
  voicingId: string;
  spreadMs: number;
  direction: 'down' | 'up';
}

export interface TimingStrum {
  /** True time of the first string's onset in the recording (s). */
  time: number;
  slot: number;
  spreadMs: number;
  direction: 'down' | 'up';
}

export interface ModeDCase extends CommonParams {
  mode: 'D';
  kind: 'pattern' | 'sustain';
  voicingId: string;
  patternId: string;
  bpm: number;
  bars: number;
  humanMeanOffsetMs: number;
  rttMs: number;
  rttGivenMs: number;
  clickBleed: boolean;
  /** Scheduled grid time (s) and whether the pattern expects a strum there. */
  slots: { time: number; expected: boolean }[];
  /** Click times on the grid (s, scheduled) — one per beat, accent on beat 1. */
  clicks: { time: number; accent: boolean }[];
  strums: TimingStrum[];
  durationS: number;
}

export interface TunerCase extends CommonParams {
  mode: 'tuner';
  midi: number;
  detune: number;
}

export interface RttCase extends CommonParams {
  mode: 'rtt';
  latencyMs: number;
  hasSignal: boolean;
}

export type BenchCase = ModeACase | ModeBCase | ModeCCase | ModeCSetCase | ModeDCase | TunerCase | RttCase;

export interface CaseSet {
  split: Split;
  modeA: ModeACase[];
  modeB: ModeBCase[];
  modeC: ModeCCase[];
  modeCSet: ModeCSetCase[];
  modeD: ModeDCase[];
  tuner: TunerCase[];
  rtt: RttCase[];
  excluded: Record<string, number>;
}

/** Which split seed a case index maps to. */
export function baseSeedFor(range: readonly [number, number], index: number): number {
  return range[0] + (index % (range[1] - range[0] + 1));
}

export const BEGINNER_CLASSES = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G'] as const;

function commonParams(
  t: Thresholds,
  range: readonly [number, number],
  mode: string,
  i: number,
  dims: {
    sampleRate: number;
    model: SynthModel;
    b: number;
    snr: number;
    hpf: number;
    reverb: ReverbKind;
    noise: NoiseColor;
  },
): CommonParams {
  const baseSeed = baseSeedFor(range, i);
  const seed = deriveSeed(baseSeed, `${mode}:${i}`);
  const rng = mulberry32(deriveSeed(seed, 'common'));
  const m = t.matrix;
  const detune = Array.from({ length: 6 }, () => uniform(rng, -m.detuneCentsMax, m.detuneCentsMax));
  return {
    id: `${mode}-${i}`,
    seed,
    baseSeed,
    sampleRate: dims.sampleRate,
    model: dims.model,
    inharmonicityB: dims.b,
    snrDb: dims.snr,
    micHighpassHz: dims.hpf,
    reverb: dims.reverb,
    noiseColor: dims.noise,
    lowpass8k: rng() < 0.25,
    stringGainDb: Array.from({ length: 6 }, () => uniform(rng, -m.stringGainJitterDb, m.stringGainJitterDb)),
    detuneCents: detune,
    deltaGivenCents: detune.map(
      (d) => d + uniform(rng, -m.calibrationResidualCentsMax, m.calibrationResidualCentsMax),
    ),
  };
}

interface DimAssignment {
  sampleRate: number[];
  model: SynthModel[];
  b: number[];
  snr: number[];
  hpf: number[];
  reverb: ReverbKind[];
  noise: NoiseColor[];
}

function assignDims(
  t: Thresholds,
  n: number,
  rng: Rng,
  snrValues: readonly number[],
  reverbValues: readonly ReverbKind[] = t.matrix.reverb,
): DimAssignment {
  return {
    sampleRate: balanced(t.matrix.sampleRates, n, rng),
    model: balanced(t.matrix.synthModels, n, rng),
    b: stratified(t.matrix.additiveInharmonicityB, n, rng, true),
    snr: balanced(snrValues, n, rng),
    hpf: balanced(t.matrix.micHighpassHz, n, rng),
    reverb: balanced(reverbValues, n, rng),
    noise: balanced(['white', 'pink'] as NoiseColor[], n, rng),
  };
}

function dimsAt(d: DimAssignment, i: number) {
  return {
    sampleRate: d.sampleRate[i]!,
    model: d.model[i]!,
    b: d.b[i]!,
    snr: d.snr[i]!,
    hpf: d.hpf[i]!,
    reverb: d.reverb[i]!,
    noise: d.noise[i]!,
  };
}

const playedIdx = (v: ChordVoicing) => v.frets.flatMap((f, i) => (f === 'x' ? [] : [i]));

function soundingMidis(v: ChordVoicing, override?: { idx: number; fret: number }): number[] {
  return v.frets.flatMap((f, i) => {
    const fret = override && override.idx === i ? override.fret : f;
    return fret === 'x' ? [] : [STANDARD_TUNING.openMidi[i]! + fret];
  });
}

// ---------------------------------------------------------------------------------------------- Mode A

function buildModeA(t: Thresholds, split: Split, excluded: Record<string, number>): ModeACase[] {
  const range = t.splitSeeds[split];
  const conditions = t.matrix.modeAConditions;
  const per = perCondition(t.minimumTestSizes.modeA, conditions.length);
  const n = per * conditions.length;
  const rng = mulberry32(deriveSeed(range[0], 'modeA'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  const condList = balanced(conditions, n, rng);
  const voicings = balanced(t.matrix.voicings, n, rng);
  // Count impossible (voicing, string) combinations once per condition: open strings cannot go lower.
  for (const condition of conditions) {
    const offset = { 'wrong-1': -1, 'wrong-2': -2 }[condition] ?? 0;
    if (offset === 0) continue;
    for (const id of t.matrix.voicings) {
      const v = voicingById(id);
      const impossible = playedIdx(v).filter((s) => (v.frets[s] as number) + offset < 0).length;
      if (impossible > 0) excluded[`A:${condition}`] = (excluded[`A:${condition}`] ?? 0) + impossible;
    }
  }
  const out: ModeACase[] = [];
  for (let i = 0; i < n; i++) {
    const condition = condList[i]!;
    const common = commonParams(t, range, 'A', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'case'));
    let voicing = voicingById(voicings[i]!);
    const fretOffset = { 'wrong+1': 1, 'wrong-1': -1, 'wrong+2': 2, 'wrong-2': -2 }[condition] ?? 0;
    const valid = (v: ChordVoicing) => playedIdx(v).filter((s) => (v.frets[s] as number) + fretOffset >= 0);
    while (valid(voicing).length === 0) voicing = voicingById(pick(crng, t.matrix.voicings));
    const stringIdx = pick(crng, valid(voicing));
    out.push({
      ...common,
      mode: 'A',
      condition,
      voicingId: voicing.id,
      stringIdx,
      fretOffset,
      muted: condition === 'muted',
      fundamentalDb: condition === 'weak-fundamental' ? t.matrix.modeAWeakFundamentalDb : 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- Mode B

/** Strings that are verifiable / dependent under the default rule for a voicing (calibrated δ = 0). */
function verifiability(v: ChordVoicing): { verifiable: number[]; dependent: number[] } {
  const map = partialCollisionMap(v, STANDARD_TUNING);
  return {
    verifiable: map.filter((m) => m.verifiable).map((m) => m.idx),
    dependent: map.filter((m) => !m.verifiable).map((m) => m.idx),
  };
}

/** x strings that would be verifiable if they rang open, excluding same-note duplicates (§14.3-5). */
export function ringableXStrings(v: ChordVoicing): number[] {
  return v.frets.flatMap((f, idx) => {
    if (f !== 'x') return [];
    const augmented: ChordVoicing = { ...v, frets: v.frets.map((x, i) => (i === idx ? 0 : x)) };
    const openMidi = STANDARD_TUNING.openMidi[idx]!;
    if (soundingMidis(v).includes(openMidi)) return [];
    const entry = partialCollisionMap(augmented, STANDARD_TUNING).find((m) => m.idx === idx);
    return entry?.verifiable ? [idx] : [];
  });
}

function wrongFretTargets(v: ChordVoicing, offset: number): number[] {
  const { verifiable } = verifiability(v);
  return verifiable.filter((idx) => {
    const fret = (v.frets[idx] as number) + offset;
    const midi = STANDARD_TUNING.openMidi[idx]! + fret;
    // Exclude when the wrong note duplicates another string's note (same pitch on another string).
    return !soundingMidis(v).some((m, j) => m === midi && playedIdx(v)[j] !== idx);
  });
}

function buildModeB(t: Thresholds, split: Split, excluded: Record<string, number>): ModeBCase[] {
  const range = t.splitSeeds[split];
  const conditions = t.matrix.modeBConditions;
  // Most Mode B metrics are judged only at SNR ≥ detectionStrataSnrDbMin (§14.3-7), so each condition gets the
  // per-condition minimum *inside* those strata, with SNR balanced per condition.
  const judgedSnrs = t.matrix.snrDb.filter((x) => x >= t.synthetic.modeB.detectionStrataSnrDbMin!);
  const per = Math.ceil(
    (perCondition(t.minimumTestSizes.modeB, conditions.length) * t.matrix.snrDb.length) / judgedSnrs.length,
  );
  const n = per * conditions.length;
  const rng = mulberry32(deriveSeed(range[0], 'modeB'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  const condList = balanced(conditions, n, rng);
  for (const condition of conditions) {
    const indices = condList.flatMap((c, i) => (c === condition ? [i] : []));
    const snrs = balanced(t.matrix.snrDb, indices.length, rng);
    indices.forEach((i, k) => {
      dims.snr[i] = snrs[k]!;
    });
  }
  const voicingIds = balanced(t.matrix.voicings, n, rng);
  const spreads = stratified(t.matrix.strumSpreadMs, n, rng);
  const out: ModeBCase[] = [];
  const targetsFor = (v: ChordVoicing, condition: string, offset: number): number[] | null => {
    switch (condition) {
      case 'clean':
        return null;
      case 'verifiable-muted':
        return verifiability(v).verifiable;
      case 'dependent-muted':
        return verifiability(v).dependent;
      case 'x-string-ringing':
        return ringableXStrings(v);
      case 'wrong-fret-verifiable':
        return wrongFretTargets(v, offset);
      default:
        throw new Error(`unknown Mode B condition ${condition}`);
    }
  };
  // Count excluded (voicing, condition) combinations once.
  for (const condition of conditions) {
    const offsets = condition === 'wrong-fret-verifiable' ? [1, 2] : [0];
    for (const id of t.matrix.voicings) {
      for (const offset of offsets) {
        const targets = targetsFor(voicingById(id), condition, offset);
        if (targets !== null && targets.length === 0)
          excluded[`B:${condition}`] = (excluded[`B:${condition}`] ?? 0) + 1;
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const condition = condList[i]!;
    const common = commonParams(t, range, 'B', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'case'));
    const fretOffset = condition === 'wrong-fret-verifiable' ? (crng() < 0.5 ? 1 : 2) : 0;
    let voicing = voicingById(voicingIds[i]!);
    let targets = targetsFor(voicing, condition, fretOffset);
    while (targets !== null && targets.length === 0) {
      voicing = voicingById(pick(crng, t.matrix.voicings));
      targets = targetsFor(voicing, condition, fretOffset);
    }
    out.push({
      ...common,
      mode: 'B',
      condition,
      voicingId: voicing.id,
      targetIdx: targets === null ? null : pick(crng, targets),
      fretOffset,
      spreadMs: spreads[i]!,
      direction: crng() < 0.7 ? 'down' : 'up',
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- Mode C

function pairVoicings(rng: Rng): [string, string][] {
  const out: [string, string][] = [];
  for (const [a, b] of CORE_PAIRS) {
    for (const g of ['G-2f', 'G-3f']) {
      const resolve = (c: string) => (c === 'G' ? g : c);
      out.push([resolve(a), resolve(b)]);
      if (a !== 'G' && b !== 'G') break;
    }
  }
  void rng;
  return out;
}

function buildModeC(t: Thresholds, split: Split): ModeCCase[] {
  const range = t.splitSeeds[split];
  const n = t.minimumTestSizes.modeCSequences;
  const rng = mulberry32(deriveSeed(range[0], 'modeC'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  // 25 pairs, G pairs split evenly between the two G voicings.
  const pairs = balanced(pairVoicings(rng), n, rng);
  const cpms = stratified(t.matrix.modeC.changesPerMin, n, rng);
  const spec = t.matrix.modeC;
  const out: ModeCCase[] = [];
  for (let i = 0; i < n; i++) {
    const common = commonParams(t, range, 'C', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'sequence'));
    const pair = pairs[i]!;
    const cpm = cpms[i]!;
    const interval = 60 / cpm;
    const start = 1.0;
    const end = start + spec.sequenceSeconds;
    const events: StrumEventSpec[] = [];
    const strum = (
      time: number,
      chord: 0 | 1 | 'open',
      kind: StrumEventSpec['kind'],
      muted: boolean,
    ): StrumEventSpec => {
      const played = chord === 'open' ? [0, 1, 2, 3, 4, 5] : playedIdx(voicingById(pair[chord]));
      return {
        time,
        chord,
        kind,
        mutedIdx: muted ? pick(crng, played) : null,
        spreadMs: uniform(crng, t.matrix.strumSpreadMs[0], t.matrix.strumSpreadMs[1]),
        direction: crng() < 0.75 ? 'down' : 'up',
      };
    };
    events.push(strum(start, 0, 'first', false));
    let current: 0 | 1 = 0;
    let time = start;
    let truth = 0;
    for (;;) {
      const next = time + interval * uniform(crng, 0.9, 1.1);
      if (next > end - 0.25) break;
      // Optional extras between arrivals, each ≥ 0.35 s from its neighbours.
      const gap = next - time;
      const extras: { at: number; kind: 'same' | 'open' }[] = [];
      if (crng() < spec.extraSameChordStrumProb && gap >= 0.8)
        extras.push({ at: time + gap * uniform(crng, 0.35, 0.45), kind: 'same' });
      if (crng() < spec.openStringsBetweenProb && gap >= 0.8)
        extras.push({ at: time + gap * uniform(crng, 0.6, 0.7), kind: 'open' });
      for (const e of extras) {
        if (e.at - (events.at(-1)?.time ?? 0) < 0.35 || next - e.at < 0.35) continue;
        events.push(
          e.kind === 'same' ? strum(e.at, current, 'same', false) : strum(e.at, 'open', 'open', false),
        );
      }
      current = current === 0 ? 1 : 0;
      events.push(strum(next, current, 'arrival', crng() < spec.mutedStringArrivalProb));
      truth++;
      time = next;
    }
    out.push({
      ...common,
      mode: 'C',
      pair,
      changesPerMin: cpm,
      events,
      truthChanges: truth,
      durationS: end + 1.5,
    });
  }
  return out;
}

function buildModeCSet(t: Thresholds, split: Split): ModeCSetCase[] {
  const range = t.splitSeeds[split];
  const n = t.minimumTestSizes.modeCSetStrums;
  const rng = mulberry32(deriveSeed(range[0], 'modeCSet'));
  const snrs = t.matrix.snrDb.filter((s) => s >= t.synthetic.modeCSet.snrDbMin!);
  const dims = assignDims(t, n, rng, snrs);
  const ids = balanced(['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G-2f', 'G-3f'], n, rng);
  const spreads = stratified(t.matrix.strumSpreadMs, n, rng);
  return ids.map((voicingId, i) => {
    const common = commonParams(t, range, 'Cset', i, dimsAt(dims, i));
    return {
      ...common,
      mode: 'Cset',
      voicingId,
      spreadMs: spreads[i]!,
      direction: mulberry32(common.seed)() < 0.75 ? 'down' : 'up',
    };
  });
}

// ---------------------------------------------------------------------------------------------- Mode D

const MISS_PROB = 0.06;
const EXTRA_PROB = 0.12;
const PATTERN_BARS = 4;

function buildModeD(t: Thresholds, split: Split): ModeDCase[] {
  const range = t.splitSeeds[split];
  const md = t.matrix.modeD;
  // Pattern sequences: enough events for minimumTestSizes.modeDEvents (≈ 4 bars × ~5 strums).
  const nPattern = Math.ceil(t.minimumTestSizes.modeDEvents / 18);
  const nSustain = 400;
  const n = nPattern + nSustain;
  const rng = mulberry32(deriveSeed(range[0], 'modeD'));
  const dims = assignDims(t, n, rng, t.matrix.snrDb);
  const patterns = balanced(
    STRUM_PATTERNS.map((p) => p.id),
    n,
    rng,
  );
  const bpms = stratified(md.bpm, n, rng);
  const offsets = stratified(md.humanMeanOffsetMs, n, rng);
  const rtts = stratified(md.rttMs, n, rng);
  const bleed = balanced([true, false], nPattern, rng);
  const voicingIds = balanced(t.matrix.voicings, n, rng);
  const out: ModeDCase[] = [];
  for (let i = 0; i < n; i++) {
    const kind = i < nPattern ? 'pattern' : 'sustain';
    const common = commonParams(t, range, 'D', i, dimsAt(dims, i));
    const crng = mulberry32(deriveSeed(common.seed, 'timing'));
    const pattern = patternById(patterns[i]!);
    const bpm = bpms[i]!;
    const rttMs = rtts[i]!;
    const rttGivenMs = rttMs + uniform(crng, -md.rttGivenToDetectorJitterMs, md.rttGivenToDetectorJitterMs);
    const meanOffset = offsets[i]!;
    const gridStart = 1.0;
    const beatS = 60 / bpm;
    const slotsPerBeat = pattern.timeSignature === '6/8' ? 3 : 2;
    const slotS = beatS / slotsPerBeat;
    const beatsPerBar = pattern.timeSignature === '6/8' ? 2 : 4;
    const slots: ModeDCase['slots'] = [];
    const clicks: ModeDCase['clicks'] = [];
    const strums: TimingStrum[] = [];
    if (kind === 'pattern') {
      for (let bar = 0; bar < PATTERN_BARS; bar++) {
        for (const [j, s] of pattern.slots.entries()) {
          slots.push({ time: gridStart + (bar * pattern.slots.length + j) * slotS, expected: s !== '-' });
        }
        for (let b = 0; b < beatsPerBar; b++)
          clicks.push({ time: gridStart + (bar * beatsPerBar + b) * beatS, accent: b === 0 });
      }
      slots.forEach((slot, k) => {
        const humanTime =
          slot.time + rttMs / 1000 + (meanOffset + gaussian(crng) * md.humanJitterSdMs) / 1000;
        const play = slot.expected ? crng() >= MISS_PROB : crng() < EXTRA_PROB;
        if (!play) return;
        const symbol = pattern.slots[k % pattern.slots.length]!;
        strums.push({
          time: humanTime,
          slot: k,
          spreadMs: uniform(crng, t.matrix.strumSpreadMs[0], t.matrix.strumSpreadMs[1]),
          direction: symbol === 'U' ? 'up' : 'down',
        });
      });
      // Keep strums in time order and ≥ 70 ms apart (a hand cannot strum faster than the min IOI).
      strums.sort((a, b) => a.time - b.time);
      for (let k = strums.length - 1; k > 0; k--)
        if (strums[k]!.time - strums[k - 1]!.time < 0.07) strums.splice(k, 1);
    } else {
      strums.push({
        time: gridStart,
        slot: 0,
        spreadMs: uniform(crng, t.matrix.strumSpreadMs[0], t.matrix.strumSpreadMs[1]),
        direction: 'down',
      });
    }
    const last = strums.at(-1)?.time ?? gridStart;
    const durationS =
      kind === 'sustain'
        ? gridStart + md.sustainSeconds + 0.5
        : Math.max(last, slots.at(-1)?.time ?? 0) + rttMs / 1000 + 1.0;
    out.push({
      ...common,
      mode: 'D',
      kind,
      voicingId: voicingIds[i]!,
      patternId: pattern.id,
      bpm,
      bars: kind === 'pattern' ? PATTERN_BARS : 0,
      humanMeanOffsetMs: meanOffset,
      rttMs,
      rttGivenMs,
      clickBleed: kind === 'pattern' ? bleed[i]! : false,
      slots,
      clicks,
      strums,
      durationS,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- Tuner, RTT

function buildTuner(t: Thresholds, split: Split): TunerCase[] {
  const range = t.splitSeeds[split];
  const n = t.minimumTestSizes.tuner;
  const rng = mulberry32(deriveSeed(range[0], 'tuner'));
  const snrs = t.matrix.snrDb.filter((s) => s >= t.matrix.tuner.snrDbMin);
  const dims = assignDims(t, n, rng, snrs);
  const lo = nameToMidi(t.matrix.tuner.noteRange[0]);
  const hi = nameToMidi(t.matrix.tuner.noteRange[1]);
  const midis = balanced(
    Array.from({ length: hi - lo + 1 }, (_, k) => lo + k),
    n,
    rng,
  );
  const detunes = stratified([-t.matrix.tuner.detuneCentsMax, t.matrix.tuner.detuneCentsMax], n, rng);
  return midis.map((midi, i) => ({
    ...commonParams(t, range, 'tuner', i, dimsAt(dims, i)),
    mode: 'tuner',
    midi,
    detune: detunes[i]!,
  }));
}

function buildRtt(t: Thresholds, split: Split): RttCase[] {
  const range = t.splitSeeds[split];
  const nSignal = t.minimumTestSizes.rtt;
  const nSilent = 60;
  const n = nSignal + nSilent;
  const rng = mulberry32(deriveSeed(range[0], 'rtt'));
  const snrs = stratified([t.matrix.rtt.snrDbMin, 40], n, rng);
  const dims = assignDims(t, n, rng, [0], t.matrix.rtt.reverb);
  const latencies = stratified(t.matrix.rtt.latencyMs, n, rng);
  return Array.from({ length: n }, (_, i) => {
    const common = commonParams(t, range, 'rtt', i, { ...dimsAt(dims, i), snr: snrs[i]! });
    return { ...common, mode: 'rtt', latencyMs: latencies[i]!, hasSignal: i < nSignal };
  });
}

export function buildCases(t: Thresholds, split: Split): CaseSet {
  const excluded: Record<string, number> = {};
  return {
    split,
    modeA: buildModeA(t, split, excluded),
    modeB: buildModeB(t, split, excluded),
    modeC: buildModeC(t, split),
    modeCSet: buildModeCSet(t, split),
    modeD: buildModeD(t, split),
    tuner: buildTuner(t, split),
    rtt: buildRtt(t, split),
    excluded,
  };
}

/** f0 actually played on a string (with its tuning offset). */
export function playedF0(c: CommonParams, idx: number, fret: number): number {
  return midiToHz(STANDARD_TUNING.openMidi[idx]! + fret) * 2 ** (c.detuneCents[idx]! / 1200);
}

export { expectedNotes };
