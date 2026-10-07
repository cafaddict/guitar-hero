import { describe, expect, it } from 'vitest';
import { CORE_PAIRS, pairId, parseDirected } from '../domain/pairs';
import { unlockedChordClasses } from '../domain/progression';
import { CURRICULUM } from './curriculum';
import { patternById } from './patterns';
import { songSchema, stageSchema } from './schemas';
import { PRACTICE_SONGS, songChordClasses } from './songs';
import { classOfVoicing, hasVoicing } from './voicings';

describe('AC-D3 curriculum data', () => {
  it('defines stages 0–11; 0–7 playable, 8–11 locked preview', () => {
    expect(CURRICULUM.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const s of CURRICULUM) {
      expect(() => stageSchema.parse(s)).not.toThrow();
      expect(s.locked).toBe(s.stage >= 8);
      if (!s.locked) {
        expect(s.unlockRules.length, `stage ${s.stage} has rules`).toBeGreaterThan(0);
        expect(s.unlockRules).toContainEqual({ kind: 'sessionsInStageAtLeast', count: 4 });
      }
    }
  });

  it('introduces chords in the order D, A → E → Em, Am → Dm → C → G', () => {
    expect(CURRICULUM.slice(0, 8).map((s) => s.newChords)).toEqual([
      [],
      ['D', 'A'],
      ['E'],
      ['Em', 'Am'],
      ['Dm'],
      ['C'],
      ['G-2f', 'G-3f'],
      [],
    ]);
    for (const s of CURRICULUM) for (const id of s.newChords) expect(hasVoicing(id)).toBe(true);
  });

  it('expresses unlock rules as data (rule kinds only, no per-stage code)', () => {
    const kinds = new Set(CURRICULUM.flatMap((s) => s.unlockRules.map((r) => r.kind)));
    expect([...kinds].sort()).toEqual([
      'countAtLeast',
      'examPassed',
      'metricAtLeast',
      'recallUnlocked',
      'sessionsInStageAtLeast',
      'unlockedPairsAtLeast',
    ]);
    expect(CURRICULUM[7]!.unlockRules).toContainEqual({ kind: 'examPassed' });
  });

  it('focus pairs are core pairs among chords unlocked at that stage', () => {
    const core = new Set(CORE_PAIRS.map(([a, b]) => pairId(a, b)));
    for (const s of CURRICULUM.filter((x) => !x.locked)) {
      const unlocked = new Set(unlockedChordClasses(CURRICULUM, s.stage));
      for (const dir of s.focusPairs) {
        const [a, b] = parseDirected(dir);
        expect(core.has(pairId(a, b)), `${dir} is a core pair`).toBe(true);
        expect(unlocked.has(a) && unlocked.has(b), `${dir} unlocked at stage ${s.stage}`).toBe(true);
      }
      for (const r of s.rhythm) expect(() => patternById(r.patternId)).not.toThrow();
    }
  });

  it('has ≥ 8 practice songs, ≥ 1 per stage 1–7, each using only chords learned by its stage', () => {
    expect(PRACTICE_SONGS.length).toBeGreaterThanOrEqual(8);
    for (let stage = 1; stage <= 7; stage++) {
      expect(
        PRACTICE_SONGS.some((s) => s.stage === stage),
        `stage ${stage} song`,
      ).toBe(true);
    }
    for (const song of PRACTICE_SONGS) {
      expect(() => songSchema.parse(song)).not.toThrow();
      const allowed = new Set(unlockedChordClasses(CURRICULUM, song.stage));
      for (const chord of songChordClasses(song)) {
        expect(allowed.has(classOfVoicing(chord)), `${song.id} uses ${chord} at stage ${song.stage}`).toBe(
          true,
        );
      }
      expect(patternById(song.patternId).timeSignature).toBe(song.timeSignature);
      expect(song.bpmMin).toBeLessThanOrEqual(song.bpmDefault);
    }
    expect(new Set(PRACTICE_SONGS.map((s) => s.id)).size).toBe(PRACTICE_SONGS.length);
  });
});
