/**
 * SPEC v1.1 record semantics: qualified one-minute runs (§7.1 "55초"), ladder tempos (§7.4), song stages
 * (§11.10), knowledge cards (§7.5), the E7 start fret from records (§7.4), stage templates (§7.3-2).
 */
import { describe, expect, it } from 'vitest';
import { cardAnswers, deriveAll } from './derive';
import { extractMetrics, ladderNextBpm } from './exerciseResults';
import { type Attempt, DAY_MS } from './records';
import { stageTemplate, templateTotal } from './routineTemplates';
import { nextStretchStartFret, stretchStartFretFrom } from './safety';
import { recordCardAnswer } from './srs';

const T0 = new Date(2026, 9, 1, 19).getTime();

describe('v1.1 metric extraction', () => {
  const e2 = (durationMs: number, detectedChanges: number) => ({
    pair: 'A|D',
    direction: 'A>D',
    durationMs,
    countMode: 'auto',
    detectedChanges,
    correctedChanges: null,
    tapChanges: null,
    lowConfidenceEvents: 0,
    changeTimestampsMs: [],
  });

  it('only one-minute-change runs of at least 55 s count toward per-minute criteria (§7.1)', () => {
    const full = extractMetrics('E2', e2(60_000, 31));
    expect(full).toContainEqual({ subjectKey: 'pair:A|D', metric: 'cpmQualified', value: 31 });
    const short = extractMetrics('E2', e2(30_000, 16));
    // The 30 s run is stored (cpm 32/min) but never scaled up into a pass.
    expect(short).toContainEqual({ subjectKey: 'pair:A|D', metric: 'cpm', value: 32 });
    expect(short.some((m) => m.metric === 'cpmQualified')).toBe(false);
    expect(extractMetrics('E2', e2(55_000, 30)).some((m) => m.metric === 'cpmQualified')).toBe(true);
  });

  it('tempo ladders store the tempo the next run starts at (§7.4 "사다리 현재 BPM")', () => {
    expect(ladderNextBpm(60, 'up')).toBe(65);
    expect(ladderNextBpm(60, 'down')).toBe(55);
    expect(ladderNextBpm(32, 'down')).toBe(30);
    const strum = {
      patternId: 'P3',
      bpm: 70,
      bars: 8,
      mode: 'single',
      hits: 30,
      misses: 0,
      extras: 0,
      meanOffsetMs: 0,
      sdOffsetMs: 10,
      hitRate: 0.95,
      hitRateCorrected: 0.95,
      cuesHidden: false,
      ladder: 'up',
      passed: true,
      source: 'mic',
    };
    expect(extractMetrics('E5', strum)).toContainEqual({
      subjectKey: 'strum:P3:single',
      metric: 'ladderBpm',
      value: 75,
    });
    expect(extractMetrics('E5', { ...strum, ladder: 'down', passed: false })).toContainEqual({
      subjectKey: 'strum:P3:single',
      metric: 'ladderBpm',
      value: 65,
    });
    const onebeat = {
      progression: ['D', 'A'],
      patternId: 'P0',
      bpm: 60,
      bars: 16,
      barsInWindow: 15,
      stops: 0,
      beat1DelayMsMean: 20,
      missingBarRatio: 0,
      passed: true,
      source: 'mic',
    };
    expect(extractMetrics('E6', onebeat)).toContainEqual({
      subjectKey: 'onebeat:D-A',
      metric: 'ladderBpm',
      value: 65,
    });
    const altpick = {
      stringIdx: 3,
      bpm: 70,
      bars: 8,
      hitRate: 0.8,
      ioiCv: 0.2,
      passed: false,
      source: 'mic',
    };
    expect(extractMetrics('E8', altpick)).toContainEqual({
      subjectKey: 'altpick:3',
      metric: 'ladderBpm',
      value: 70,
    });
  });

  it('song stages: full learn runs, perform completion (≤ 2 stops), memorized (≤ 1), repertoire (0) (§11.10)', () => {
    const song = (mode: string, chartHidden: boolean, completed: boolean, stops: number) =>
      extractMetrics('S', {
        songId: 's03',
        mode,
        chartHidden,
        bpm: 65,
        completed,
        stops,
        memorized: false,
        beat1HitRate: null,
      });
    expect(song('learn', false, true, 3)).toContainEqual({
      subjectKey: 'song:s03',
      metric: 'learnFull',
      value: 1,
    });
    expect(song('perform', false, true, 2)).toContainEqual({
      subjectKey: 'song:s03',
      metric: 'performCompleted',
      value: 1,
    });
    expect(song('perform', false, true, 3)).toContainEqual({
      subjectKey: 'song:s03',
      metric: 'performCompleted',
      value: 0,
    });
    expect(song('perform', true, true, 1)).toContainEqual({
      subjectKey: 'song:s03',
      metric: 'hiddenMemorized',
      value: 1,
    });
    expect(song('perform', false, true, 0)).toContainEqual({
      subjectKey: 'song:s03',
      metric: 'repertoire',
      value: 1,
    });
    expect(song('perform', false, true, 1).some((m) => m.metric === 'repertoire')).toBe(false);
  });
});

