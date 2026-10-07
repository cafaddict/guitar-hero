/**
 * Chord voicing model and derived facts (SPEC §6.2–6.3). Pure.
 */
import { STRING_COUNT } from './strings';
import { midiToHz, partialHz, type Tuning } from './theory';

export type Fret = number | 'x';
export type FingerId = 1 | 2 | 3 | 4 | 'T';

export interface Barre {
  fret: number;
  fromIdx: number;
  toIdx: number;
  finger: FingerId;
}

export interface ChordVoicing {
  id: string;
  /** Chord symbol tonal can parse ('C', 'G', 'Fmaj7', 'G5'). */
  symbol: string;
  nameKo?: string;
  /** Length 6, idx 0 = 6th string. */
  frets: readonly Fret[];
  /** 0 = open string, null = muted/not played. */
  fingers: readonly (FingerId | 0 | null)[];
  barres?: readonly Barre[];
  /** First fret shown in the diagram (1 = nut). */
  baseFret: number;
  stage: number;
  tags: readonly string[];
}

export interface ExpectedNote {
  idx: number;
  midi: number;
  f0: number;
}

/**
 * Expected sounding notes (muted 'x' strings excluded), with optional per-string cents offsets δ[i]
 * from calibration applied to f0: f0[i] = 440·2^((m−69)/12)·2^(δ/1200).
 */
export function expectedNotes(
  voicing: ChordVoicing,
  tuning: Tuning,
  capo = 0,
  deltaCents?: readonly number[],
): ExpectedNote[] {
  const notes: ExpectedNote[] = [];
  for (let idx = 0; idx < STRING_COUNT; idx++) {
    const fret = voicing.frets[idx];
    if (fret === undefined || fret === 'x') continue;
    const midi = tuning.openMidi[idx]! + capo + fret;
    const delta = deltaCents?.[idx] ?? 0;
    notes.push({ idx, midi, f0: midiToHz(midi) * 2 ** (delta / 1200) });
  }
  return notes;
}

export function mutedStrings(voicing: ChordVoicing): number[] {
  const out: number[] = [];
  voicing.frets.forEach((fret, idx) => {
    if (fret === 'x') out.push(idx);
  });
  return out;
}

export function playedStrings(voicing: ChordVoicing): number[] {
  const out: number[] = [];
  voicing.frets.forEach((fret, idx) => {
    if (fret !== 'x') out.push(idx);
  });
  return out;
}

/** Lowest-pitched string that is played (where a strum should start). */
export function lowestPlayedString(voicing: ChordVoicing): number {
  const played = playedStrings(voicing);
  if (played.length === 0) throw new Error(`${voicing.id}: no played strings`);
  return played[0]!;
}

export interface FingerPlacement {
  finger: FingerId;
  idx: number;
  fret: number;
}

/** Fretted positions with their finger (open/muted strings excluded). */
export function fingerPlacements(voicing: ChordVoicing): FingerPlacement[] {
  const out: FingerPlacement[] = [];
  for (let idx = 0; idx < STRING_COUNT; idx++) {
    const fret = voicing.frets[idx];
    const finger = voicing.fingers[idx];
    if (typeof fret !== 'number' || fret === 0 || finger === null || finger === 0 || finger === undefined)
      continue;
    out.push({ finger, idx, fret });
  }
  return out;
}

export interface Slide {
  finger: FingerId;
  idx: number;
  fromFret: number;
  toFret: number;
}

export interface AnchorAnalysis {
  /** Same finger on the same (string, fret) in both voicings: keep it down while changing. */
  anchors: FingerPlacement[];
  /** Same finger on the same string, only the fret changes: slide it. */
  slides: Slide[];
}

/** Computes anchor and slide fingers between two voicings (SPEC §6.2). Never hand-authored. */
export function anchors(a: ChordVoicing, b: ChordVoicing): AnchorAnalysis {
  const fromB = fingerPlacements(b);
  const result: AnchorAnalysis = { anchors: [], slides: [] };
  for (const p of fingerPlacements(a)) {
    const sameFingerSameString = fromB.find((q) => q.finger === p.finger && q.idx === p.idx);
    if (!sameFingerSameString) continue;
    if (sameFingerSameString.fret === p.fret) result.anchors.push(p);
    else
      result.slides.push({
        finger: p.finger,
        idx: p.idx,
        fromFret: p.fret,
        toFret: sameFingerSameString.fret,
      });
  }
  return result;
}

export interface CollisionParams {
  /** Partials of the evaluated string (h = 1..maxOwnPartial). */
  maxOwnPartial: number;
  /** Partials of the other strings (k = 1..maxOtherPartial). */
  maxOtherPartial: number;
  maxHz: number;
  inharmonicityB: number;
  toleranceCents: number;
  /** Strings below this f0 do not count h = 1 (laptop/phone mic low-frequency roll-off). */
  lowF0Hz: number;
  minIndependentPartials: number;
}

/** SPEC §6.3 fixed default rule. */
export const DEFAULT_COLLISION_PARAMS: CollisionParams = {
  maxOwnPartial: 8,
  maxOtherPartial: 16,
  maxHz: 5000,
  inharmonicityB: 5e-5,
  toleranceCents: 35,
  lowF0Hz: 120,
  minIndependentPartials: 2,
};

export interface StringVerifiability {
  idx: number;
  verifiable: boolean;
  /** Partial numbers h of this string that no other played string covers. */
  independentPartials: number[];
}

/**
 * For a strum, which strings can be judged on their own: a partial is independent when no partial
 * k = 1..16 of any other played string lies within ±35 cents; a string with ≥ 2 independent partials
 * (h = 1 excluded below 120 Hz) is verifiable.
 */
export function partialCollisionMap(
  voicing: ChordVoicing,
  tuning: Tuning,
  params: CollisionParams = DEFAULT_COLLISION_PARAMS,
  deltaCents?: readonly number[],
): StringVerifiability[] {
  const notes = expectedNotes(voicing, tuning, 0, deltaCents);
  return notes.map((note) => {
    const independent: number[] = [];
    for (let h = 1; h <= params.maxOwnPartial; h++) {
      const f = partialHz(note.f0, h, params.inharmonicityB);
      if (f > params.maxHz) break;
      if (h === 1 && note.f0 < params.lowF0Hz) continue;
      const collides = notes.some((other) => {
        if (other.idx === note.idx) return false;
        for (let k = 1; k <= params.maxOtherPartial; k++) {
          const g = partialHz(other.f0, k, params.inharmonicityB);
          if (Math.abs(1200 * Math.log2(f / g)) <= params.toleranceCents) return true;
        }
        return false;
      });
      if (!collides) independent.push(h);
    }
    return {
      idx: note.idx,
      verifiable: independent.length >= params.minIndependentPartials,
      independentPartials: independent,
    };
  });
}

/** Ratio of verifiable strings among played strings (coverage report, SPEC §14.3). */
export function verifiableRatio(map: readonly StringVerifiability[]): number {
  if (map.length === 0) return 0;
  return map.filter((s) => s.verifiable).length / map.length;
}
