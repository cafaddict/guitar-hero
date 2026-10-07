/**
 * Recording kit plan and export labels (SPEC §13.4). The guided clip list per chord: clean strum, string-by-
 * string plucks, one string deliberately muted, the x string ringing (chords with x strings), then a 30 s
 * one-minute-change clip (the user enters the count) and 8 bars against the metronome. labels.json matches
 * tools/bench/real.ts (`bench:real`).
 */
import { voicingById, voicingForClass } from '../../content/voicings';
import type { Calibration, RecordingMeta } from '../../domain/records';
import { STANDARD_TUNING } from '../../domain/theory';
import { partialCollisionMap } from '../../domain/voicing';

export type ClipKind =
  | 'chord-strum'
  | 'chord-pluck'
  | 'chord-muted'
  | 'x-string'
  | 'one-minute'
  | 'strum-grid';

export interface PlannedClip {
  id: string;
  kind: ClipKind;
  voicingId: string | null;
  /** Fixed recording length (s); one-minute and strum-grid clips stop on their own. */
  seconds: number;
  expected: Record<string, unknown>;
}

export const STRUM_GRID = { patternId: 'P0', bpm: 70, bars: 8 } as const;

export function recordingPlan(chordClasses: readonly string[], gVoicing: 'G-2f' | 'G-3f'): PlannedClip[] {
  const classes = chordClasses.length > 0 ? chordClasses.slice(-3) : ['C', 'D', 'G'];
  const clips: PlannedClip[] = [];
  for (const cls of classes) {
    const v = voicingById(voicingForClass(cls, gVoicing));
    const played = v.frets.flatMap((f, i) => (f === 'x' ? [] : [i]));
    const verifiable = partialCollisionMap(v, STANDARD_TUNING)
      .filter((s) => s.verifiable)
      .map((s) => s.idx);
    clips.push({
      id: `${v.id}-strum`,
      kind: 'chord-strum',
      voicingId: v.id,
      seconds: 4,
      expected: { verdict: 'PASS' },
    });
    clips.push({
      id: `${v.id}-pluck`,
      kind: 'chord-pluck',
      voicingId: v.id,
      seconds: 4 + played.length * 1.5,
      expected: { strings: played },
    });
    const muted = verifiable[0];
    if (muted !== undefined)
      clips.push({
        id: `${v.id}-muted`,
        kind: 'chord-muted',
        voicingId: v.id,
        seconds: 4,
        expected: { mutedStringIdx: muted },
      });
    const x = v.frets.indexOf('x');
    if (x >= 0)
      clips.push({
        id: `${v.id}-x`,
        kind: 'x-string',
        voicingId: v.id,
        seconds: 4,
        expected: { ringingIdx: x },
      });
  }
  if (classes.length >= 2) {
    const [a, b] = classes.slice(-2) as [string, string];
    clips.push({
      id: `change-${a}-${b}`,
      kind: 'one-minute',
      voicingId: null,
      seconds: 30,
      expected: { direction: `${a}>${b}` },
    });
  }
  const gridSeconds = ((1 + STRUM_GRID.bars) * 4 * 60) / STRUM_GRID.bpm + 1.5;
  clips.push({
    id: 'strum-grid',
    kind: 'strum-grid',
    voicingId: null,
    seconds: gridSeconds,
    expected: { ...STRUM_GRID },
  });
  return clips;
}

export function clipFileName(clipId: string, createdAt: number): string {
  return `${clipId}-${createdAt}.wav`;
}

/** labels.json for an export (only the newest take of each planned clip). */
export function buildLabels(
  recordings: readonly RecordingMeta[],
  device: string,
  sampleRate: number,
  calibration: Calibration | null,
) {
  const newest = new Map<string, RecordingMeta>();
  for (const r of recordings)
    if ((newest.get(r.label)?.createdAt ?? -1) < r.createdAt) newest.set(r.label, r);
  return {
    app: 'guitar-hero' as const,
    kind: 'recording-kit' as const,
    version: 1,
    device,
    sampleRate,
    calibration: calibration ? { tuningCents: calibration.tuningCents, rttMs: calibration.rttMs } : null,
    clips: [...newest.values()]
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((r) => ({
        file: r.fileName,
        label: r.label,
        kind: r.kind as ClipKind,
        voicingId: r.voicingId,
        expected: r.expected,
      })),
  };
}
