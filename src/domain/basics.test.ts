import { describe, expect, it } from 'vitest';
import { changesPerMinute, extractMetrics, METRIC_EXTRACTORS } from './exerciseResults';
import { newId } from './ids';
import { pairDirKey, pairKey, pairsAmong } from './pairs';
import { deriveSeed, gaussian, mulberry32, randInt, shuffled } from './prng';
import { stringIdx, stringNumber } from './strings';
import { centsBetween, hzToMidi, midiName, midiToHz, nameToMidi, partialHz, STANDARD_TUNING } from './theory';

describe('strings (SPEC §6.1)', () => {
  it('idx 0 is the 6th string and idx 5 the 1st', () => {
    expect([0, 1, 2, 3, 4, 5].map(stringNumber)).toEqual([6, 5, 4, 3, 2, 1]);
    expect([6, 5, 4, 3, 2, 1].map(stringIdx)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(() => stringNumber(6)).toThrow();
    expect(() => stringIdx(0)).toThrow();
  });
});

describe('theory', () => {
  it('standard tuning E2 A2 D3 G3 B3 E4', () => {
    expect(STANDARD_TUNING.openMidi.map(midiName)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
    expect(midiToHz(69)).toBe(440);
    expect(hzToMidi(midiToHz(40))).toBeCloseTo(40, 10);
    expect(centsBetween(880, 440)).toBeCloseTo(1200, 10);
    expect(nameToMidi('E2')).toBe(40);
    expect(nameToMidi('C#4')).toBe(61);
    expect(nameToMidi('Bb3')).toBe(58);
    expect(partialHz(100, 2, 0)).toBe(200);
    expect(partialHz(100, 2, 1e-4)).toBeCloseTo(200 * Math.sqrt(1.0004), 10);
  });
});

describe('prng', () => {
  it('is deterministic and uniform-ish', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    const r = mulberry32(2);
    for (let i = 0; i < 100; i++) {
      const v = randInt(r, 3, 5);
      expect(v >= 3 && v <= 5).toBe(true);
    }
    expect(shuffled(mulberry32(3), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
    expect(Number.isFinite(gaussian(mulberry32(4)))).toBe(true);
    expect(deriveSeed(1, 'x')).not.toBe(deriveSeed(1, 'y'));
  });
});

describe('pairs', () => {
  it('builds sorted keys', () => {
    expect(pairKey('D', 'A')).toBe('pair:A|D');
    expect(pairDirKey('A', 'D')).toBe('pairdir:A>D');
    expect(pairsAmong(['D', 'A', 'E']).sort()).toEqual(['A|D', 'A|E', 'D|E']);
  });
});

describe('metric extractors', () => {
  it('covers every v1 exercise type', () => {
    expect(Object.keys(METRIC_EXTRACTORS).sort()).toEqual([
      'E0',
      'E1',
      'E2',
      'E4',
      'E5',
      'E6',
      'E7',
      'E8',
      'EXAM',
      'Q1',
      'Q2',
      'Q3',
      'Q4',
      'S',
    ]);
  });

  it('E2 uses corrected ?? detected, scaled per minute', () => {
    const base = {
      pair: 'A|D',
      direction: 'A>D',
      durationMs: 30_000,
      countMode: 'auto' as const,
      detectedChanges: 14,
      correctedChanges: null,
      tapChanges: null,
      lowConfidenceEvents: 0,
      changeTimestampsMs: [],
    };
    expect(changesPerMinute(base)).toBe(28);
    expect(changesPerMinute({ ...base, correctedChanges: 15 })).toBe(30);
    expect(changesPerMinute({ ...base, countMode: 'tap', tapChanges: 10 })).toBe(20);
    expect(extractMetrics('E2', base)).toEqual([
      { subjectKey: 'pairdir:A>D', metric: 'cpm', value: 28 },
      { subjectKey: 'pair:A|D', metric: 'cpm', value: 28 },
    ]);
  });

  it('E1 counts Mode A / manual attempts as clean, Mode B only as strumPass', () => {
    const attempt = {
      perString: [
        { idx: 1, status: 'OK' as const, selfStatus: null, cents: 2, confidence: 0.9, semitones: null },
      ],
      clean: true,
      strumVerdict: 'PASS' as const,
      selfAgreement: null,
    };
    const pluck = extractMetrics('E1', {
      voicingId: 'C',
      mode: 'pluck',
      earFirst: false,
      attempts: [attempt],
      cleanRatio: 1,
    });
    expect(pluck).toContainEqual({ subjectKey: 'chord:C', metric: 'clean', value: 1 });
    expect(pluck).toContainEqual({ subjectKey: 'chordstring:C:1', metric: 'clean', value: 1 });
    const strum = extractMetrics('E1', {
      voicingId: 'C',
      mode: 'strum',
      earFirst: false,
      attempts: [attempt],
      cleanRatio: 1,
    });
    expect(strum).toEqual([{ subjectKey: 'chord:C', metric: 'strumPass', value: 1 }]);
  });

  it('Q2 passes only when correct within 3 s', () => {
    const out = extractMetrics('Q2', {
      items: [
        { chordClass: 'D', voicingId: 'D', correct: true, reactionMs: 2500, method: 'mic' },
        { chordClass: 'A', voicingId: 'A', correct: true, reactionMs: 3500, method: 'mic' },
      ],
    });
    expect(out).toContainEqual({ subjectKey: 'recall:D', metric: 'pass', value: 1 });
    expect(out).toContainEqual({ subjectKey: 'recall:A', metric: 'pass', value: 0 });
  });

  it('rejects malformed results', () => {
    expect(() => extractMetrics('E2', { pair: 'A|D' })).toThrow();
    expect(() => extractMetrics('NOPE', {})).toThrow(/no metric extractor/);
  });
});

describe('newId', () => {
  it('produces distinct RFC 4122 v4 ids', () => {
    const ids = new Set(Array.from({ length: 1000 }, newId));
    expect(ids.size).toBe(1000);
    for (const id of ids)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
