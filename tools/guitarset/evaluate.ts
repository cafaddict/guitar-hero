/**
 * Per-clip GuitarSet evaluation (SPEC §14.4). Runs the same detectors as the app on the real recording:
 * onset detection on the whole clip, then Mode A on isolated single notes, Mode B/C on isolated strums and
 * strum-level onset F1 on comp clips.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deriveSeed, mulberry32, pick } from '../../src/domain/prng';
import { midiToHz, STANDARD_TUNING } from '../../src/domain/theory';
import { type ChordVoicing, partialCollisionMap } from '../../src/domain/voicing';
import { verifyPluck } from '../../src/dsp/modeA';
import { verifyStrum } from '../../src/dsp/modeB';
import { classifyPair } from '../../src/dsp/modeC';
import { detectStrums, type StrumEvent } from '../../src/dsp/onset';
import { decodeWav, toMono } from '../../src/dsp/wav';
import {
  type ClipInfo,
  type EventFilters,
  onsetTruth,
  parseJams,
  singleEvents,
  stringOffsetsCents,
  strumEvents,
} from './jams';

export interface ClipTask {
  info: ClipInfo;
  jamsPath: string;
  wavPath: string;
  filters: EventFilters;
  excludeGenresFromF1: string[];
  seed: number;
}

export interface ClipOutcome {
  id: string;
  player: string;
  genre: string;
  kind: 'comp' | 'solo';
  /** Mode A on single notes: OK with the true note / OK with the note ±1 semitone (false accept). */
  singles: { ok: boolean; perturbedOk: boolean; status: string; cents: number | null; midi: number }[];
  /** Mode C 2-way: true voicing vs another event's voicing with a different pitch-class set. */
  pairs: { correct: boolean; margin: number }[];
  /** Mode B: verdict with the true voicing; and whether the +1/+2-fret-perturbed verifiable string was OK. */
  strums: { verdict: string; perturbedStringOk: boolean | null; blamed: number[] }[];
  /** Onset F1 counts (±50 ms), null when the clip is excluded (solo or excluded genre). */
  f1: { tp: number; detected: number; truth: number } | null;
}

function voicingFromMidis(midis: readonly (number | null)[], id: string): ChordVoicing | null {
  const frets = midis.map((m, idx) => (m === null ? 'x' : m - STANDARD_TUNING.openMidi[idx]!));
  if (frets.some((f) => typeof f === 'number' && (f < 0 || f > 22))) return null;
  return {
    id,
    symbol: 'unknown',
    frets,
    fingers: frets.map((f) => (f === 'x' ? null : f === 0 ? 0 : 1)),
    baseFret: 1,
    stage: 0,
    tags: [],
  };
}

function nearest(events: readonly StrumEvent[], sample: number, tol: number): StrumEvent | null {
  let best: StrumEvent | null = null;
  for (const e of events)
    if (
      Math.abs(e.sample - sample) <= tol &&
      (!best || Math.abs(e.sample - sample) < Math.abs(best.sample - sample))
    )
      best = e;
  return best;
}

function segment(
  signal: Float32Array,
  onset: number,
  fs: number,
): { samples: Float32Array; onsetSample: number } {
  const start = Math.max(0, onset - Math.round(0.5 * fs));
  return {
    samples: signal.slice(start, Math.min(signal.length, onset + Math.round(0.4 * fs))),
    onsetSample: onset - start,
  };
}

const pitchClasses = (midis: readonly (number | null)[]) =>
  [...new Set(midis.filter((m): m is number => m !== null).map((m) => ((m % 12) + 12) % 12))]
    .sort((a, b) => a - b)
    .join(',');

