import { describe, expect, it } from 'vitest';
import { CURRICULUM, stageDef } from '../content/curriculum';
import { PRACTICE_SONGS } from '../content/songs';
import {
  detectStagnation,
  evaluateRule,
  evaluateStage,
  graduatedItems,
  isPairPlateaued,
  pfcGraduated,
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
    songs: PRACTICE_SONGS,
    skills: buildSkills(samples),
    sessionsInStage: 4,
    stageEnteredAt: NOW - 30 * DAY_MS,
    examPassed: false,
    now: NOW,
    recentSamples: samples,
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

  it('Stage 1: recall D and A on two days + pair A|D ≥ 30 qualified changes on two different days (v1.1 §7.1)', () => {
    const def = stageDef(1);
    // §7.1 "Q2: X 3초 안 정답" = passed on two different days.
    const recallDays = [
      s('recall:D', 'pass', 1, NOW - DAY_MS),
      s('recall:A', 'pass', 1, NOW - DAY_MS),
      s('recall:D', 'pass', 1, NOW),
      s('recall:A', 'pass', 1, NOW),
    ];
    const oneDay = [
      ...recallDays,
      s('pair:A|D', 'cpmQualified', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpmQualified', 33, NOW - DAY_MS + 1000),
    ];
    const ev = evaluateStage(def, ctx(oneDay));
    expect(ev.allMet).toBe(false);
    expect(ev.rules.find((r) => r.rule.kind === 'unlockedPairsAtLeast')?.missing).toEqual(['A|D']);
    const twoDays = [...oneDay, s('pair:A|D', 'cpmQualified', 30, NOW)];
    expect(evaluateStage(def, ctx(twoDays)).allMet).toBe(true);
    // Runs shorter than 55 s (pain-reduced 30 s runs) record `cpm` only and never count (§7.1, D-045 fix).
    const shortRuns = [...recallDays, s('pair:A|D', 'cpm', 40, NOW - DAY_MS), s('pair:A|D', 'cpm', 40, NOW)];
    expect(evaluateStage(def, ctx(shortRuns)).allMet).toBe(false);
    // Recall passed on one day only → A still missing.
    const oneRecallDay = [
      s('recall:D', 'pass', 1, NOW - DAY_MS),
      s('recall:D', 'pass', 1, NOW),
      s('recall:A', 'pass', 1, NOW),
      s('pair:A|D', 'cpmQualified', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpmQualified', 31, NOW),
    ];
    expect(
      evaluateStage(def, ctx(oneRecallDay)).rules.find((r) => r.rule.kind === 'recallPassed')?.missing,
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

  it('conditional promotion (v1.1 §7.4): non-pair rules met and every missing pair plateaued for 3 weeks', () => {
    const recallDays = [
      s('recall:D', 'pass', 1, NOW - DAY_MS),
      s('recall:A', 'pass', 1, NOW - DAY_MS),
      s('recall:D', 'pass', 1, NOW),
      s('recall:A', 'pass', 1, NOW),
    ];
    // A|D: 7 qualified runs over the last 20 days stuck around 22–23 (first run ≥ 14 days ago, median gain < 2).
    const stuck = [...recallDays];
    [20, 17, 14, 10, 7, 3, 1].forEach((daysAgo, i) => {
      stuck.push(s('pair:A|D', 'cpmQualified', 22 + (i % 2), NOW - daysAgo * DAY_MS));
    });
    const ev = evaluateStage(stageDef(1), ctx(stuck));
    expect(ev.allMet).toBe(false);
    expect(ev.conditionalAvailable).toBe(true);
    expect(ev.plateauedPairs).toEqual(['A|D']);
    expect(isPairPlateaued(stuck, 'A|D', NOW)).toBe(true);

    // Improving (+2 or more between the first and last three medians) → not plateaued.
    const improving = [...recallDays];
    [20, 17, 14, 10, 7, 3, 1].forEach((daysAgo, i) => {
      improving.push(s('pair:A|D', 'cpmQualified', 15 + i * 2, NOW - daysAgo * DAY_MS));
    });
    expect(evaluateStage(stageDef(1), ctx(improving)).conditionalAvailable).toBe(false);

    // Fewer than 6 runs, or the first run in the window less than 14 days ago → not plateaued.
    const few = [5, 4, 3, 2, 1].map((d) => s('pair:A|D', 'cpmQualified', 20, NOW - d * DAY_MS));
    expect(isPairPlateaued(few, 'A|D', NOW)).toBe(false);
    const recent = [12, 10, 8, 6, 4, 2, 1].map((d) => s('pair:A|D', 'cpmQualified', 20, NOW - d * DAY_MS));
    expect(isPairPlateaued(recent, 'A|D', NOW)).toBe(false);
    // Runs older than 21 days do not count toward the window.
    const old = [30, 28, 26, 25, 24, 23, 15].map((d) => s('pair:A|D', 'cpmQualified', 20, NOW - d * DAY_MS));
    expect(isPairPlateaued(old, 'A|D', NOW)).toBe(false);

    // A non-pair rule unmet (recall A missing) → no conditional promotion.
    const noRecall = stuck.filter((x) => x.subjectKey !== 'recall:A');
    expect(evaluateStage(stageDef(1), ctx(noRecall)).conditionalAvailable).toBe(false);

    // pairsPassedAtLeast (Stage 11: 6 of 8): only the shortfall needs to be plateaued.
    const stage11 = stageDef(11);
    const pairsRule = stage11.unlockRules.find((r) => r.kind === 'pairsPassedAtLeast')!;
    if (pairsRule.kind !== 'pairsPassedAtLeast') throw new Error('rule');
    const samples: MetricSample[] = [];
    for (const id of pairsRule.pairs.slice(0, 5)) {
      const [a, b] = id.split('|') as [string, string];
      samples.push(s(`pair:${a < b ? `${a}|${b}` : `${b}|${a}`}`, 'cpmQualified', 31, NOW - 2 * DAY_MS));
      samples.push(s(`pair:${a < b ? `${a}|${b}` : `${b}|${a}`}`, 'cpmQualified', 31, NOW - DAY_MS));
    }
    const sixth = pairsRule.pairs[5]!;
    for (const d of [20, 17, 14, 10, 7, 3, 1])
      samples.push(s(`pair:${sixth}`, 'cpmQualified', 25, NOW - d * DAY_MS));
    const pairsOnly = evaluateRule(pairsRule, ctx(samples, { stage: 11 }));
    expect(pairsOnly.met).toBe(false);
    expect(pairsOnly.missing).toContain(sixth);
  });

  it('promote(): next stage, history, conditional pair prescriptions (v1.1 §7.4); Stage 7 → 8 completes Beginner 1, Stage 11 Beginner 2', () => {
    const state = { ...initialProgression(NOW - 30 * DAY_MS), stage: 1, sessionsInStage: 6 };
    const next = promote(state, NOW, true, ['A|D'], 12);
    expect(next.stage).toBe(2);
    expect(next.sessionsInStage).toBe(0);
    expect(next.prescriptions).toEqual([
      {
        kind: 'omcToPfc',
        subjectKey: 'pair:A|D',
        startedSession: 12,
        startedAt: NOW,
        expiresAfterSessions: 8,
        reason: 'conditionalPromotion',
      },
    ]);
    expect(next.history).toEqual([
      { stage: 1, enteredAt: state.stageEnteredAt, leftAt: NOW, conditional: true },
    ]);
    expect(promote(state, NOW, false).prescriptions).toEqual([]);
    // v1.1 §7.2: passing Stage 7 completes Beginner 1 and moves on to Stage 8.
    const beginner1 = promote({ ...state, stage: 7 }, NOW, false);
    expect(beginner1).toMatchObject({ stage: 8, completedBeginner1: true, completedBeginner2: false });
    // §7.7: Stage 11's rules met = Beginner 2 complete (dated); the routine stays at Stage 11.
    const beginner2 = promote({ ...beginner1, stage: 11 }, NOW + DAY_MS, false);
    expect(beginner2).toMatchObject({
      stage: 11,
      completedBeginner2: true,
      beginner2CompletedAt: NOW + DAY_MS,
    });
    expect(promote(beginner2, NOW + 2 * DAY_MS, false)).toBe(beginner2);
  });

  it('stagnation (v1.1 §7.4): 14-day window, ≥ 4 runs, first ≥ 9 days old, below the per-kind gain', () => {
    const run = (key: string, metric: string, value: number, daysAgo: number, id = '') => ({
      ...s(key, metric, value, NOW - daysAgo * DAY_MS),
      attemptId: id || `a-${key}-${daysAgo}-${value}`,
    });
    const samples = [
      // Pair stuck: medians 24 → 25 (+1 < 2).
      ...[12, 9, 6, 3, 1].map((d, i) => run('pair:A|D', 'cpmQualified', 24 + (i % 2), d)),
      // Pair improving: 20 → 28.
      ...[12, 9, 6, 3, 1].map((d, i) => run('pair:A|E', 'cpmQualified', 20 + 2 * i, d)),
      // Pair stuck but only 3 runs → not judged.
      ...[12, 6, 1].map((d) => run('pair:D|E', 'cpmQualified', 22, d)),
      // Chord: 4 runs, clean ratio stays 0.
      ...[13, 9, 5, 1].map((d) => run('chord:C', 'clean', 0, d)),
      // Ladder: 60 → 60 BPM over 10 days.
      ...[10, 7, 4, 1].map((d) => run('strum:P3:mute', 'ladderBpm', 60, d)),
      // Ladder rising +10 → fine.
      ...[10, 7, 4, 1].map((d, i) => run('strum:P1:single', 'ladderBpm', 60 + 5 * i, d)),
      // Ladder at its goal (P2 mute graduates at 70) → not judged.
      ...[10, 7, 4, 1].map((d) => run('strum:P2:mute', 'ladderBpm', 70, d)),
      // First run only 5 days ago → too recent.
      ...[5, 4, 2, 1].map((d) => run('altpick:3', 'ladderBpm', 60, d)),
    ];
    const skills = buildSkills(samples);
    const targets = { done: (key: string, bpm: number) => key === 'strum:P2:mute' && bpm >= 70 };
    expect(detectStagnation(skills, samples, NOW, targets)).toEqual([
      { subjectKey: 'chord:C', prescription: 'pluckMode' },
      { subjectKey: 'pair:A|D', prescription: 'omcToPfc' },
      { subjectKey: 'strum:P3:mute', prescription: 'slowerTempo' },
    ]);
    // A passed pair is not watched.
    const passed = [
      ...samples,
      s('pair:A|D', 'cpmQualified', 31, NOW - 20 * DAY_MS),
      s('pair:A|D', 'cpmQualified', 31, NOW - 19 * DAY_MS),
    ];
    expect(
      detectStagnation(buildSkills(passed), passed, NOW, targets).map((x) => x.subjectKey),
    ).not.toContain('pair:A|D');
  });

  it('switches to the three-finger G once the two-finger G is acquired at Stage 6', () => {
    const state = { ...initialProgression(NOW), stage: 6 };
    const clean = Array.from({ length: 6 }, (_, i) =>
      s('chord:G-2f', 'clean', i < 5 ? 1 : 0, NOW - i * 1000),
    );
    expect(suggestedGVoicing(state, buildSkills(clean))).toBe('G-3f');
    expect(suggestedGVoicing(state, buildSkills(clean.slice(0, 2)))).toBe('G-2f');
  });

  it('graduated items go to the review queue (v1.1 §7.1, §7.5): chords, pairs, patterns, repertoire songs', () => {
    const samples = [
      ...Array.from({ length: 5 }, (_, i) => s('chord:D', 'clean', 1, NOW - i * 1000)),
      s('pair:A|D', 'cpmQualified', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpmQualified', 32, NOW),
      // Pattern P3: its progression mode passed at 80 on two consecutive practice days (§6.10).
      s('strum:P3:progression', 'hitRate', 0.95, NOW - 3 * DAY_MS),
      s('strum:P3:progression', 'passBpm', 80, NOW - 3 * DAY_MS),
      s('strum:P3:progression', 'hitRate', 0.95, NOW - DAY_MS),
      s('strum:P3:progression', 'passBpm', 80, NOW - DAY_MS),
      // Pattern P1: two passes but a failed practice day between them → not graduated.
      s('strum:P1:progression', 'hitRate', 0.95, NOW - 3 * DAY_MS),
      s('strum:P1:progression', 'passBpm', 70, NOW - 3 * DAY_MS),
      s('strum:P1:progression', 'hitRate', 0.5, NOW - 2 * DAY_MS),
      s('strum:P1:progression', 'hitRate', 0.95, NOW - DAY_MS),
      s('strum:P1:progression', 'passBpm', 70, NOW - DAY_MS),
      // Song s01: performed through without a stop → repertoire; s02 completed with stops → not yet.
      s('song:s01', 'repertoire', 1, NOW),
      s('song:s02', 'performCompleted', 1, NOW),
      s('chord:A', 'clean', 0, NOW),
    ];
    expect(graduatedItems(buildSkills(samples))).toEqual([
      { subjectKey: 'chord:D', kind: 'chord' },
      { subjectKey: 'pair:A|D', kind: 'pair' },
      { subjectKey: 'song:s01', kind: 'song' },
      { subjectKey: 'strum:P3', kind: 'pattern' },
    ]);
  });

  it('SPEC v1.1 §7.5: graduated scale steps (4 flawless at ≥ 80) and riffs (goal tempo) join the review queue', () => {
    const samples = [
      s('scale:em-pent-open:s1', 'streakBpm', 80, NOW),
      s('scale:em-pent-open:s2', 'streakBpm', 75, NOW),
      s('riff:R1', 'passBpm', 80, NOW), // R1 60 BPM + 20
      s('riff:R2', 'passBpm', 70, NOW),
    ];
    expect(graduatedItems(buildSkills(samples))).toEqual([
      { subjectKey: 'riff:R1', kind: 'riff' },
      { subjectKey: 'scale:em-pent-open:s1', kind: 'scale' },
    ]);
  });

  it('SPEC v1.1 §11.11: an E3 pair graduates after passes on two different days', () => {
    const once = buildSkills([s('pfc:A|D', 'pass', 1, NOW), s('pfc:A|D', 'pass', 1, NOW + 1000)]);
    expect(pfcGraduated(once, 'A|D')).toBe(false);
    const twice = buildSkills([s('pfc:A|D', 'pass', 1, NOW - DAY_MS), s('pfc:A|D', 'pass', 1, NOW)]);
    expect(pfcGraduated(twice, 'A|D')).toBe(true);
  });
});
