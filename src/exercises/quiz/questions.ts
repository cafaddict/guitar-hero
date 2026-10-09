/**
 * Seeded question generators for the quizzes (Q1 diagram reading, Q3 open-string names, Q4 major/minor).
 * Option texts come from i18n; correct answers are placed at a seeded random position.
 */
import { BEGINNER_CHORD_CLASSES, type GVoicing, voicingForClass } from '../../content/voicings';
import { mulberry32, type Rng, shuffled } from '../../domain/prng';
import { STRING_INDICES, stringNumber } from '../../domain/strings';
import { midiToHz, pitchClassName, STANDARD_TUNING } from '../../domain/theory';
import type { ChordVoicing } from '../../domain/voicing';
import { ko } from '../../i18n/ko';
import type { ChoiceQuestion } from './choiceQuiz';

export const QUIZ_LENGTH = 10;

function withAnswer<P>(
  prompt: P,
  correct: string,
  distractors: readonly string[],
  rng: Rng,
  size = 3,
): ChoiceQuestion<P> {
  const options = shuffled(rng, [correct, ...distractors.filter((d) => d !== correct).slice(0, size - 1)]);
  return { prompt, options, answer: options.indexOf(correct) };
}

// --- Q1 ---------------------------------------------------------------------------------------

export type DiagramPrompt =
  | { kind: 'position'; voicingId: string; idx: number; fret: number }
  | { kind: 'symbol'; voicingId: string; idx: number; symbol: 'x' | 'o' };

const fingerName = (finger: number | 'T') => ko.exercises.e1.fingerName(finger);

export function diagramQuestions(
  voicings: readonly ChordVoicing[],
  seed: number,
  count = QUIZ_LENGTH,
): ChoiceQuestion<DiagramPrompt>[] {
  const rng = mulberry32(seed);
  const pool = voicings.length > 0 ? voicings : [];
  if (pool.length === 0) throw new Error('no voicings for the diagram quiz');
  const out: ChoiceQuestion<DiagramPrompt>[] = [];
  while (out.length < count) {
    const v = pool[Math.floor(rng() * pool.length)]!;
    const fretted = STRING_INDICES.filter(
      (i) => typeof v.frets[i] === 'number' && v.frets[i]! > 0 && v.fingers[i] !== null && v.fingers[i] !== 0,
    );
    const symbols = STRING_INDICES.filter((i) => v.frets[i] === 'x' || v.frets[i] === 0);
    if (rng() < 0.7 && fretted.length > 0) {
      const idx = fretted[Math.floor(rng() * fretted.length)]!;
      const fret = v.frets[idx] as number;
      const finger = v.fingers[idx] as number | 'T';
      const otherFinger = finger === 1 ? 2 : 1;
      const neighbour = idx === 0 ? 1 : idx - 1;
      const correct = ko.exercises.q1.position(stringNumber(idx), fret, fingerName(finger));
      const distractors = [
        ko.exercises.q1.position(stringNumber(neighbour), fret, fingerName(finger)),
        ko.exercises.q1.position(stringNumber(idx), fret + 1, fingerName(finger)),
        ko.exercises.q1.position(stringNumber(idx), fret, fingerName(otherFinger)),
      ];
      out.push(
        withAnswer(
          { kind: 'position', voicingId: v.id, idx, fret },
          correct,
          shuffled(rng, distractors),
          rng,
        ),
      );
    } else if (symbols.length > 0) {
      const idx = symbols[Math.floor(rng() * symbols.length)]!;
      const symbol = v.frets[idx] === 'x' ? 'x' : 'o';
      const correct = symbol === 'x' ? ko.exercises.q1.symbolX : ko.exercises.q1.symbolO;
      const distractors = [
        symbol === 'x' ? ko.exercises.q1.symbolO : ko.exercises.q1.symbolX,
        ko.exercises.q1.symbolPress,
      ];
      out.push(withAnswer({ kind: 'symbol', voicingId: v.id, idx, symbol }, correct, distractors, rng));
    }
  }
  return out;
}

/** Voicings the user has met so far (beginner classes when nothing is unlocked yet). */
export function quizVoicings(
  all: readonly ChordVoicing[],
  unlockedClasses: readonly string[],
  gVoicing: GVoicing,
): ChordVoicing[] {
  const classes = unlockedClasses.length > 0 ? unlockedClasses : BEGINNER_CHORD_CLASSES;
  const ids = new Set(classes.map((c) => voicingForClass(c, gVoicing)));
  return all.filter((v) => ids.has(v.id));
}

// --- Q3 ---------------------------------------------------------------------------------------

export type OpenNotePrompt =
  | { kind: 'name'; idx: number; fret: number }
  | { kind: 'pluck'; idx: number; fret: number; pitchClass: number };

export type NoteScope = 'open' | 'openPosition' | 'strings65';