export function evaluateClip(task: ClipTask): ClipOutcome {
  const parsed = parseJams(JSON.parse(readFileSync(task.jamsPath, 'utf8')));
  const wav = decodeWav(readFileSync(task.wavPath));
  const signal = toMono(wav);
  const fs = wav.sampleRate;
  const events = detectStrums(signal, fs);
  const delta = stringOffsetsCents(parsed.notes);
  const rng = mulberry32(task.seed);
  const out: ClipOutcome = {
    id: task.info.id,
    player: task.info.player,
    genre: task.info.genre,
    kind: task.info.kind,
    singles: [],
    pairs: [],
    strums: [],
    f1: null,
  };
  const tolEvent = Math.round(0.06 * fs);

  if (task.info.kind === 'solo') {
    for (const s of singleEvents(parsed, task.filters)) {
      const e = nearest(events, Math.round(s.time * fs), tolEvent);
      const expected = midiToHz(s.midi) * 2 ** (delta[s.idx]! / 1200);
      if (!e) {
        out.singles.push({ ok: false, perturbedOk: false, status: 'NOT_PLAYED', cents: null, midi: s.midi });
        continue;
      }
      const seg = segment(signal, e.sample, fs);
      const res = verifyPluck({
        samples: seg.samples,
        sampleRate: fs,
        onsetSample: seg.onsetSample,
        expectedF0: expected,
      });
      const sign = rng() < 0.5 ? -1 : 1;
      const perturbed = verifyPluck({
        samples: seg.samples,
        sampleRate: fs,
        onsetSample: seg.onsetSample,
        expectedF0: expected * 2 ** (sign / 12),
      });
      out.singles.push({
        ok: res.status === 'OK',
        perturbedOk: perturbed.status === 'OK',
        status: res.status,
        cents: res.cents,
        midi: s.midi,
      });
    }
    return out;
  }

  // Comp clips: strum events.
  const strums = strumEvents(parsed.notes, task.filters);
  strums.forEach((ev, k) => {
    const voicing = voicingFromMidis(ev.midis, `${task.info.id}#${k}`);
    if (!voicing) return;
    const e = nearest(events, Math.round(ev.time * fs), tolEvent);
    if (!e) {
      out.strums.push({ verdict: 'RETRY', perturbedStringOk: null, blamed: [] });
      return;
    }
    const seg = segment(signal, e.sample, fs);
    const input = {
      samples: seg.samples,
      sampleRate: fs,
      onsetSample: seg.onsetSample,
      tuning: STANDARD_TUNING,
      deltaCents: delta,
    };
    const res = verifyStrum({ ...input, voicing });
    // Perturbation: a verifiable string's expected fret +1/+2 → is that string still reported OK?
    const verifiable = partialCollisionMap(voicing, STANDARD_TUNING, undefined, delta)
      .filter((m) => m.verifiable)
      .map((m) => m.idx);
    let perturbedStringOk: boolean | null = null;
    if (verifiable.length > 0) {
      const idx = pick(rng, verifiable);
      const offset = rng() < 0.5 ? 1 : 2;
      const shifted: ChordVoicing = {
        ...voicing,
        frets: voicing.frets.map((f, i) => (i === idx && typeof f === 'number' ? f + offset : f)),
      };
      const pr = verifyStrum({ ...input, voicing: shifted });
      perturbedStringOk = pr.strings.find((s) => s.idx === idx)?.status === 'OK';
    }
    out.strums.push({ verdict: res.verdict, perturbedStringOk, blamed: res.blamed });
    // Mode C: versus another strum event of the same clip with a different pitch-class set (seeded uniform).
    const others = strums.filter((o) => pitchClasses(o.midis) !== pitchClasses(ev.midis));
    if (others.length > 0) {
      const other = voicingFromMidis(pick(rng, others).midis, 'other');
      if (other) {
        const cls = classifyPair(input, [voicing, other], false);
        out.pairs.push({ correct: cls.margin > 0, margin: cls.margin });
      }
    }
  });
  if (!task.excludeGenresFromF1.includes(task.info.genre)) {
    const truth = onsetTruth(parsed.notes, task.filters).map((t) => Math.round(t * fs));
    const detected = events.map((e) => e.sample);
    const tol = Math.round(0.05 * fs);
    const used = new Set<number>();
    let tp = 0;
    const pairs: { d: number; t: number; dist: number }[] = [];
    for (const [i, d] of detected.entries())
      for (const [j, tr] of truth.entries())
        if (Math.abs(d - tr) <= tol) pairs.push({ d: i, t: j, dist: Math.abs(d - tr) });
    pairs.sort((a, b) => a.dist - b.dist);
    const usedT = new Set<number>();
    for (const p of pairs) {
      if (used.has(p.d) || usedT.has(p.t)) continue;
      used.add(p.d);
      usedT.add(p.t);
      tp++;
    }
    out.f1 = { tp, detected: detected.length, truth: truth.length };
  }
  return out;
}

export const audioPathFor = (dataDir: string, id: string) => join(dataDir, 'audio_mono-mic', `${id}_mic.wav`);
export const deriveClipSeed = (id: string) => deriveSeed(4242, id);
