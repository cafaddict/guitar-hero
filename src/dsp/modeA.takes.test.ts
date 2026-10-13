/**
 * Mode A takes from the E1 string-by-string check (D-073, D-074): a knock on the guitar body is not a muted
 * string, and strings plucked just before keep ringing under the next take. Seeded synthetic takes; the rates
 * are regression floors measured on these generators (not the §14 contract, which stays in thresholds.json).
 */
import { describe, expect, it } from 'vitest';
import { voicingById } from '../content/voicings';
import { STANDARD_TUNING } from '../domain/theory';
import {
  DEFAULT_MODE_A_PARAMS,
  type PluckInput,
  type PluckResult,
  verifyPluck,
  verifySilentString,
} from './modeA';
import { detectStrums } from './onset';
import { type ChordPluckTarget, renderChordPluck } from './synth/chordPluck';
import type { SynthModel } from './synth/note';
import type { Sensitivity } from './types';

const FS = 48000;

/** Peak 0.5 and a deterministic noise floor, like a quiet room. */
function recorded(x: Float32Array, seed: number): Float32Array {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  let s = seed >>> 0;
  const out = new Float32Array(x.length);
  for (let i = 0; i < out.length; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    out[i] = (x[i]! * 0.5) / peak + 3e-4 * ((s / 4294967296) * 2 - 1);
  }
  return out;
}

const midiOf = (voicingId: string) =>
  voicingById(voicingId).frets.map((f, i) => (f === 'x' ? null : STANDARD_TUNING.openMidi[i]! + f));

interface Take {
  input: PluckInput;
  /** The same take with the earlier strings passed as ringing. */
  withRinging: PluckInput;
}

function take(opts: {
  voicingId: string;
  targetIdx: number;
  target: ChordPluckTarget;
  alone?: boolean;
  ringingGainDb?: number;
  knockGainDb?: number;
  model?: SynthModel;
  seed: number;
  sensitivity?: Sensitivity;
}): Take {
  const full = midiOf(opts.voicingId);
  const midi = opts.alone ? full.map((m, i) => (i === opts.targetIdx ? m : null)) : full;
  const c = renderChordPluck({
    sampleRate: FS,
    midi,
    targetIdx: opts.targetIdx,
    target: opts.target,
    intervalS: 0.7,
    ringingGainDb: opts.ringingGainDb ?? 0,
    model: opts.model ?? 'karplus-strong',
    seed: opts.seed,
    knockGainDb: opts.knockGainDb ?? 0,
  });
  const input: PluckInput = {
    samples: recorded(c.signal, opts.seed),
    sampleRate: FS,
    onsetSample: c.targetOnset,
    expectedF0: c.expectedF0,
    ...(opts.sensitivity ? { sensitivity: opts.sensitivity } : {}),
  };
  const ringing = c.ringing.map((r) => ({ f0: r.f0, ageS: (c.targetOnset - r.onset) / FS }));
  return { input, withRinging: { ...input, ringing } };
}

const played = (voicingId: string) => midiOf(voicingId).flatMap((m, idx) => (m === null ? [] : [idx]));
const count = (results: readonly PluckResult[], pred: (r: PluckResult) => boolean) =>
  results.filter(pred).length;
const notString = (r: PluckResult) => r.verdict === 'RETRY' && r.reasons.includes('NOT_STRING');

describe('Mode A: a knock on the body is not a muted string (D-073)', () => {
  const knocks = (sensitivity?: Sensitivity) =>
    [0, 1, 2, 3, 4, 5].flatMap((idx) =>
      [-6, 0, 6].flatMap((knockGainDb) =>
        [1, 2].map((s) =>
          take({
            voicingId: 'E',
            targetIdx: idx,
            target: 'knock',
            alone: true,
            knockGainDb,
            seed: 100 * idx + 10 * s + knockGainDb,
            ...(sensitivity ? { sensitivity } : {}),
          }),
        ),
      ),
    );

  it('a knock is heard as an onset but judged NOT_STRING, almost never MUTED', () => {
    const takes = knocks();
    const onsets = takes.filter((t) => detectStrums(t.input.samples, FS).length > 0).length;
    expect(onsets / takes.length).toBeGreaterThanOrEqual(0.95);
    const results = takes.map((t) => verifyPluck(t.input));
    expect(count(results, (r) => r.verdict === 'FAIL') / results.length).toBeLessThanOrEqual(0.05);
    expect(count(results, notString) / results.length).toBeGreaterThanOrEqual(0.85);
    expect(count(results, (r) => r.verdict === 'PASS')).toBe(0);
  });

  it('a muted string is still MUTED (the check only speaks before a MUTED verdict)', () => {
    const results = [0, 1, 2, 3, 4, 5].flatMap((idx) =>
      [1, 2, 3, 4].map((s) =>
        verifyPluck(
          take({
            voicingId: 'G-3f',
            targetIdx: idx,
            target: 'muted',
            alone: true,
            model: s % 2 ? 'karplus-strong' : 'additive',
            seed: 7 * idx + s,
          }).input,
        ),
      ),
    );
    expect(count(results, (r) => r.status === 'MUTED') / results.length).toBeGreaterThanOrEqual(0.95);
    expect(count(results, notString) / results.length).toBeLessThanOrEqual(0.03);
  });

  it('only a would-be MUTED verdict can change: clean and wrong notes are identical with the check off', () => {
    const off = {
      ...DEFAULT_MODE_A_PARAMS,
      notString: {
        low: { maxPartials: -1, minHarmonicFraction: 0 },
        normal: { maxPartials: -1, minHarmonicFraction: 0 },
        high: { maxPartials: -1, minHarmonicFraction: 0 },
      },
    };
    for (const target of ['clean', 'wrong-up', 'wrong-down'] as const) {
      for (const idx of [0, 2, 4]) {
        const { input } = take({ voicingId: 'C', targetIdx: idx + 1, target, alone: true, seed: idx + 50 });
        const { processingMs: _a, ...on } = verifyPluck(input);
        const { processingMs: _b, ...without } = verifyPluck({ ...input, params: off });
        expect(on).toEqual(without);
      }
    }
  });

  it('sensitivity orders the knocks that slip through: low ≤ normal ≤ high', () => {
    const muted = (s: Sensitivity) =>
      count(
        knocks(s).map((t) => verifyPluck(t.input)),
        (r) => r.status === 'MUTED',
      );
    const [low, normal, high] = [muted('low'), muted('normal'), muted('high')];
    expect(low).toBeLessThanOrEqual(normal);
    expect(normal).toBeLessThanOrEqual(high);
  });

  it('x-string check: a knock on a muted x string is the expected "no string sound"', () => {
    const { input } = take({ voicingId: 'E', targetIdx: 1, target: 'knock', alone: true, seed: 9 });
    expect(verifySilentString(input).status).toBe('OK');
  });
});