describe('knowledge cards (§7.5, D-055)', () => {
  it('new card → 1 day; correct and fast → next interval; correct but slow → same; wrong → back to 1 day', () => {
    const first = recordCardAnswer(undefined, 'card:recall:D', true, 2000, T0);
    expect(first).toMatchObject({ kind: 'card', step: 0, due: T0 + DAY_MS });
    const fast = recordCardAnswer(first, 'card:recall:D', true, 2000, T0 + DAY_MS);
    expect(fast).toMatchObject({ step: 1, due: T0 + DAY_MS + 3 * DAY_MS });
    const slow = recordCardAnswer(fast, 'card:recall:D', true, 4000, T0 + 4 * DAY_MS);
    expect(slow).toMatchObject({ step: 1, due: T0 + 4 * DAY_MS + 3 * DAY_MS });
    const wrong = recordCardAnswer(slow, 'card:recall:D', false, null, T0 + 7 * DAY_MS);
    expect(wrong).toMatchObject({ step: 0, due: T0 + 8 * DAY_MS, lapses: 1 });
  });

  it('Q2 attempts update one chord card per answer in the derived review queue', () => {
    const attempt: Attempt = {
      id: 'q',
      sessionId: 's',
      exerciseType: 'Q2',
      exerciseVersion: 1,
      startedAt: T0,
      endedAt: T0,
      params: {},
      result: {
        items: [
          { chordClass: 'D', voicingId: 'D', correct: true, reactionMs: 2000, method: 'self' },
          { chordClass: 'A', voicingId: 'A', correct: false, reactionMs: null, method: 'self' },
        ],
      },
      detectorVersion: null,
      processingMs: 0,
      reviewOf: null,
    };
    expect(cardAnswers(attempt).map((a) => a.subjectKey)).toEqual(['card:recall:D', 'card:recall:A']);
    const derived = deriveAll([attempt]);
    expect(derived.reviews.get('card:recall:D')).toMatchObject({ kind: 'card', step: 0 });
    expect(derived.reviews.get('card:recall:A')).toMatchObject({ kind: 'card', lapses: 1 });
  });
});

describe('E7 start fret from the records (§7.4, AC-PG3)', () => {
  it('lowers one fret after three runs with pain ≤ 2 at the current fret, down to 1', () => {
    expect(stretchStartFretFrom([])).toBe(5);
    const at = (fret: number, pains: number[]) => pains.map((pain) => ({ startFret: fret, pain }));
    expect(stretchStartFretFrom(at(5, [1, 2]))).toBe(5);
    expect(stretchStartFretFrom(at(5, [1, 2, 0]))).toBe(4);
    // A painful run among the last three keeps the fret.
    expect(stretchStartFretFrom(at(5, [0, 0, 0, 4]))).toBe(5);
    // After lowering, the next three runs at the new fret decide again.
    expect(stretchStartFretFrom([...at(5, [0, 0, 0]), ...at(4, [0])])).toBe(4);
    expect(stretchStartFretFrom(at(1, [0, 0, 0]))).toBe(1);
    expect(nextStretchStartFret(2, [0, 1, 2])).toBe(1);
  });
});

describe('stage time templates (§7.3-2)', () => {
  it('every template sums to T on days with and without self-check items', () => {
    for (let stage = 0; stage <= 11; stage++) {
      const template = stageTemplate(stage);
      const t = stage <= 7 ? 1200 : 1800;
      expect(template.lengthSec).toBe(t);
      expect(templateTotal(template, true), `stage ${stage} K1 day`).toBe(t);
      expect(templateTotal(template, false), `stage ${stage}`).toBe(t);
    }
    expect(stageTemplate(8).splitAfterRow).not.toBeNull();
    expect(stageTemplate(7).splitAfterRow).toBeNull();
  });
});
