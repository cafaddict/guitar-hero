/**
 * Renders benchmark cases to audio (synth + channel model). Pure given the case.
 */
import { voicingById } from '../../src/content/voicings';
import { deriveSeed, mulberry32 } from '../../src/domain/prng';
import { STANDARD_TUNING } from '../../src/domain/theory';
import type { ChordVoicing } from '../../src/domain/voicing';
import { DEFAULT_RTT_PARAMS, rttProbe } from '../../src/dsp/rtt';
import { rms } from '../../src/dsp/spectrum';
import { applyChannel, type ChannelOutput } from '../../src/dsp/synth/channel';
import { renderClick } from '../../src/dsp/synth/click';
import { applyMuteEnvelope, type NoteSpec, randomTimbre, renderNote } from '../../src/dsp/synth/note';
import { normalizeNote, renderStrum, type StrumString } from '../../src/dsp/synth/strum';
import type {
  CommonParams,
  ModeACase,
  ModeBCase,
  ModeCCase,
  ModeCSetCase,
  ModeDCase,
  RttCase,
  TunerCase,
} from './cases';
import { playedF0 } from './cases';
import type { Thresholds } from './thresholds';

export const PRE_ROLL_S = 1.0;

function noteSpec(
  c: CommonParams,
  t: Thresholds,
  f0: number,
  durationS: number,
  seed: number,
  muted: boolean,
  fundamentalDb = 0,
): NoteSpec {
  return {
    model: c.model,
    f0,
    sampleRate: c.sampleRate,
    durationS,
    inharmonicityB: c.inharmonicityB,
    muted,
    mutedDecayDb: t.matrix.modeAMutedDecayDbIn120ms,
    mutedDecayMs: 120,
    fundamentalDb,
    ...randomTimbre(seed),
    seed,
  };
}

function channel(
  c: CommonParams,
  t: Thresholds,
  dry: Float32Array,
  onsetSample: number,
  extra?: Float32Array,
  snrOverride?: number | null,
): ChannelOutput {
  return applyChannel(
    dry,
    {
      sampleRate: c.sampleRate,
      snrDb: snrOverride === undefined ? c.snrDb : snrOverride,
      noiseColor: c.noiseColor,
      micHighpassHz: c.micHighpassHz,
      reverb: c.reverb,
      rt60S: t.matrix.smallRoomReverb.rt60S,
      drrDb: t.matrix.smallRoomReverb.drrDb,
      lowpass8k: c.lowpass8k,
      snrRef: { start: onsetSample, end: onsetSample + Math.round(0.5 * c.sampleRate) },
      targetPeak: 0.5,
      seed: deriveSeed(c.seed, 'channel'),
    },
    extra,
  );
}

export interface RenderedCase {
  signal: Float32Array;
  onsetSample: number;
}

export function renderModeA(c: ModeACase, t: Thresholds): RenderedCase {
  const v = voicingById(c.voicingId);
  const fret = (v.frets[c.stringIdx] as number) + c.fretOffset;
  const f0 = playedF0(c, c.stringIdx, fret);
  const onset = Math.round(PRE_ROLL_S * c.sampleRate);
  const note = renderNote(noteSpec(c, t, f0, 0.9, deriveSeed(c.seed, 'note'), c.muted, c.fundamentalDb));
  normalizeNote(note, c.sampleRate);
  applyMuteEnvelope(note, noteSpec(c, t, f0, 0.9, 0, c.muted));
  const dry = new Float32Array(onset + note.length + Math.round(0.2 * c.sampleRate));
  dry.set(note, onset);
  return { signal: channel(c, t, dry, onset).signal, onsetSample: onset };
}

function strumStrings(
  c: CommonParams,
  t: Thresholds,
  v: ChordVoicing,
  durationS: number,
  seedLabel: string,
  opts: {
    mutedIdx?: number | null;
    ringIdx?: number | null;
    fretShift?: { idx: number; offset: number } | null;
  },
): StrumString[] {
  const strings: StrumString[] = [];
  v.frets.forEach((f, idx) => {
    let fret: number | 'x' = f;
    if (opts.ringIdx === idx) fret = 0;
    if (fret === 'x') return;
    if (opts.fretShift && opts.fretShift.idx === idx) fret += opts.fretShift.offset;
    const seed = deriveSeed(c.seed, `${seedLabel}:${idx}`);
    strings.push({
      idx,
      note: noteSpec(c, t, playedF0(c, idx, fret), durationS, seed, opts.mutedIdx === idx),
      gainDb: c.stringGainDb[idx]!,
    });
  });
  return strings;
}

