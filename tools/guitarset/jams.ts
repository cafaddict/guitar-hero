/**
 * GuitarSet JAMS parsing and benchmark event extraction (SPEC §14.4). Pure functions over parsed JSON.
 *
 * note_midi annotations carry data_source "0".."5" = 6th string (low E) .. 1st string, i.e. our string idx.
 */

export interface JamsNote {
  idx: number;
  /** Onset (s). */
  time: number;
  duration: number;
  /** Annotated (continuous) MIDI value. */
  midi: number;
}

export interface ContourPoint {
  time: number;
  hz: number;
  voiced: boolean;
}

export interface ParsedJams {
  notes: JamsNote[];
  /** Pitch contour per string idx. */
  contours: Map<number, ContourPoint[]>;
}

interface Observation {
  time: number;
  duration: number;
  value: unknown;
}

/** JAMS stores `data` either as a list of observations or as parallel arrays. */
function observations(data: unknown): Observation[] {
  if (Array.isArray(data)) return data as Observation[];
  if (data && typeof data === 'object') {
    const d = data as { time?: number[]; duration?: number[]; value?: unknown[] };
    return (d.time ?? []).map((time, i) => ({ time, duration: d.duration?.[i] ?? 0, value: d.value?.[i] }));
  }
  return [];
}

export function parseJams(json: unknown): ParsedJams {
  const annotations = (json as { annotations?: unknown[] }).annotations ?? [];
  const notes: JamsNote[] = [];
  const contours = new Map<number, ContourPoint[]>();
  for (const raw of annotations) {
    const a = raw as {
      namespace?: string;
      annotation_metadata?: { data_source?: string | number };
      data?: unknown;
    };
    const idx = Number(a.annotation_metadata?.data_source);
    if (!Number.isInteger(idx) || idx < 0 || idx > 5) continue;
    if (a.namespace === 'note_midi') {
      for (const o of observations(a.data))
        notes.push({ idx, time: o.time, duration: o.duration, midi: Number(o.value) });
    } else if (a.namespace === 'pitch_contour') {
      const points = observations(a.data).map((o) => {
        const v = o.value as { frequency?: number; voiced?: boolean };
        return { time: o.time, hz: Number(v?.frequency ?? 0), voiced: Boolean(v?.voiced) };
      });
      contours.set(idx, [...(contours.get(idx) ?? []), ...points]);
    }
  }
  notes.sort((x, y) => x.time - y.time || x.idx - y.idx);
  for (const list of contours.values()) list.sort((x, y) => x.time - y.time);
  return { notes, contours };
}

export interface ClipInfo {
  id: string;
  player: string;
  genre: string;
  kind: 'comp' | 'solo';
}

/** "00_BN1-129-Eb_comp" → player 00, genre BN, comp. */
export function clipInfo(
  id: string,
  naming: { comp: string; solo: string; genres: readonly string[] },
): ClipInfo | null {
  const kind = id.includes(naming.comp) ? 'comp' : id.includes(naming.solo) ? 'solo' : null;
  const m = /^(\d{2})_([A-Za-z]+)\d/.exec(id);
  if (!kind || !m) return null;
  const genre = naming.genres.find((g) => g === m[2]);
  if (!genre) return null;
  return { id, player: m[1]!, genre, kind };
}

export interface EventFilters {
  strumGroupMs: number;
  strumMinNotes: number;
  strumMinSoundingStrings: number;
  strumMinNoteDurationMs: number;
  strumIsolationAfterMs: number;
  singleMinDurationMs: number;
  singleMinGapToNextOnsetMs: number;
  singleIsolationBeforeMs: number;
  singleMaxPitchContourDevCents: number;
  onsetF1GroupMs: number;
}

export interface StrumEventTruth {
  time: number;
  /** Per-string MIDI (rounded) for sounding strings; null = not played (x). */
  midis: (number | null)[];
  /** Continuous annotated MIDI per string (for calibration δ estimates). */
  rawMidis: (number | null)[];
}

/** Groups onsets that start within `groupMs` of the group's first onset. */
export function groupOnsets(notes: readonly JamsNote[], groupMs: number): JamsNote[][] {
  const groups: JamsNote[][] = [];
  for (const n of notes) {
    const g = groups[groups.length - 1];
    if (g && n.time - g[0]!.time <= groupMs / 1000) g.push(n);
    else groups.push([n]);
  }
  return groups;
}