describe('Mode A: earlier strings still ringing under the take (D-074)', () => {
  const cases = (target: ChordPluckTarget, ringingGainDb: number) =>
    ['C', 'G-3f', 'Am', 'E'].flatMap((voicingId, v) =>
      played(voicingId)
        .slice(1)
        .map(
          (targetIdx) =>
            take({ voicingId, targetIdx, target, ringingGainDb, seed: 31 * v + targetIdx }).withRinging,
        ),
    );

  it('no ringing strings: exactly the plain judgement', () => {
    const { input } = take({ voicingId: 'C', targetIdx: 3, target: 'clean', seed: 4 });
    const { processingMs: _a, ...plain } = verifyPluck(input);
    const { processingMs: _b, ...empty } = verifyPluck({ ...input, ringing: [] });
    expect(empty).toEqual(plain);
  });

  for (const ringingGainDb of [0, 6]) {
    it(`ringing ${ringingGainDb} dB: clean OK, wrong notes found, muted strings MUTED`, () => {
      const clean = cases('clean', ringingGainDb).map(verifyPluck);
      expect(count(clean, (r) => r.status === 'OK') / clean.length).toBeGreaterThanOrEqual(0.97);
      const wrong = [...cases('wrong-up', ringingGainDb), ...cases('wrong-down', ringingGainDb)].map(
        verifyPluck,
      );
      expect(count(wrong, (r) => r.status === 'WRONG_NOTE') / wrong.length).toBeGreaterThanOrEqual(0.9);
      expect(count(wrong, (r) => r.status === 'OK') / wrong.length).toBeLessThanOrEqual(0.02);
      const muted = cases('muted', ringingGainDb).map(verifyPluck);
      expect(count(muted, (r) => r.status === 'MUTED') / muted.length).toBeGreaterThanOrEqual(0.8);
      expect(count(muted, (r) => r.status === 'OK')).toBe(0);
    });
  }

  it('louder ringing strings no longer hide a clean take (plain judgement for comparison)', () => {
    const takes = ['C', 'G-3f', 'Am', 'E'].flatMap((voicingId, v) =>
      played(voicingId)
        .slice(1)
        .map((targetIdx) =>
          take({ voicingId, targetIdx, target: 'clean', ringingGainDb: 6, seed: 31 * v + targetIdx }),
        ),
    );
    const plainOk = count(
      takes.map((t) => verifyPluck(t.input)),
      (r) => r.status === 'OK',
    );
    const ringingOk = count(
      takes.map((t) => verifyPluck(t.withRinging)),
      (r) => r.status === 'OK',
    );
    expect(ringingOk).toBeGreaterThan(plainOk);
  });

  it('the previous string plucked again is never OK; a knock under ringing strings is not a FAIL', () => {
    const replucked = cases('replucked', 0).map(verifyPluck);
    expect(count(replucked, (r) => r.status === 'OK')).toBe(0);
    const knocks = cases('knock', 0).map(verifyPluck);
    expect(count(knocks, (r) => r.verdict === 'FAIL') / knocks.length).toBeLessThanOrEqual(0.05);
    expect(count(knocks, (r) => r.verdict === 'PASS')).toBe(0);
  });

  it('an octave above a ringing string (E3 over E2) is still OK', () => {
    const { withRinging } = take({
      voicingId: 'E',
      targetIdx: 2,
      target: 'clean',
      ringingGainDb: 6,
      seed: 77,
    });
    expect(withRinging.ringing?.some((r) => Math.abs(r.f0 - 82.41) < 0.5)).toBe(true);
    expect(verifyPluck(withRinging).status).toBe('OK');
  });
});
