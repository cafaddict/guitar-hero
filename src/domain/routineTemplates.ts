/**
 * Stage time templates (SPEC v1.1 §7.3-2), in seconds of "block time". Row order is the default placement
 * order; the generator fills each slot with an exercise and parameters (rules 3, 6, 10). Every template sums to
 * its length T on both kinds of day (with and without self-check items, §11.12) — a unit test checks it.
 *
 * Stage 8–11 follow the research M8 routine (01:138): repertoire 5, OMC/PFC, pentatonic, strumming, riff, open
 * notes, new songs 10 → mapped onto the app's exercises; the repertoire block doubles as the warm-up (01:265).
 */

export type TemplateSlot =
  | { kind: 'tuning' }
  /** Stage 7+: due song (or oldest repertoire song) in perform / hidden stage (§11.10). */
  | { kind: 'repertoire' }
  /** Stage 0 warm-up: muted quarter-note strumming. */
  | { kind: 'strumFixed'; block: 'warmup' | 'rhythm'; patternId: string; mode: 'mute' | 'single' }
  | { kind: 'stretch' }
  /** K1 items due today (only on "K1 days"). */
  | { kind: 'selfCheck' }
  | { kind: 'chordFixed'; chordClass: string }
  /** A new chord of the stage (rotating among them); after a > 3-day gap, the previous stage's chord. */
  | { kind: 'chordNew' }
  /** Due chord review, then a pluck-mode prescription, then the weakest unlocked chord. */
  | { kind: 'chordWeak' }
  | { kind: 'change'; rule: 'slot1' | 'slot2' | 'pfc' }
  | { kind: 'rest' }
  | { kind: 'drillFixed'; pair: string }
  | { kind: 'oneBeatFixed'; progression: readonly string[] }
  | { kind: 'rotation'; list: 'rhythm' | 'scales' | 'technique' | 'knowledge' }
  | { kind: 'fixed'; exerciseType: string; params: Readonly<Record<string, unknown>>; block: 'technique' }
  /** An exercise the user added in the routine editor (§7.3-9); params refilled by rule 10 (tempo). */
  | { kind: 'custom'; exerciseType: string; params: Readonly<Record<string, unknown>> }
  | { kind: 'recall' }
  /** Stage 1–6 practice song (a due song review is played once first, §7.3-6). */
  | { kind: 'song' }
  /** Stage 7: song memorization (hidden chart). */
  | { kind: 'songMemorize' };

export interface TemplateRow {
  slot: TemplateSlot;
  sec: number;
  /** Seconds on a day with self-check items (absent = same as `sec`; 0 = the row is left out that day). */
  secOnK1Day?: number;
  /** The row exists only on self-check days. */
  k1Only?: boolean;
}

export interface StageTemplate {
  id: string;
  /** Template length T in seconds (Stage 0–7: 20 min, Stage 8–11: 30 min). */
  lengthSec: number;
  rows: readonly TemplateRow[];
  /** Index of the row after which a 30-minute session may be split (§7.3-11), or null. */
  splitAfterRow: number | null;
}

const row = (slot: TemplateSlot, sec: number, extra: Partial<TemplateRow> = {}): TemplateRow => ({
  slot,
  sec,
  ...extra,
});
const changes = (rules: readonly ('slot1' | 'slot2' | 'pfc')[]): TemplateRow[] =>
  rules.flatMap((rule, i) => [
    ...(i > 0 ? [row({ kind: 'rest' }, 30)] : []),
    row({ kind: 'change', rule }, 60),
  ]);

const STAGE0: StageTemplate = {
  id: 'stage0',
  lengthSec: 1200,
  rows: [
    row({ kind: 'tuning' }, 120),
    row({ kind: 'strumFixed', block: 'warmup', patternId: 'P0', mode: 'mute' }, 120),
    row({ kind: 'selfCheck' }, 60, { k1Only: true }),
    row({ kind: 'strumFixed', block: 'rhythm', patternId: 'P0', mode: 'mute' }, 180),
    row({ kind: 'fixed', exerciseType: 'Q1', params: {}, block: 'technique' }, 240),
    row({ kind: 'fixed', exerciseType: 'E16', params: {}, block: 'technique' }, 240, { secOnK1Day: 180 }),
    row({ kind: 'fixed', exerciseType: 'Q1', params: {}, block: 'technique' }, 180),
    row({ kind: 'fixed', exerciseType: 'E0', params: { drill: true }, block: 'technique' }, 120),
  ],
  splitAfterRow: null,
};

