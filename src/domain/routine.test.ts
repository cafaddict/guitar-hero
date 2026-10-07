import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../content/curriculum';
import { PRACTICE_SONGS } from '../content/songs';
import { DAY_MS, dayKey, type MetricSample, type ReviewItem } from './records';
import { generateRoutine, interleave, type RoutineInput } from './routine';
import { buildSkills } from './skills';

const NOW = new Date(2026, 9, 7, 19, 0, 0).getTime();

function sample(subjectKey: string, metric: string, value: number, at: number): MetricSample {
  return { subjectKey, metric, value, at, day: dayKey(at), attemptId: `a-${subjectKey}-${at}` };
}

function input(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    stage: 3,
    curriculum: CURRICULUM,
    songs: PRACTICE_SONGS,
    gVoicing: 'G-2f',
    skills: new Map(),
    now: NOW,
    lastPracticeAt: NOW - DAY_MS,
    firstPracticeAt: NOW - 10 * DAY_MS,
    lastSelfReport: null,
    sessionMinutes: 20,
    confirmedOverCap: false,
    dueReviews: [],
    changesDoneToday: 0,
    prescribedDrills: [],
    seed: 42,
    ...overrides,
  };
}

const ORDER = [
  'tuning',
  'warmup',
  'stageReview',
  'chord',
  'changes',
  'rest',
  'rhythm',
  'review',
  'technique',
  'song',
];