const OPEN_NAMES = STANDARD_TUNING.openMidi.map((m) => pitchClassName(m));
const NATURAL_PCS = new Set([0, 2, 4, 5, 7, 9, 11]);
const NATURAL_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/**
 * Positions a Q3 range asks (SPEC v1.1 §11.15): the six open strings; natural notes at frets 0–3 on every string;
 * natural notes at frets 0–12 on strings 6 and 5 (16 positions).
 */
export function notePositions(scope: NoteScope): { idx: number; fret: number }[] {
  const natural = (idx: number, fret: number) =>
    NATURAL_PCS.has((STANDARD_TUNING.openMidi[idx]! + fret) % 12);
  const out: { idx: number; fret: number }[] = [];
  if (scope === 'open') for (let idx = 0; idx < 6; idx++) out.push({ idx, fret: 0 });
  if (scope === 'openPosition')
    for (let idx = 0; idx < 6; idx++)
      for (let fret = 0; fret <= 3; fret++) if (natural(idx, fret)) out.push({ idx, fret });
  if (scope === 'strings65')
    for (const idx of [0, 1])
      for (let fret = 0; fret <= 12; fret++) if (natural(idx, fret)) out.push({ idx, fret });
  return out;
}

/** Knowledge card of a note question: one card per position, `card:note:<idx>:<fret>` (SPEC v1.1 §7.5). */
export const openNoteCard = (prompt: OpenNotePrompt) => `card:note:${prompt.idx}:${prompt.fret}`;

export function openNoteQuestions(
  seed: number,
  mode: 'name' | 'pluck',
  count = QUIZ_LENGTH,
  /** Due card keys asked first (SPEC v1.1 §7.5 "due 카드를 먼저 묻는다"). */
  focus: readonly string[] = [],
  scope: NoteScope = 'open',
): ChoiceQuestion<OpenNotePrompt>[] {
  const rng = mulberry32(seed);
  const positions = notePositions(scope);
  const inScope = (p: { idx: number; fret: number }) =>
    positions.some((q) => q.idx === p.idx && q.fret === p.fret);
  const focused = focus
    .map((card) => /^card:note:(\d):(\d+)$/.exec(card))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ idx: Number(m[1]), fret: Number(m[2]) }))
    .filter(inScope);
  return Array.from({ length: count }, (_, k) => {
    // The open range keeps the v1 draw (one random string per question).
    const pos =
      k < focused.length
        ? focused[k]!
        : scope === 'open'
          ? { idx: Math.floor(rng() * 6), fret: 0 }
          : positions[Math.floor(rng() * positions.length)]!;
    const midi = STANDARD_TUNING.openMidi[pos.idx]! + pos.fret;
    const name = pitchClassName(midi);
    if (mode === 'pluck') {
      return {
        prompt: { kind: 'pluck' as const, idx: pos.idx, fret: pos.fret, pitchClass: midi % 12 },
        options: [],
        answer: 0,
      };
    }
    // v1 open range: 3 choices among the open-string names; the wider ranges: 4 choices (§11.15).
    const prompt: OpenNotePrompt = { kind: 'name', idx: pos.idx, fret: pos.fret };
    return scope === 'open'
      ? withAnswer(prompt, name, shuffled(rng, [...new Set(OPEN_NAMES)]), rng)
      : withAnswer(prompt, name, shuffled(rng, NATURAL_NAMES), rng, 4);
  });
}

// --- Q4 ---------------------------------------------------------------------------------------

export type EarKind = 'majmin' | 'interval' | 'progression';

/** Ascending intervals of the interval questions (semitones, SPEC v1.1 §11.21: M2, m3, M3, P4, P5, P8). */
export const EAR_INTERVALS = [2, 3, 4, 5, 7, 12] as const;
/** Second chord of a progression question, as a degree of the key (I → IV, V or back to I). */
export const EAR_DEGREES = ['IV', 'V', 'I'] as const;
/** Keys of the progression questions (tonic MIDI near the guitar's middle register). */
const EAR_KEYS: readonly number[] = [55, 48, 50, 57, 52]; // G3, C3, D3, A3, E3

export type EarPrompt =
  | { kind: 'majmin'; rootMidi: number; quality: 'major' | 'minor'; seed: number }
  | { kind: 'interval'; rootMidi: number; semitones: number; seed: number }
  | { kind: 'progression'; tonicMidi: number; degree: (typeof EAR_DEGREES)[number]; seed: number };

/** Knowledge card per question type: `card:ear:<kind>:<type>` (SPEC v1.1 §11.21, §7.5). */
export const earCard = (prompt: EarPrompt) =>
  prompt.kind === 'majmin'
    ? `card:ear:majmin:${prompt.quality}`
    : prompt.kind === 'interval'
      ? `card:ear:interval:${prompt.semitones}`
      : `card:ear:progression:${prompt.degree}`;