export function renderModeB(c: ModeBCase, t: Thresholds): RenderedCase {
  const v = voicingById(c.voicingId);
  const onset = Math.round(PRE_ROLL_S * c.sampleRate);
  const strum = renderStrum({
    strings: strumStrings(c, t, v, 1.0, 'B', {
      mutedIdx: c.condition.endsWith('muted') ? c.targetIdx : null,
      ringIdx: c.condition === 'x-string-ringing' ? c.targetIdx : null,
      fretShift:
        c.condition === 'wrong-fret-verifiable' && c.targetIdx !== null
          ? { idx: c.targetIdx, offset: c.fretOffset }
          : null,
    }),
    direction: c.direction,
    spreadMs: c.spreadMs,
    sampleRate: c.sampleRate,
  });
  const dry = new Float32Array(onset + strum.signal.length + Math.round(0.1 * c.sampleRate));
  dry.set(strum.signal, onset);
  return { signal: channel(c, t, dry, onset).signal, onsetSample: onset };
}

export function renderModeCSet(c: ModeCSetCase, t: Thresholds): RenderedCase {
  const v = voicingById(c.voicingId);
  const onset = Math.round(PRE_ROLL_S * c.sampleRate);
  const strum = renderStrum({
    strings: strumStrings(c, t, v, 0.8, 'Cset', {}),
    direction: c.direction,
    spreadMs: c.spreadMs,
    sampleRate: c.sampleRate,
  });
  const dry = new Float32Array(onset + strum.signal.length);
  dry.set(strum.signal, onset);
  return { signal: channel(c, t, dry, onset).signal, onsetSample: onset };
}

const OPEN: ChordVoicing = {
  id: 'open',
  symbol: 'open',
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [0, 0, 0, 0, 0, 0],
  baseFret: 1,
  stage: 0,
  tags: [],
};

/** Mixes a strum into `dry` at `atS`, damping the previous sound with a short fade when hands re-strike. */
function mixStrumAt(dry: Float32Array, strum: Float32Array, atSample: number): void {
  const end = Math.min(dry.length, atSample + strum.length);
  for (let i = atSample; i < end; i++) dry[i] = dry[i]! + strum[i - atSample]!;
}

/** Fades out everything after `atSample` (hand damping before a new strum) over `fadeSamples`. */
function dampAfter(dry: Float32Array, atSample: number, fadeSamples: number): void {
  for (let i = atSample; i < dry.length; i++) {
    const k = i - atSample;
    dry[i] = k < fadeSamples ? dry[i]! * (1 - k / fadeSamples) : 0;
  }
}

export function renderModeC(c: ModeCCase, t: Thresholds): RenderedCase {
  const fs = c.sampleRate;
  const dry = new Float32Array(Math.round(c.durationS * fs));
  c.events.forEach((e, k) => {
    const v = e.chord === 'open' ? OPEN : voicingById(c.pair[e.chord]);
    const next = c.events[k + 1]?.time ?? c.durationS;
    const durationS = Math.min(3, next - e.time + 0.3);
    const strum = renderStrum({
      strings: strumStrings(c, t, v, durationS, `C${k}`, { mutedIdx: e.mutedIdx }),
      direction: e.direction,
      spreadMs: e.spreadMs,
      sampleRate: fs,
    });
    const at = Math.round(e.time * fs);
    // The fretting hand releases the previous chord ~15 ms before the new strike.
    dampAfter(dry, Math.max(0, at - Math.round(0.015 * fs)), Math.round(0.015 * fs));
    mixStrumAt(dry, strum.signal, at);
  });
  const first = Math.round(c.events[0]!.time * fs);
  return { signal: channel(c, t, dry, first).signal, onsetSample: first };
}

export interface RenderedTiming extends RenderedCase {
  /** True strum onsets (samples) in the recording. */
  truthSamples: number[];
  /** Click arrival samples in the recording (scheduled + true RTT). */
  clickArrivalSamples: number[];
}

