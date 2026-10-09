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
import {
  DEFAULT_SEQUENCE_PARAMS,
  detectSequenceOnsets,
  judgeSequenceNote,
  type RingingNote,
} from '../../src/dsp/sequence';
import { energyOnset } from '../../src/dsp/take';
import { decodeWav, toMono } from '../../src/dsp/wav';
import {
  type ClipInfo,
  type EventFilters,
  onsetTruth,
  parseJams,
  sequenceNotes,
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
  /** v1.1 solo sequence (§14.4): verdicts of the matched filtered notes, unmatched count, onset F1 counts. */
  seqNotes: {
    ok: boolean;
    perturbedOk: boolean;
    status: string;
    cents: number | null;
    clarity: number;
    midi: number;
    idx: number;
    windowMs: number;
  }[];
  seqUnmatched: number;
  seqF1: { tp: number; detected: number; truth: number } | null;
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

/** Greedy one-to-one matching by distance: truth index → detected index. */
function matchOneToOne(
  truth: readonly number[],
  detected: readonly number[],
  tol: number,
): Map<number, number> {
  const pairs: { t: number; d: number; dist: number }[] = [];
  truth.forEach((tr, i) => {
    detected.forEach((d, j) => {
      const dist = Math.abs(d - tr);
      if (dist <= tol) pairs.push({ t: i, d: j, dist });
    });
  });
  pairs.sort((a, b) => a.dist - b.dist);
  const out = new Map<number, number>();
  const usedD = new Set<number>();
  for (const p of pairs) {
    if (out.has(p.t) || usedD.has(p.d)) continue;
    out.set(p.t, p.d);
    usedD.add(p.d);
  }
  return out;
}

/**
 * Solo single-note sequence check (SPEC v1.1 §14.4, §10.10 on real recordings): filtered notes matched to the
 * sequence onset path (±sequenceMatchMs); each matched note judged by the same note judgement as
 * verifySequence over [detected onset + 30, + min(130, next annotated onset − 20)] ms with the expected note
 * (round(note_midi) + string δ) and with that note ±1 semitone. Earlier notes on other strings count as
 * ringing for the cancellation, exactly as previous slots do in the app.
 */
function evaluateSoloSequence(
  parsed: ReturnType<typeof parseJams>,
  signal: Float32Array,
  fs: number,
  delta: readonly number[],
  rng: () => number,
  filters: EventFilters,
  judgeable: (time: number) => boolean,
  out: ClipOutcome,
): void {
  const onsets = detectSequenceOnsets(signal, fs).map((o) => o.sample);
  const tol = Math.round((filters.sequenceMatchMs / 1000) * fs);
  const truthF1 = onsetTruth(parsed.notes, filters).map((t) => Math.round(t * fs));
  out.seqF1 = {
    tp: matchOneToOne(truthF1, onsets, tol).size,
    detected: onsets.length,
    truth: truthF1.length,
  };
  const notes = sequenceNotes(parsed, filters).filter((n) => judgeable(n.time));
  const match = matchOneToOne(
    notes.map((n) => Math.round(n.time * fs)),
    onsets,
    tol,
  );
  notes.forEach((n, i) => {
    const d = match.get(i);
    if (d === undefined) {
      out.seqUnmatched++;
      return;
    }
    const onset = onsets[d]!;
    const nextMs = n.nextOnset === null ? Number.POSITIVE_INFINITY : (n.nextOnset - onset / fs) * 1000;
    const endMs = Math.min(
      DEFAULT_SEQUENCE_PARAMS.pitchEndMs,
      nextMs - DEFAULT_SEQUENCE_PARAMS.nextSlotGuardMs,
    );
    const ringingS = DEFAULT_SEQUENCE_PARAMS.ringingMs / 1000;
    const latest = new Map<number, RingingNote>();
    for (const m of parsed.notes)
      if (m.idx !== n.idx && m.time < n.time && n.time - m.time <= ringingS)
        latest.set(m.idx, {
          f0: midiToHz(Math.round(m.midi)) * 2 ** (delta[m.idx]! / 1200),
          stringIdx: m.idx,
          startSample: Math.round(m.time * fs),
        });
    const ringing = [...latest.values()].sort((a, b) => a.startSample - b.startSample);
    const expected = midiToHz(n.midi) * 2 ** (delta[n.idx]! / 1200);
    const judge = (f0: number) =>
      judgeSequenceNote({
        samples: signal,
        sampleRate: fs,
        onsetSample: onset,
        endMs,
        expectedF0: f0,
        ringing,
      });
    const res = judge(expected);
    const sign = rng() < 0.5 ? -1 : 1;
    const perturbed = judge(expected * 2 ** (sign / 12));
    out.seqNotes.push({
      ok: res.status === 'OK',
      perturbedOk: perturbed.status === 'OK',
      status: res.status,
      cents: res.cents ?? null,
      clarity: res.clarity,
      midi: n.midi,
      idx: n.idx,
      windowMs: endMs - DEFAULT_SEQUENCE_PARAMS.pitchStartMs,
    });
  });
}

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
    seqNotes: [],
    seqUnmatched: 0,
    seqF1: null,
  };
  const tolEvent = Math.round(0.06 * fs);

  // A judgement needs its analysis segment [onset − 500 ms, onset + 400 ms] inside the recording (SPEC §8.2,
  // §10.5–10.6 inputs); notes at the very start of a clip have no pre-onset audio to detect or reference.
  const durationS = signal.length / fs;
  const judgeable = (time: number) => time >= 0.5 && time + 0.4 <= durationS;

  if (task.info.kind === 'solo') {
    evaluateSoloSequence(parsed, signal, fs, delta, rng, task.filters, judgeable, out);
    for (const s of singleEvents(parsed, task.filters).filter((e) => judgeable(e.time))) {
      const target = Math.round(s.time * fs);
      // App flow: the prompt arms the pluck detector shortly before the note; the energy fallback covers very
      // soft plucks the flux detector misses. The result must still land within ±60 ms of the annotation.
      const fallbackSample = nearest(events, target, tolEvent)
        ? null
        : energyOnset(signal, fs, target - Math.round(0.15 * fs), target + tolEvent);
      const e =
        nearest(events, target, tolEvent) ??
        (fallbackSample !== null && Math.abs(fallbackSample - target) <= tolEvent
          ? { sample: fallbackSample }
          : null);
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
  const strums = strumEvents(parsed.notes, task.filters).filter((e) => judgeable(e.time));
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
