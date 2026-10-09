import { describe, expect, it } from 'vitest';
import { pairId } from '../domain/pairs';
import { unlockedChordClasses } from '../domain/progression';
import { symbolRootPitchClass } from '../domain/theory';
import { CURRICULUM } from './curriculum';
import { patternById } from './patterns';
import { songSchema, stageSchema } from './schemas';
import { BLUES_FORM, PRACTICE_SONGS, songChordClasses } from './songs';
import { classOfVoicing, hasVoicing } from './voicings';

describe('AC-D3 curriculum data', () => {
  // v1.1 §7.2 opens Stage 8–11 (v1: a locked preview) with a minimum stay of 8 sessions + 14 days.
  it('defines stages 0–11, all playable; 0–7 keep 4 sessions, 8–11 need 8 sessions and 14 days', () => {
    expect(CURRICULUM.map((s) => s.stage)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const s of CURRICULUM) {
      expect(() => stageSchema.parse(s)).not.toThrow();
      expect(s.locked).toBe(false);
      expect(s.unlockRules.length, `stage ${s.stage} has rules`).toBeGreaterThan(0);
      if (s.stage <= 7) expect(s.unlockRules).toContainEqual({ kind: 'sessionsInStageAtLeast', count: 4 });
      else {
        expect(s.unlockRules).toContainEqual({ kind: 'sessionsInStageAtLeast', count: 8 });
        expect(s.unlockRules).toContainEqual({ kind: 'daysInStageAtLeast', days: 14 });
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

  it('SPEC v1.1 §6.6: ≥ 18 songs, ≥ 2 per stage 8–11, an F song without the barre, a palm-mute power song, three shuffle blues in G, A, E', () => {
    expect(PRACTICE_SONGS.length).toBeGreaterThanOrEqual(18);
    for (let stage = 8; stage <= 11; stage++)
      expect(PRACTICE_SONGS.filter((s) => s.stage === stage).length, `stage ${stage}`).toBeGreaterThanOrEqual(
        2,
      );
    const f = PRACTICE_SONGS.filter((s) => s.stage === 9);
    expect(f.some((s) => songChordClasses(s).some((c) => c.startsWith('F')))).toBe(true);
    expect(
      f.some(
        (s) =>
          songChordClasses(s).some((c) => c === 'Fmaj7' || c === 'F-small') &&
          !songChordClasses(s).includes('F'),
      ),
    ).toBe(true);
    expect(PRACTICE_SONGS.some((s) => s.stage === 10 && s.palmMute === true)).toBe(true);
    for (const s of PRACTICE_SONGS.filter((x) => x.stage === 10))
      expect(songChordClasses(s).every((c) => c.endsWith('5'))).toBe(true);
    const blues = PRACTICE_SONGS.filter((s) => s.stage === 11);
    expect(blues).toHaveLength(3);
    const keys: Record<string, [string, string, string]> = {};
    for (const song of blues) {
      expect(song.feel).toBe('shuffle');
      expect(patternById(song.patternId).swing).toBe(true);
      for (const section of song.sections) {
        expect(section.bars).toHaveLength(12);
        const [i, iv, v] = [section.bars[0]!, section.bars[4]!, section.bars[8]!];
        keys[song.id] = [i, iv, v];
        const degree = { I: i, IV: iv, V: v };
        expect(section.bars).toEqual(BLUES_FORM.map((d) => degree[d]));
        // I–IV–V a fourth and a fifth above the tonic, all 7th chords.
        const pc = (c: string) => symbolRootPitchClass(c)!;
        expect((pc(iv) - pc(i) + 12) % 12).toBe(5);
        expect((pc(v) - pc(i) + 12) % 12).toBe(7);
        for (const c of [i, iv, v]) expect(c.endsWith('7')).toBe(true);
      }
    }
    expect(new Set(Object.values(keys).map((k) => k[0]))).toEqual(new Set(['G7', 'A7', 'E7']));
  });
});