describe('AC-R1 routine generation (SPEC §7.3)', () => {
  it('rule 1: default 20-minute session; first 4 weeks capped at 20 unless confirmed', () => {
    const plan = generateRoutine(input());
    expect(plan.sessionMinutes).toBe(20);
    expect(plan.totalSec).toBeLessThanOrEqual(20 * 60);
    expect(plan.totalSec).toBeGreaterThanOrEqual(17 * 60);

    const early = generateRoutine(input({ sessionMinutes: 30 }));
    expect(early.sessionMinutes).toBe(20);
    expect(early.needsCapConfirmation).toBe(true);
    expect(early.notices).toContainEqual({ code: 'capApplied', minutes: 20 });

    const confirmed = generateRoutine(input({ sessionMinutes: 30, confirmedOverCap: true }));
    expect(confirmed.sessionMinutes).toBe(30);
    expect(confirmed.needsCapConfirmation).toBe(false);

    const later = generateRoutine(input({ sessionMinutes: 30, firstPracticeAt: NOW - 40 * DAY_MS }));
    expect(later.sessionMinutes).toBe(30);
    expect(later.needsCapConfirmation).toBe(false);
  });

  it('rule 2: block order tuning → warm-up → chord → changes → rhythm → technique → song (last, 9–10 min)', () => {
    for (let stage = 1; stage <= 7; stage++) {
      const plan = generateRoutine(input({ stage }));
      const blocks = plan.items.map((i) => i.block).filter((b) => b !== 'rest');
      expect(blocks[0]).toBe('tuning');
      expect(blocks[1]).toBe('warmup');
      const ranks = blocks.map((b) => ORDER.indexOf(b));
      // chord before changes before rhythm; song last.
      expect(blocks.indexOf('chord')).toBeLessThan(blocks.indexOf('changes'));
      expect(blocks.indexOf('changes')).toBeLessThan(blocks.indexOf('rhythm'));
      expect(blocks.at(-1)).toBe('song');
      const song = plan.items.at(-1)!;
      expect(song.exerciseType).toBe('S');
      expect(song.durationSec).toBeGreaterThanOrEqual(540);
      expect(song.durationSec).toBeLessThanOrEqual(600);
      expect(ranks.every((r) => r >= 0)).toBe(true);
      const warmup = plan.items[1]!;
      expect(warmup.exerciseType).toBe(stage >= 4 ? 'E7' : 'E5');
      // Rests of 30 s separate consecutive one-minute changes.
      plan.items.forEach((item, i) => {
        if (item.exerciseType === 'E2' && plan.items[i + 1]?.exerciseType === 'E2')
          throw new Error('changes without rest');
        if (item.block === 'rest') expect(item.durationSec).toBe(30);
      });
      const changeRuns = plan.items.filter((i) => i.exerciseType === 'E2').length;
      expect(changeRuns).toBeGreaterThanOrEqual(2);
      expect(changeRuns).toBeLessThanOrEqual(3);
    }
  });

  it('rule 3: pairs with the new chord first, then lowest recent median, then oldest; daily cap 6 runs', () => {
    // Stage 3 new chords: Em, Am.
    const plan = generateRoutine(input({ stage: 3 }));
    const pairs = plan.items.filter((i) => i.exerciseType === 'E2').map((i) => String(i.params.direction));
    for (const dir of pairs) expect(/Em|Am/.test(dir), dir).toBe(true);

    // Stage 7 (no new chord): the pair with the lowest median goes first.
    const t = NOW - 2 * DAY_MS;
    const samples: MetricSample[] = [];
    for (const dir of ['A>D', 'D>A', 'C>G', 'G>C', 'Am>Em'])
      for (let k = 0; k < 3; k++) samples.push(sample(`pairdir:${dir}`, 'cpm', 40, t + k));
    for (let k = 0; k < 3; k++) samples.push(sample('pairdir:E>Dm', 'cpm', 12, t + k));
    const skills = buildSkills(samples);
    const ranked = generateRoutine(input({ stage: 7, skills }))
      .items.filter((i) => i.exerciseType === 'E2')
      .map((i) => String(i.params.direction));
    // Never-practiced pairs (median unknown) rank lowest of all; E>Dm (12) must beat practiced 40s.
    expect(ranked).not.toContain('A>D');

    const capped = generateRoutine(input({ changesDoneToday: 5 }));
    expect(capped.items.filter((i) => i.exerciseType === 'E2').length).toBe(1);
    const none = generateRoutine(input({ changesDoneToday: 6 }));
    expect(none.items.filter((i) => i.exerciseType === 'E2').length).toBe(0);
    expect(none.notices).toContainEqual({ code: 'changesCapReached' });
  });

  it('rule 3 ordering: lowest median before higher, older before newer on ties', () => {
    const t = NOW - 5 * DAY_MS;
    const all: MetricSample[] = [];
    // Practice every Stage 3 directed candidate at 50 except two.
    const dirs = [
      'A>D',
      'D>A',
      'A>E',
      'E>A',
      'D>E',
      'E>D',
      'A>Em',
      'Em>A',
      'D>Em',
      'Em>D',
      'E>Am',
      'Am>E',
      'D>Am',
      'Am>D',
      'Am>Em',
      'Em>Am',
    ];
    for (const dir of dirs) all.push(sample(`pairdir:${dir}`, 'cpm', 50, t));
    all.push(sample('pairdir:Am>E', 'cpm', 10, t + 1), sample('pairdir:Am>E', 'cpm', 10, t + 2));
    all.push(sample('pairdir:Em>D', 'cpm', 20, t + 1), sample('pairdir:Em>D', 'cpm', 20, t + 2));
    const plan = generateRoutine(input({ stage: 3, skills: buildSkills(all) }));
    const pairs = plan.items
      .filter((i) => i.block === 'changes' && i.exerciseType === 'E2')
      .map((i) => String(i.params.direction));
    expect(pairs.slice(0, 2)).toEqual(['Am>E', 'Em>D']);
  });

  it('rule 4: no two consecutive items with the same exercise and subject', () => {
    for (let stage = 0; stage <= 7; stage++) {
      for (const seed of [1, 2, 3, 99]) {
        const plan = generateRoutine(input({ stage, seed }));
        for (let i = 1; i < plan.items.length; i++) {
          const a = plan.items[i - 1]!;
          const b = plan.items[i]!;
          expect(
            a.exerciseType === b.exerciseType && a.subjectKey === b.subjectKey,
            `stage ${stage} items ${i - 1},${i}`,
          ).toBe(false);
        }
      }
    }
    const fixed = interleave([
      { id: '1', exerciseType: 'E0', params: {}, durationSec: 60, block: 'tuning', subjectKey: 't' },
      { id: '2', exerciseType: 'E1', params: {}, durationSec: 60, block: 'chord', subjectKey: 'chord:C' },
      { id: '3', exerciseType: 'E1', params: {}, durationSec: 60, block: 'chord', subjectKey: 'chord:C' },
      { id: '4', exerciseType: 'E5', params: {}, durationSec: 60, block: 'rhythm', subjectKey: 'strum:P0' },
      { id: '5', exerciseType: 'S', params: {}, durationSec: 60, block: 'song', subjectKey: 'song:s01' },
    ]);
    expect(fixed.map((i) => i.id)).toEqual(['1', '2', '4', '3', '5']);
  });

  it('rule 5: more than 3 days off → first block reviews the previous stage', () => {
    const plan = generateRoutine(input({ stage: 3, lastPracticeAt: NOW - 4 * DAY_MS }));
    expect(plan.notices).toContainEqual({ code: 'gapReview', days: 4 });
    const firstContent = plan.items.find((i) => i.block !== 'tuning' && i.block !== 'warmup')!;
    expect(firstContent.block).toBe('stageReview');
    expect(firstContent.params.voicingId).toBe('E');
    expect(plan.items.some((i) => i.block === 'chord')).toBe(false);
    const notGap = generateRoutine(input({ stage: 3, lastPracticeAt: NOW - 3 * DAY_MS }));
    expect(notGap.items.some((i) => i.block === 'stageReview')).toBe(false);
  });

  it('rule 6: due reviews fill a review slot of at most 3 minutes', () => {
    const due: ReviewItem[] = ['chord:D', 'chord:A', 'pair:A|D', 'chord:E'].map((subjectKey) => ({
      subjectKey,
      kind: subjectKey.startsWith('pair') ? 'pair' : 'chord',
      step: 1,
      due: NOW - 1000,
      enqueuedAt: NOW - 5 * DAY_MS,
      lastReviewedAt: null,
      lapses: 0,
    }));
    const plan = generateRoutine(input({ stage: 3, dueReviews: due }));
    const reviews = plan.items.filter((i) => i.block === 'review');
    expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.reduce((s, i) => s + i.durationSec, 0)).toBeLessThanOrEqual(180);
    expect(reviews[0]!.subjectKey).toBe('chord:D');
  });

  it('rule 7: pain ≥ 5 halves E1/E2 time; danger symptoms → rest day', () => {
    const base = generateRoutine(input());
    const reduced = generateRoutine(
      input({ lastSelfReport: { pain: 6, dangerFlags: [], difficulty: 3, note: '' } }),
    );
    expect(reduced.notices).toContainEqual({ code: 'painReduced' });
    const time = (plan: typeof base, type: string) =>
      plan.items.filter((i) => i.exerciseType === type).reduce((s, i) => s + i.durationSec, 0);
    expect(time(reduced, 'E1')).toBeLessThanOrEqual(time(base, 'E1') / 2 + 15);
    expect(time(reduced, 'E2')).toBeLessThanOrEqual(time(base, 'E2') / 2 + 15);
    expect(time(reduced, 'E1')).toBeGreaterThan(0);

    const rest = generateRoutine(
      input({ lastSelfReport: { pain: 2, dangerFlags: ['numbness'], difficulty: 3, note: '' } }),
    );
    expect(rest.kind).toBe('rest');
    expect(rest.items).toEqual([]);
    expect(rest.notices).toEqual([{ code: 'restDay' }]);
  });

  it('rule 8: the plan never exceeds the session budget (break reminders handled by safety.breakReminderDue)', () => {
    for (let stage = 0; stage <= 7; stage++)
      expect(generateRoutine(input({ stage })).totalSec).toBeLessThanOrEqual(1200);
  });

  it('Stage 0 has no chords: tuning, diagram quiz and muted strumming only', () => {
    const plan = generateRoutine(input({ stage: 0 }));
    expect(new Set(plan.items.map((i) => i.exerciseType))).toEqual(new Set(['E0', 'E5', 'Q1']));
    expect(plan.items[0]!.block).toBe('tuning');
  });

  it('rule 10: deterministic for the same input and seed', () => {
    const a = generateRoutine(input({ stage: 5, seed: 7 }));
    const b = generateRoutine(input({ stage: 5, seed: 7 }));
    expect(a).toEqual(b);
  });

  it('conditional-promotion drills are prescribed as the technique block', () => {
    const plan = generateRoutine(input({ stage: 4, prescribedDrills: ['A|D'] }));
    const technique = plan.items.find((i) => i.block === 'technique');
    expect(technique).toMatchObject({ exerciseType: 'E4', params: { pair: 'A|D' } });
  });
});
