import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING } from '../domain/theory';
import { cancellationStages, DEFAULT_SEQUENCE_PARAMS, type SequenceSlot, verifySequence } from './sequence';
import { type NoteSpec, randomTimbre } from './synth/note';
import { renderSequence, type SequenceNote } from './synth/sequence';

const FS = 48000;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function note(midi: number, seed: number): NoteSpec {
  return {
    model: 'karplus-strong',
    f0: hz(midi),
    sampleRate: FS,
    durationS: 2,
    inharmonicityB: 5e-5,
    muted: false,
    mutedDecayDb: -30,
    mutedDecayMs: 120,
    fundamentalDb: 0,
    ...randomTimbre(seed),
    t60S: 4,
    seed,
  };
}

/** Em pentatonic 6:0 6:3 5:0 5:2 4:0 4:2 at 80 BPM eighths (0.375 s apart); notes on other strings keep ringing. */
const SHAPE = [
  { string: 6, fret: 0 },
  { string: 6, fret: 3 },
  { string: 5, fret: 0 },
  { string: 5, fret: 2 },
  { string: 4, fret: 0 },
  { string: 4, fret: 2 },
];
const IOI = 0.375;
const START = 0.6;
const midiOf = (p: { string: number; fret: number }) => STANDARD_TUNING.openMidi[6 - p.string]! + p.fret;

function take(edit: (notes: SequenceNote[]) => SequenceNote[] = (n) => n) {
  const notes: SequenceNote[] = SHAPE.map((p, k) => ({
    time: START + k * IOI,
    string: p.string,
    note: note(midiOf(p), 10 + k),
    gainDb: 0,
  }));
  const played = edit(notes);
  const { signal } = renderSequence(played, FS, Math.round((START + SHAPE.length * IOI + 1) * FS));
  // A little noise so the onset detector sees a real floor.
  let seed = 7;
  for (let i = 0; i < signal.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    signal[i] = signal[i]! + ((seed / 2 ** 32) * 2 - 1) * 1e-4;
  }
  const slots: SequenceSlot[] = SHAPE.map((p, k) => ({
    time: START + k * IOI,
    midi: midiOf(p),
    stringIdx: 6 - p.string,
    cycle: 0,
  }));
  return verifySequence({ samples: signal, sampleRate: FS, slots, bpm: 80 });
}

describe('SPEC v1.1 §10.10 verifySequence', () => {
  it('a clean cycle is flawless with every note OK and no extra', () => {
    const res = take();
    expect(res.notes.map((n) => n.status)).toEqual(Array(6).fill('OK'));
    expect(res.extras).toEqual([]);
    expect(res.cycles).toEqual([{ cycle: 0, flawless: true, uncertain: false, extras: 0 }]);
    expect(res.hitRate).toBe(1);
    expect(res.stops).toBe(0);
    for (const n of res.notes) expect(Math.abs(n.onsetOffsetMs!)).toBeLessThan(15);
  });

  it('a note a fret too high on the same string is WRONG_NOTE +1 and the cycle is a mistake', () => {
    const res = take((notes) =>
      notes.map((n, k) => (k === 3 ? { ...n, note: note(midiOf(SHAPE[3]!) + 1, 99) } : n)),
    );
    expect(res.notes[3]).toMatchObject({ status: 'WRONG_NOTE', semitones: 1 });
    expect(res.cycles[0]).toMatchObject({ flawless: false, uncertain: false });
  });

  it('an omitted note is MISSED; two in a row count one stop', () => {
    const one = take((notes) => notes.filter((_, k) => k !== 2));
    expect(one.notes[2]!.status).toBe('MISSED');
    expect(one.stops).toBe(0);
    expect(one.cycles[0]!.flawless).toBe(false);
    const two = take((notes) => notes.filter((_, k) => k !== 2 && k !== 3));
    expect(two.stops).toBe(1);
  });

  it('an inserted note between two slots is EXTRA', () => {
    const res = take((notes) => [
      ...notes,
      { time: START + 2.5 * IOI, string: 3, note: note(55, 77), gainDb: 0 },
    ]);
    expect(res.extras).toHaveLength(1);
    expect(Math.abs(res.extras[0]! / FS - (START + 2.5 * IOI))).toBeLessThan(0.03);
    expect(res.notes.every((n) => n.status === 'OK')).toBe(true);
    expect(res.cycles[0]).toMatchObject({ flawless: false, extras: 1 });
  });

  it('a legato slot without an onset is HAMMER_OK (beta) and never fails the cycle', () => {
    const notes: SequenceNote[] = [
      { time: START, string: 6, note: note(45, 1), gainDb: 0 },
      { time: START + IOI, string: 6, note: note(47, 2), gainDb: 0, legato: true },
    ];
    const { signal } = renderSequence(notes, FS, Math.round((START + 2) * FS));
    const res = verifySequence({
      samples: signal,
      sampleRate: FS,
      slots: [
        { time: START, midi: 45, stringIdx: 0 },
        { time: START + IOI, midi: 47, stringIdx: 0, legatoAllowed: true },
      ],
      bpm: 80,
    });
    expect(['HAMMER_OK', 'OK']).toContain(res.notes[1]!.status);
    expect(res.flawless).toBe(true);
  });

  it('cancellation: skips a unison, keeps shared partials for an octave, cancels other notes', () => {
    const p = DEFAULT_SEQUENCE_PARAMS;
    const ring = (midi: number) => ({ f0: hz(midi), stringIdx: 0, startSample: 0 });
    expect(cancellationStages(hz(45), [ring(45)], FS, p)).toEqual([]);
    expect(cancellationStages(hz(52), [ring(40)], FS, p)).toEqual([{ period: FS / hz(40), keepMultiple: 2 }]);
    expect(cancellationStages(hz(47), [ring(43)], FS, p)).toEqual([{ period: FS / hz(43), keepMultiple: 1 }]);
    expect(cancellationStages(hz(47), [ring(40), ring(43), ring(45), ring(50)], FS, p)).toHaveLength(
      p.maxCancelled,
    );
    expect(cancellationStages(hz(47), [ring(43)], FS, { ...p, maxCancelled: 0 })).toEqual([]);
  });
});
