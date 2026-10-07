import { describe, expect, it } from 'vitest';
import { CURRICULUM, stageDef } from '../content/curriculum';
import {
  detectStagnation,
  evaluateRule,
  evaluateStage,
  graduatedItems,
  isPairPlateaued,
  promote,
  type RuleContext,
  suggestedGVoicing,
  unlockedChordClasses,
  unlockedPairIds,
} from './progression';
import { DAY_MS, dayKey, initialProgression, type MetricSample } from './records';
import { buildSkills } from './skills';

const NOW = new Date(2026, 9, 7, 19).getTime();
let counter = 0;
function s(subjectKey: string, metric: string, value: number, at: number): MetricSample {
  counter += 1;
  return { subjectKey, metric, value, at, day: dayKey(at), attemptId: `a${counter}` };
}
function ctx(samples: MetricSample[], overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    stage: 1,
    curriculum: CURRICULUM,
    skills: buildSkills(samples),
    sessionsInStage: 4,
    examPassed: false,
    now: NOW,
    ...overrides,
  };
}

describe('AC-R2 progression engine', () => {
  it('derives unlocked chords and pairs from the data', () => {
    expect(unlockedChordClasses(CURRICULUM, 1)).toEqual(['D', 'A']);
    expect(unlockedChordClasses(CURRICULUM, 6)).toEqual(['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G']);
    expect(unlockedPairIds(CURRICULUM, 1)).toEqual(['A|D']);
    expect(unlockedPairIds(CURRICULUM, 2).sort()).toEqual(['A|D', 'A|E', 'D|E']);
    expect(unlockedPairIds(CURRICULUM, 6)).toHaveLength(25);
  });

  it('Stage 0: three completed tunings + diagram quiz ≥ 90% + 4 sessions', () => {
    const def = stageDef(0);
    const partial = [
      s('tuning:session', 'complete', 1, NOW - 3 * DAY_MS),
      s('tuning:session', 'complete', 1, NOW - 2 * DAY_MS),
    ];
    expect(evaluateStage(def, ctx(partial, { stage: 0 })).allMet).toBe(false);
    const full = [
      ...partial,
      s('tuning:session', 'complete', 1, NOW - DAY_MS),
      s('quiz:diagram', 'accuracy', 0.9, NOW),
    ];
    const ev = evaluateStage(def, ctx(full, { stage: 0 }));
    expect(ev.allMet).toBe(true);
    expect(ev.progress).toBe(1);
    expect(evaluateStage(def, ctx(full, { stage: 0, sessionsInStage: 3 })).allMet).toBe(false);
  });

  it('Stage 1: recall D and A + pair A|D ≥ 30 on two different days', () => {
    const def = stageDef(1);
    const base = [s('recall:D', 'pass', 1, NOW), s('recall:A', 'pass', 1, NOW)];
    const oneDay = [
      ...base,
      s('pair:A|D', 'cpm', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpm', 33, NOW - DAY_MS + 1000),
    ];
    const ev = evaluateStage(def, ctx(oneDay));
    expect(ev.allMet).toBe(false);
    expect(ev.rules.find((r) => r.rule.kind === 'unlockedPairsAtLeast')?.missing).toEqual(['A|D']);
    const twoDays = [...oneDay, s('pair:A|D', 'cpm', 30, NOW)];
    expect(evaluateStage(def, ctx(twoDays)).allMet).toBe(true);
    const noRecall = [
      s('recall:D', 'pass', 1, NOW),
      s('pair:A|D', 'cpm', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpm', 31, NOW),
    ];
    expect(
      evaluateStage(def, ctx(noRecall)).rules.find((r) => r.rule.kind === 'recallUnlocked')?.missing,
    ).toEqual(['A']);
  });

  it('evaluates countAtLeast with prefix subjects and metricAtLeast on best values', () => {
    const c = ctx([s('song:s01', 'completed', 0, NOW), s('song:s02', 'completed', 1, NOW)], { stage: 2 });
    expect(
      evaluateRule({ kind: 'countAtLeast', subject: 'song:*', metric: 'completed', minValue: 1, count: 1 }, c)
        .met,
    ).toBe(true);
    const bpm = ctx(
      [s('strum:P2:mute', 'passBpm', 65, NOW - DAY_MS), s('strum:P2:mute', 'passBpm', 70, NOW)],
      { stage: 3 },
    );
    expect(
      evaluateRule({ kind: 'metricAtLeast', subject: 'strum:P2:mute', metric: 'passBpm', value: 70 }, bpm)
        .met,
    ).toBe(true);
    expect(
      evaluateRule({ kind: 'metricAtLeast', subject: 'strum:P2:mute', metric: 'passBpm', value: 75 }, bpm)
        .met,
    ).toBe(false);
    expect(
      evaluateRule(
        { kind: 'distinctDaysAtLeast', subject: 'strum:P2:mute', metric: 'passBpm', value: 65, days: 2 },
        bpm,
      ).met,
    ).toBe(true);
  });

  it('Stage 7 requires the graduation exam', () => {
    expect(evaluateStage(stageDef(7), ctx([], { stage: 7, examPassed: false })).allMet).toBe(false);
    expect(evaluateStage(stageDef(7), ctx([], { stage: 7, examPassed: true })).allMet).toBe(true);
  });

  it('conditional promotion: only pair rules unmet and every missing pair plateaued for 3 weeks', () => {
    const samples = [s('recall:D', 'pass', 1, NOW), s('recall:A', 'pass', 1, NOW)];
    // A|D practiced for 25 days, stuck around 22–23.
    [24, 21, 18, 14, 10, 7, 3, 1].forEach((daysAgo, i) => {
      samples.push(s('pair:A|D', 'cpm', 22 + (i % 2), NOW - daysAgo * DAY_MS));
    });
    const ev = evaluateStage(stageDef(1), ctx(samples));
    expect(ev.allMet).toBe(false);
    expect(ev.conditionalAvailable).toBe(true);
    expect(ev.plateauedPairs).toEqual(['A|D']);

    // Improving pair → not plateaued.
    const improving = [s('recall:D', 'pass', 1, NOW), s('recall:A', 'pass', 1, NOW)];
    [24, 21, 18, 14, 10, 7, 3, 1].forEach((daysAgo, i) => {
      improving.push(s('pair:A|D', 'cpm', 15 + i * 2, NOW - daysAgo * DAY_MS));
    });
    expect(evaluateStage(stageDef(1), ctx(improving)).conditionalAvailable).toBe(false);

    // Too recent (< 21 days) → not plateaued.
    const skills = buildSkills([5, 4, 3, 2, 1].map((d) => s('pair:A|D', 'cpm', 20, NOW - d * DAY_MS)));
    expect(isPairPlateaued(skills.get('pair:A|D'), NOW)).toBe(false);

    // A non-pair rule unmet (recall missing) → no conditional promotion.
    const noRecall = samples.filter((x) => x.subjectKey !== 'recall:A');
    expect(evaluateStage(stageDef(1), ctx(noRecall)).conditionalAvailable).toBe(false);
  });

  it('promote(): moves to the next stage, records history and drills; Stage 7 completes Beginner 1', () => {
    const state = { ...initialProgression(NOW - 30 * DAY_MS), stage: 1, sessionsInStage: 6 };
    const next = promote(state, NOW, true, ['A|D']);
    expect(next.stage).toBe(2);
    expect(next.sessionsInStage).toBe(0);
    expect(next.prescribedDrills).toEqual(['A|D']);
    expect(next.history).toEqual([
      { stage: 1, enteredAt: state.stageEnteredAt, leftAt: NOW, conditional: true },
    ]);
    const done = promote({ ...state, stage: 7 }, NOW, false);
    expect(done.stage).toBe(7);
    expect(done.completedBeginner1).toBe(true);
  });

  it('stagnation: no improvement over 14 days → prescription', () => {
    const samples = [
      s('pair:A|D', 'cpm', 25, NOW - 20 * DAY_MS),
      s('pair:A|D', 'cpm', 24, NOW - 5 * DAY_MS),
      s('pair:A|D', 'cpm', 25, NOW - 2 * DAY_MS),
      s('pair:A|E', 'cpm', 20, NOW - 20 * DAY_MS),
      s('pair:A|E', 'cpm', 26, NOW - 2 * DAY_MS),
      s('chord:C', 'clean', 0, NOW - 18 * DAY_MS),
      s('chord:C', 'clean', 0, NOW - DAY_MS),
    ];
    expect(detectStagnation(buildSkills(samples), NOW)).toEqual([
      { subjectKey: 'chord:C', metric: 'clean', prescription: 'pluckMode' },
      { subjectKey: 'pair:A|D', metric: 'cpm', prescription: 'anchorDrill' },
    ]);
  });

  it('switches to the three-finger G once the two-finger G is acquired at Stage 6', () => {
    const state = { ...initialProgression(NOW), stage: 6 };
    const clean = Array.from({ length: 6 }, (_, i) =>
      s('chord:G-2f', 'clean', i < 5 ? 1 : 0, NOW - i * 1000),
    );
    expect(suggestedGVoicing(state, buildSkills(clean))).toBe('G-3f');
    expect(suggestedGVoicing(state, buildSkills(clean.slice(0, 2)))).toBe('G-2f');
  });

  it('graduated items go to the review queue (chords, pairs, patterns, songs)', () => {
    const samples = [
      ...Array.from({ length: 5 }, (_, i) => s('chord:D', 'clean', 1, NOW - i * 1000)),
      s('pair:A|D', 'cpm', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpm', 32, NOW),
      s('strum:P3', 'passBpm', 80, NOW - DAY_MS),
      s('strum:P3', 'passBpm', 80, NOW),
      s('song:s01', 'completed', 1, NOW),
      s('chord:A', 'clean', 0, NOW),
    ];
    expect(graduatedItems(buildSkills(samples), { P3: 80 })).toEqual([
      { subjectKey: 'chord:D', kind: 'chord' },
      { subjectKey: 'pair:A|D', kind: 'pair' },
      { subjectKey: 'song:s01', kind: 'song' },
      { subjectKey: 'strum:P3', kind: 'pattern' },
    ]);
  });
});
