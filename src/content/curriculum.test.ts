import { describe, expect, it } from 'vitest';
import { pairId } from '../domain/pairs';
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

  it('expresses unlock rules as data (rule kinds only, no per-stage code; v1.1 §7.4 kinds)', () => {
    const kinds = new Set(CURRICULUM.flatMap((s) => s.unlockRules.map((r) => r.kind)));
    expect([...kinds].sort()).toEqual([
      'chordCleanRatioAtLeast',
      'countAtLeast',
      'daysInStageAtLeast',
      'examPassed',
      'metricAtLeast',
      'pairsPassedAtLeast',
      'quizRunAtLeast',
      'recallPassed',
      'scaleMemorized',
      'scaleStepGraduated',
      'sessionsInStageAtLeast',
      'songsCompletedAtLeast',
      'unlockedPairsAtLeast',
    ]);
    expect(CURRICULUM[7]!.unlockRules).toContainEqual({ kind: 'examPassed' });
    // §7.1 / §7.2: Stage 8–11 stay at least 8 sessions and 14 days.
    for (const s of CURRICULUM.filter((x) => x.stage >= 8)) {
      expect(s.unlockRules).toContainEqual({ kind: 'sessionsInStageAtLeast', count: 8 });
      expect(s.unlockRules).toContainEqual({ kind: 'daysInStageAtLeast', days: 14 });
    }
  });

  it('pairs and E5 progressions (v1.1 §6.5, §6.10): Stage 8–11 own pair sets, progressions of ≥ 2 chords', () => {
    expect(CURRICULUM.map((s) => s.stagePairs.length)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 5, 8]);
    for (const s of CURRICULUM) {
      for (const id of s.stagePairs)
        expect(id, `${id} sorted`).toBe(pairId(...(id.split('|') as [string, string])));
      if (s.stage === 0) expect(s.rhythmProgression).toEqual([]);
      else
        expect(new Set(s.rhythmProgression).size, `stage ${s.stage} progression`).toBeGreaterThanOrEqual(2);
    }
    for (const s of CURRICULUM.filter((x) => !x.locked)) {
      const unlocked = new Set(unlockedChordClasses(CURRICULUM, s.stage));
      for (const chord of s.rhythmProgression)
        expect(unlocked.has(chord), `${chord} at stage ${s.stage}`).toBe(true);
      for (const entry of [...s.rotation.rhythm])
        if (entry.type === 'E5') expect(() => patternById(String(entry.params.patternId))).not.toThrow();
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
