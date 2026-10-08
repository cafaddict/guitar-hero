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
): ChoiceQuestion<P> {
  const options = shuffled(rng, [correct, ...distractors.filter((d) => d !== correct).slice(0, 2)]);
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
  | { kind: 'name'; idx: number }
  | { kind: 'pluck'; idx: number; pitchClass: number };

const OPEN_NAMES = STANDARD_TUNING.openMidi.map((m) => pitchClassName(m));

/** Knowledge card of an open-string note question: `card:note:<idx>:0` (SPEC v1.1 §7.5). */
export const openNoteCard = (prompt: OpenNotePrompt) => `card:note:${prompt.idx}:0`;

export function openNoteQuestions(
  seed: number,
  mode: 'name' | 'pluck',
  count = QUIZ_LENGTH,
  /** Due card keys asked first (SPEC v1.1 §7.5 "due 카드를 먼저 묻는다"). */
  focus: readonly string[] = [],
): ChoiceQuestion<OpenNotePrompt>[] {
  const rng = mulberry32(seed);
  const distinct = [...new Set(OPEN_NAMES)];
  const focusIdx = focus
    .map((card) => /^card:note:(\d):0$/.exec(card)?.[1])
    .filter((x): x is string => x !== undefined)
    .map(Number)
    .filter((idx) => idx >= 0 && idx < 6);
  return Array.from({ length: count }, (_, k) => {
    const idx = k < focusIdx.length ? focusIdx[k]! : Math.floor(rng() * 6);
    const name = OPEN_NAMES[idx]!;
    if (mode === 'pluck') {
      return {
        prompt: { kind: 'pluck' as const, idx, pitchClass: STANDARD_TUNING.openMidi[idx]! % 12 },
        options: [],
        answer: 0,
      };
    }
    return withAnswer<OpenNotePrompt>({ kind: 'name', idx }, name, shuffled(rng, distinct), rng);
  });
}

// --- Q4 ---------------------------------------------------------------------------------------

export interface EarPrompt {
  rootMidi: number;
  quality: 'major' | 'minor';
  seed: number;
}

/** Knowledge card of a major/minor question: `card:ear:majmin:<quality>` (SPEC v1.1 §11.21, §7.5). */
export const earCard = (prompt: EarPrompt) => `card:ear:majmin:${prompt.quality}`;

export function earQuestions(
  seed: number,
  count = QUIZ_LENGTH,
  focus: readonly string[] = [],
): ChoiceQuestion<EarPrompt>[] {
  const rng = mulberry32(seed);
  const focusQualities = focus
    .map((card) => /^card:ear:majmin:(major|minor)$/.exec(card)?.[1] as 'major' | 'minor' | undefined)
    .filter((x): x is 'major' | 'minor' => x !== undefined);
  return Array.from({ length: count }, (_, k) => {
    const quality = k < focusQualities.length ? focusQualities[k]! : rng() < 0.5 ? 'major' : 'minor';
    const prompt: EarPrompt = { rootMidi: 48 + Math.floor(rng() * 10), quality, seed: seed * 100 + k };
    return {
      prompt,
      options: [ko.exercises.q4.major, ko.exercises.q4.minor],
      answer: quality === 'major' ? 0 : 1,
    };
  });
}

/** Root-position triad plus octave (Hz) of an ear-training chord. */
export function earChordHz(prompt: EarPrompt): number[] {
  const third = prompt.quality === 'major' ? 4 : 3;
  return [0, 7, 12, 12 + third].map((s) => midiToHz(prompt.rootMidi + s));
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
