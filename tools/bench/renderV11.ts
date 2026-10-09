/**
 * Renders the v1.1 benchmark cases (SPEC v1.1 §14.8) with the shared synth and channel model. Pure.
 */

import { patternById } from '../../src/content/patterns';
import { voicingById } from '../../src/content/voicings';
import { deriveSeed } from '../../src/domain/prng';
import { rms } from '../../src/dsp/spectrum';
import { renderBacking } from '../../src/dsp/synth/backing';
import { applyChannel, type ChannelOutput } from '../../src/dsp/synth/channel';
import { renderSequence, type SequenceNote } from '../../src/dsp/synth/sequence';
import { renderStrum } from '../../src/dsp/synth/strum';
import type { CommonParams } from './cases';
import { playedF0 } from './cases';
import type { BackingBleedCase, ModeCSetStage8Case, SequenceCase } from './casesV11';
import { BLEED_BARS, BLEED_INTRO_BARS } from './casesV11';
import { dampAfter, mixStrumAt, noteSpec, type RenderedCase, renderModeCSet, strumStrings } from './render';
import type { Thresholds } from './thresholds';

/** Channel with the SNR measured over several reference ranges (mean RMS, §14.8 시퀀스 SNR). */
export function channelOver(
  c: CommonParams,
  t: Thresholds,
  dry: Float32Array,
  refs: readonly { start: number; end: number }[],
  extra?: Float32Array,
): ChannelOutput {
  return applyChannel(
    dry,
    {
      sampleRate: c.sampleRate,
      snrDb: c.snrDb,
      noiseColor: c.noiseColor,
      micHighpassHz: c.micHighpassHz,
      reverb: c.reverb,
      rt60S: t.matrix.smallRoomReverb.rt60S,
      drrDb: t.matrix.smallRoomReverb.drrDb,
      lowpass8k: c.lowpass8k,
      snrRef: refs[0] ?? { start: 0, end: dry.length },
      snrRefs: refs,
      targetPeak: 0.5,
      seed: deriveSeed(c.seed, 'channel'),
    },
    extra,
  );
}

export interface RenderedSequenceCase extends RenderedCase {
  /** True onset sample of every played note (in `c.played` order). */
  truthSamples: number[];
}

/** Each note's SNR window: [onset, onset + min(500 ms, IOI to the next note)]. */
export function noteSnrRefs(onsets: readonly number[], fs: number): { start: number; end: number }[] {
  const sorted = [...onsets].sort((a, b) => a - b);
  return sorted.map((s, k) => ({
    start: s,
    end: s + Math.min(Math.round(0.5 * fs), (sorted[k + 1] ?? Number.POSITIVE_INFINITY) - s),
  }));
}

export function renderSequenceCase(c: SequenceCase, t: Thresholds): RenderedSequenceCase {
  const fs = c.sampleRate;
  const notes: SequenceNote[] = c.played.map((p, k) => {
    const idx = 6 - p.string;
    const seed = deriveSeed(c.seed, `seq:${k}`);
    return {
      time: p.time,
      string: p.string,
      note: noteSpec(c, t, playedF0(c, idx, p.fret), 2.5, seed, false),
      gainDb: c.stringGainDb[idx]!,
      ...(p.legato ? { legato: true } : {}),
    };
  });
  const total = Math.round(c.durationS * fs);
  const { signal: dry, onsets } = renderSequence(notes, fs, total);
  const out = channelOver(c, t, dry, noteSnrRefs(onsets, fs));
  return { signal: out.signal, onsetSample: onsets[0] ?? 0, truthSamples: onsets };
}

/** Same rendering as the v1 classifySet strums (one clean strum after the pre-roll). */
export function renderModeCSetStage8(c: ModeCSetStage8Case, t: Thresholds): RenderedCase {
  return renderModeCSet({ ...c, mode: 'Cset' }, t);
}

export interface RenderedBleed extends RenderedCase {
  /** True user strum onsets (samples). */
  truthSamples: number[];
  /** The backing buffer as the app would play it (scheduled level) and its event times (s, buffer time). */
  backing: { signal: Float32Array; events: { time: number; kind: string }[] };
  /** Recording-time arrival (samples) of every backing event (scheduled + true RTT). */
  backingArrivalSamples: number[];
}

export function renderBackingBleed(c: BackingBleedCase, t: Thresholds): RenderedBleed {
  const fs = c.sampleRate;
  const dry = new Float32Array(Math.round(c.durationS * fs));
  const v = voicingById(c.voicingId);
  const truth: number[] = [];
  c.strums.forEach((s, k) => {
    const next = c.strums[k + 1]?.time ?? c.durationS;
    const strum = renderStrum({
      strings: strumStrings(c, t, v, Math.min(2.5, next - s.time + 0.25), `U${k}`, {}),
      direction: s.direction,
      spreadMs: s.spreadMs,
      sampleRate: fs,
    });
    const at = Math.round(s.time * fs);
    if (k > 0) dampAfter(dry, Math.max(0, at - Math.round(0.01 * fs)), Math.round(0.01 * fs));
    mixStrumAt(dry, strum.signal, at);
    truth.push(at);
  });
  const backing = renderBacking({
    chords: [v],
    pattern: patternById(t.matrix.backingBleed.backingPattern),
    bpm: c.bpm,
    bars: BLEED_INTRO_BARS + BLEED_BARS,
    sampleRate: fs,
    model: c.model,
    seed: deriveSeed(c.seed, 'backing'),
  });
  // Backing level: its first event's 500 ms RMS sits relDb below the user's first strum's.
  const userRms = rms(dry, truth[0]!, truth[0]! + Math.round(0.5 * fs));
  const backingRms = rms(backing.signal, 0, Math.round(0.5 * fs));
  const gain = (userRms * 10 ** (c.relDb / 20)) / (backingRms + 1e-12);
  const offset = Math.round((c.backingStartS + c.rttMs / 1000) * fs);
  const bleed = new Float32Array(dry.length);
  for (let i = 0; i < backing.signal.length && offset + i < bleed.length; i++)
    bleed[offset + i] = backing.signal[i]! * gain;
  const out = channelOver(c, t, dry, [{ start: truth[0]!, end: truth[0]! + Math.round(0.5 * fs) }], bleed);
  return {
    signal: out.signal,
    onsetSample: truth[0]!,
    truthSamples: truth,
    backing,
    backingArrivalSamples: backing.events.map((e) => offset + Math.round(e.time * fs)),
  };
}