/**
 * Strum events (comp clips): ≥ strumMinNotes onsets within 60 ms, ≥ 4 sounding strings, every note ≥ 250 ms,
 * and no other onset in the 300 ms after the event.
 */
export function strumEvents(notes: readonly JamsNote[], f: EventFilters): StrumEventTruth[] {
  const groups = groupOnsets(notes, f.strumGroupMs);
  const out: StrumEventTruth[] = [];
  groups.forEach((g, gi) => {
    if (g.length < f.strumMinNotes) return;
    const strings = new Set(g.map((n) => n.idx));
    if (strings.size < f.strumMinSoundingStrings) return;
    if (g.some((n) => n.duration * 1000 < f.strumMinNoteDurationMs)) return;
    const t0 = g[0]!.time;
    const next = groups[gi + 1];
    if (next && (next[0]!.time - t0) * 1000 < f.strumIsolationAfterMs) return;
    const midis: (number | null)[] = [null, null, null, null, null, null];
    const rawMidis: (number | null)[] = [null, null, null, null, null, null];
    for (const n of g) {
      midis[n.idx] = Math.round(n.midi);
      rawMidis[n.idx] = n.midi;
    }
    out.push({ time: t0, midis, rawMidis });
  });
  return out;
}

export interface SingleEventTruth {
  time: number;
  idx: number;
  midi: number;
  rawMidi: number;
}

function contourDeviationCents(contour: readonly ContourPoint[] | undefined, note: JamsNote): number {
  if (!contour) return 0;
  const ref = 440 * 2 ** ((Math.round(note.midi) - 69) / 12);
  let max = 0;
  for (const p of contour) {
    if (p.time < note.time || p.time > note.time + note.duration || !p.voiced || p.hz <= 0) continue;
    max = Math.max(max, Math.abs(1200 * Math.log2(p.hz / ref)));
  }
  return max;
}

/**
 * Single-note events (solo clips): duration ≥ 400 ms, next onset ≥ 400 ms later, no other note sounding in the
 * 150 ms before the onset, and a pitch contour that stays within ±35 cents of the note (no bends/slides/vibrato).
 */
export function singleEvents(parsed: ParsedJams, f: EventFilters): SingleEventTruth[] {
  const notes = parsed.notes;
  const out: SingleEventTruth[] = [];
  notes.forEach((n, i) => {
    if (n.duration * 1000 < f.singleMinDurationMs) return;
    const next = notes.slice(i + 1).find((m) => m.time > n.time);
    if (next && (next.time - n.time) * 1000 < f.singleMinGapToNextOnsetMs) return;
    if (notes.some((m) => m !== n && m.time >= n.time && m.time - n.time < 1e-6)) return;
    const before = n.time - f.singleIsolationBeforeMs / 1000;
    if (notes.some((m) => m !== n && m.time < n.time && m.time + m.duration > before)) return;
    if (contourDeviationCents(parsed.contours.get(n.idx), n) > f.singleMaxPitchContourDevCents) return;
    out.push({ time: n.time, idx: n.idx, midi: Math.round(n.midi), rawMidi: n.midi });
  });
  return out;
}

/** Onset-F1 truth: every note onset of a comp clip grouped within onsetF1GroupMs (any group size). */
export function onsetTruth(notes: readonly JamsNote[], f: EventFilters): number[] {
  return groupOnsets(notes, f.onsetF1GroupMs).map((g) => g[0]!.time);
}

/**
 * Calibration emulation: per-string median offset (cents) of annotated MIDI from the nearest semitone over the
 * whole clip — what the app's tuner calibration (δ) would have measured on that guitar.
 */
export function stringOffsetsCents(notes: readonly JamsNote[]): number[] {
  return [0, 1, 2, 3, 4, 5].map((idx) => {
    const offs = notes
      .filter((n) => n.idx === idx)
      .map((n) => (n.midi - Math.round(n.midi)) * 100)
      .sort((a, b) => a - b);
    return offs.length ? offs[offs.length >> 1]! : 0;
  });
}