function focusTypes(focus: readonly string[], kind: EarKind): string[] {
  const re = new RegExp(`^card:ear:${kind}:(.+)$`);
  return focus.map((card) => re.exec(card)?.[1]).filter((x): x is string => x !== undefined);
}

export function earQuestions(
  seed: number,
  count = QUIZ_LENGTH,
  focus: readonly string[] = [],
  kind: EarKind = 'majmin',
): ChoiceQuestion<EarPrompt>[] {
  const rng = mulberry32(seed);
  const focused = focusTypes(focus, kind);
  const q4 = ko.exercises.q4;
  return Array.from({ length: count }, (_, k) => {
    const given = focused[k];
    const qSeed = seed * 100 + k;
    if (kind === 'interval') {
      const semitones =
        given !== undefined && EAR_INTERVALS.includes(Number(given) as (typeof EAR_INTERVALS)[number])
          ? Number(given)
          : EAR_INTERVALS[Math.floor(rng() * EAR_INTERVALS.length)]!;
      const prompt: EarPrompt = { kind, rootMidi: 48 + Math.floor(rng() * 10), semitones, seed: qSeed };
      return {
        prompt,
        options: EAR_INTERVALS.map((s) => q4.intervals[s] ?? ''),
        answer: EAR_INTERVALS.indexOf(semitones as (typeof EAR_INTERVALS)[number]),
      };
    }
    if (kind === 'progression') {
      const degree = (EAR_DEGREES as readonly string[]).includes(given ?? '')
        ? (given as (typeof EAR_DEGREES)[number])
        : EAR_DEGREES[Math.floor(rng() * EAR_DEGREES.length)]!;
      const tonicMidi = EAR_KEYS[Math.floor(rng() * EAR_KEYS.length)]!;
      return {
        prompt: { kind, tonicMidi, degree, seed: qSeed },
        options: EAR_DEGREES.map((d) => q4.degrees[d]),
        answer: EAR_DEGREES.indexOf(degree),
      };
    }
    const quality = given === 'major' || given === 'minor' ? given : rng() < 0.5 ? 'major' : 'minor';
    return {
      prompt: { kind: 'majmin', rootMidi: 48 + Math.floor(rng() * 10), quality, seed: qSeed },
      options: [q4.major, q4.minor],
      answer: quality === 'major' ? 0 : 1,
    };
  });
}

/** Root-position major or minor triad plus octave (MIDI) built on `root`. */
function triad(root: number, minor: boolean): number[] {
  return [0, 7, 12, 12 + (minor ? 3 : 4)].map((s) => root + s);
}

/** The sounds of a question, in order: chords as MIDI sets (a single note is a one-element set). */
export function earSounds(prompt: EarPrompt): number[][] {
  switch (prompt.kind) {
    case 'majmin':
      return [triad(prompt.rootMidi, prompt.quality === 'minor')];
    case 'interval':
      return [[prompt.rootMidi], [prompt.rootMidi + prompt.semitones]];
    case 'progression': {
      const offset = { I: 0, IV: 5, V: 7 }[prompt.degree];
      return [triad(prompt.tonicMidi, false), triad(prompt.tonicMidi + offset, false)];
    }
  }
}

/** Root-position triad plus octave (Hz) of a major/minor question (kept for the v1 callers). */
export function earChordHz(prompt: EarPrompt): number[] {
  return (earSounds(prompt)[0] ?? []).map(midiToHz);
}

// --- Q5 TAB reading (SPEC v1.1 §11.20) -----------------------------------------------------------------------

export interface TabPrompt {
  /** tab → position: a TAB cell is shown, pick the fretboard position; position → tab: the reverse. */
  kind: 'tabToPos' | 'posToTab';
  /** Guitar string number 1 (high E) … 6 (low E). */
  string: number;
  fret: number;
}

/**
 * TAB questions over strings 1–6 and frets 0–5. Distractors cover the usual misreading (TAB upside down: string
 * 7 − n) and a neighbouring fret.
 */
export function tabQuestions(seed: number, count = QUIZ_LENGTH): ChoiceQuestion<TabPrompt>[] {
  const rng = mulberry32(seed);
  const out: ChoiceQuestion<TabPrompt>[] = [];
  while (out.length < count) {
    const string = 1 + Math.floor(rng() * 6);
    const fret = Math.floor(rng() * 6);
    const kind: TabPrompt['kind'] = rng() < 0.5 ? 'tabToPos' : 'posToTab';
    const flipped = 7 - string === string ? (string % 6) + 1 : 7 - string;
    const otherFret = fret === 0 ? 1 : fret - 1;
    const label = kind === 'tabToPos' ? ko.exercises.q5.position : ko.exercises.q5.tabCell;
    out.push(
      withAnswer(
        { kind, string, fret },
        label(string, fret),
        [label(flipped, fret), label(string, otherFret)],
        rng,
      ),
    );
  }
  return out;
}