export function renderModeD(c: ModeDCase, t: Thresholds): RenderedTiming {
  const fs = c.sampleRate;
  const dry = new Float32Array(Math.round(c.durationS * fs));
  const v = voicingById(c.voicingId);
  const truth: number[] = [];
  c.strums.forEach((s, k) => {
    const next = c.strums[k + 1]?.time ?? c.durationS;
    const durationS =
      c.kind === 'sustain' ? t.matrix.modeD.sustainSeconds + 0.4 : Math.min(2.5, next - s.time + 0.25);
    const strum = renderStrum({
      strings: strumStrings(c, t, v, durationS, `D${k}`, {}),
      direction: s.direction,
      spreadMs: s.spreadMs,
      sampleRate: fs,
    });
    const at = Math.round(s.time * fs);
    if (k > 0) dampAfter(dry, Math.max(0, at - Math.round(0.01 * fs)), Math.round(0.01 * fs));
    mixStrumAt(dry, strum.signal, at);
    truth.push(at);
  });
  const clickArrivals = c.clicks.map((k) => Math.round((k.time + c.rttMs / 1000) * fs));
  let bleed: Float32Array | undefined;
  const firstOnset = truth[0] ?? Math.round(PRE_ROLL_S * fs);
  if (c.clickBleed) {
    bleed = new Float32Array(dry.length);
    const strumRms = rms(dry, firstOnset, firstOnset + Math.round(0.5 * fs));
    c.clicks.forEach((k, j) => {
      const click = renderClick(fs, k.accent);
      const clickRms = rms(click, 0, click.length);
      const gain = (strumRms * 10 ** (t.matrix.modeD.clickBleedRelDb / 20)) / (clickRms + 1e-12);
      const at = clickArrivals[j]!;
      for (let i = 0; i < click.length && at + i < bleed!.length; i++)
        bleed![at + i] = bleed![at + i]! + click[i]! * gain;
    });
  }
  const out = channel(c, t, dry, firstOnset, bleed);
  return {
    signal: out.signal,
    onsetSample: firstOnset,
    truthSamples: truth,
    clickArrivalSamples: clickArrivals,
  };
}

export function renderTuner(c: TunerCase, t: Thresholds): RenderedCase & { trueF0: number } {
  const fs = c.sampleRate;
  const trueF0 = 440 * 2 ** ((c.midi - 69 + c.detune / 100) / 12);
  const onset = Math.round(0.6 * fs);
  const note = renderNote(noteSpec(c, t, trueF0, 2.2, deriveSeed(c.seed, 'tuner'), false));
  normalizeNote(note, fs);
  const dry = new Float32Array(onset + note.length);
  dry.set(note, onset);
  return { signal: channel(c, t, dry, onset).signal, onsetSample: onset, trueF0 };
}

export interface RenderedRtt {
  signal: Float32Array;
  recordingStartS: number;
  scheduledS: number[];
}

export function renderRtt(c: RttCase, t: Thresholds): RenderedRtt {
  const fs = c.sampleRate;
  const scheduleStart = 0.5;
  const scheduledS = DEFAULT_RTT_PARAMS.offsetsS.map((o) => scheduleStart + o);
  const duration = scheduledS.at(-1)! + 1.0;
  const dry = new Float32Array(Math.round(duration * fs));
  const probe = rttProbe(fs);
  if (c.hasSignal) {
    for (const s of scheduledS) {
      const at = Math.round((s + c.latencyMs / 1000) * fs);
      for (let i = 0; i < probe.length && at + i < dry.length; i++) dry[at + i] = dry[at + i]! + probe[i]!;
    }
  }
  // SNR reference = the received burst itself (its own duration), as a loopback probe is short.
  const firstArrival = Math.round((scheduledS[0]! + c.latencyMs / 1000) * fs);
  const signal = c.hasSignal
    ? applyChannel(dry, {
        sampleRate: fs,
        snrDb: c.snrDb,
        noiseColor: c.noiseColor,
        micHighpassHz: c.micHighpassHz,
        reverb: c.reverb,
        rt60S: t.matrix.smallRoomReverb.rt60S,
        drrDb: t.matrix.smallRoomReverb.drrDb,
        lowpass8k: c.lowpass8k,
        snrRef: { start: firstArrival, end: firstArrival + probe.length },
        targetPeak: 0.5,
        seed: deriveSeed(c.seed, 'channel'),
      }).signal
    : (() => {
        // No loopback signal: only room noise at a typical level.
        const rng = mulberry32(deriveSeed(c.seed, 'silence'));
        const out = new Float32Array(dry.length);
        for (let i = 0; i < out.length; i++) out[i] = (rng() * 2 - 1) * 0.003;
        return out;
      })();
  return { signal, recordingStartS: 0, scheduledS };
}

export { STANDARD_TUNING };