const STAGE1: StageTemplate = {
  id: 'stage1',
  lengthSec: 1200,
  rows: [
    row({ kind: 'tuning' }, 60),
    row({ kind: 'chordFixed', chordClass: 'D' }, 120),
    row({ kind: 'chordFixed', chordClass: 'A' }, 120),
    ...changes(['slot1', 'slot2']),
    row({ kind: 'drillFixed', pair: 'A|D' }, 60),
    row({ kind: 'oneBeatFixed', progression: ['D', 'A', 'D', 'A'] }, 90),
    row({ kind: 'recall' }, 60),
    row({ kind: 'song' }, 540),
  ],
  splitAfterRow: null,
};

const STAGE2_3: StageTemplate = {
  id: 'stage2-3',
  lengthSec: 1200,
  rows: [
    row({ kind: 'tuning' }, 60),
    row({ kind: 'selfCheck' }, 60, { k1Only: true }),
    row({ kind: 'chordNew' }, 60),
    row({ kind: 'chordWeak' }, 60),
    ...changes(['slot1', 'slot2']),
    row({ kind: 'rotation', list: 'rhythm' }, 120),
    row({ kind: 'rotation', list: 'technique' }, 90),
    row({ kind: 'recall' }, 60),
    row({ kind: 'song' }, 600, { secOnK1Day: 540 }),
  ],
  splitAfterRow: null,
};

const STAGE4_6: StageTemplate = {
  id: 'stage4-6',
  lengthSec: 1200,
  rows: [
    row({ kind: 'tuning' }, 60),
    row({ kind: 'stretch' }, 60),
    row({ kind: 'chordNew' }, 60),
    row({ kind: 'chordWeak' }, 60),
    ...changes(['slot1', 'slot2']),
    row({ kind: 'rotation', list: 'rhythm' }, 120),
    row({ kind: 'rotation', list: 'technique' }, 90),
    row({ kind: 'recall' }, 60),
    row({ kind: 'song' }, 540),
  ],
  splitAfterRow: null,
};

const STAGE7: StageTemplate = {
  id: 'stage7',
  lengthSec: 1200,
  rows: [
    row({ kind: 'tuning' }, 60),
    row({ kind: 'repertoire' }, 300),
    row({ kind: 'stretch' }, 60),
    row({ kind: 'chordWeak' }, 60),
    ...changes(['slot1', 'slot2']),
    row({ kind: 'rotation', list: 'rhythm' }, 120),
    row({ kind: 'rotation', list: 'technique' }, 90),
    row({ kind: 'recall' }, 60),
    row({ kind: 'songMemorize' }, 300),
  ],
  splitAfterRow: null,
};

const STAGE8_11_ROWS: readonly TemplateRow[] = [
  row({ kind: 'tuning' }, 60),
  row({ kind: 'repertoire' }, 300),
  row({ kind: 'chordNew' }, 60),
  row({ kind: 'chordWeak' }, 60),
  ...changes(['slot1', 'pfc', 'slot2']),
  row({ kind: 'rotation', list: 'rhythm' }, 180),
  row({ kind: 'rotation', list: 'scales' }, 120),
  row({ kind: 'selfCheck' }, 60, { k1Only: true }),
  row({ kind: 'rotation', list: 'technique' }, 120, { secOnK1Day: 60 }),
  row({ kind: 'recall' }, 60),
  row({ kind: 'rotation', list: 'knowledge' }, 60),
  row({ kind: 'song' }, 540),
];

const STAGE8_11: StageTemplate = {
  id: 'stage8-11',
  lengthSec: 1800,
  rows: STAGE8_11_ROWS,
  // "여기서 나눠 하기" right after the rhythm block (§7.3-11).
  splitAfterRow: STAGE8_11_ROWS.findIndex((r) => r.slot.kind === 'rotation' && r.slot.list === 'rhythm'),
};

export function stageTemplate(stage: number): StageTemplate {
  if (stage <= 0) return STAGE0;
  if (stage === 1) return STAGE1;
  if (stage <= 3) return STAGE2_3;
  if (stage <= 6) return STAGE4_6;
  if (stage === 7) return STAGE7;
  return STAGE8_11;
}

/** Seconds of a row on a day with (or without) self-check items; 0 = the row is not used that day. */
export function rowSeconds(r: TemplateRow, k1Day: boolean): number {
  if (r.k1Only && !k1Day) return 0;
  return k1Day && r.secOnK1Day !== undefined ? r.secOnK1Day : r.sec;
}

export function templateTotal(template: StageTemplate, k1Day: boolean): number {
  return template.rows.reduce((sum, r) => sum + rowSeconds(r, k1Day), 0);
}
