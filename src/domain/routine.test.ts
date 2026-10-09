import { describe, expect, it } from 'vitest';
import { CURRICULUM, stageDef } from '../content/curriculum';
import { PRACTICE_SONGS } from '../content/songs';
import { EMPTY_HISTORY, type PracticeHistory } from './history';
import { pairId, parseDirected } from './pairs';
import { DAY_MS, dayKey, type MetricSample, type ReviewItem, type SkillState } from './records';
import { entryKey, generateRoutine, interleave, nextRepertoireSong, type RoutineInput } from './routine';
import { stageTemplate, templateTotal } from './routineTemplates';
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
    prescriptions: [],
    history: EMPTY_HISTORY,
    sessionsInStage: 4,
    stretchStartFret: 5,
    userTemplate: null,
    seed: 42,
    ...overrides,
  };
}

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

  it('rule 2 (v1.1 §7.3-2): each stage fills its time template — sum = T on days with and without self-checks', () => {
    for (let stage = 0; stage <= 7; stage++) {
      for (const sessionsInStage of [0, 4]) {
        const plan = generateRoutine(input({ stage, sessionsInStage }));
        const template = stageTemplate(stage);
        const k1Day = plan.selfChecks.length > 0;
        expect(plan.totalSec, `stage ${stage} k1=${k1Day}`).toBe(1200);
        expect(templateTotal(template, k1Day)).toBe(1200);
        expect(plan.items[0]!.block).toBe('tuning');
        if (stage >= 1) expect(plan.items.at(-1)!.exerciseType).toBe('S');
        // 30 s rests only between two one-minute changes.
        plan.items.forEach((item, i) => {
          if (item.block !== 'rest') return;
          expect(item.durationSec).toBe(30);
          expect(plan.items[i - 1]?.exerciseType).toBe('E2');
          expect(plan.items[i + 1]?.exerciseType).toBe('E2');
        });
        expect(plan.items.filter((i) => i.exerciseType === 'E2').length).toBe(stage === 0 ? 0 : 2);
        // Q2 is in every routine from Stage 1 (GAP A-7).
        expect(plan.items.some((i) => i.exerciseType === 'Q2')).toBe(stage >= 1);
      }
    }
    // Stage 4–7 warm up with the stretch; Stage 7 has the repertoire block and song memorization.
    expect(generateRoutine(input({ stage: 4 })).items.some((i) => i.exerciseType === 'E7')).toBe(true);
    const seven = generateRoutine(input({ stage: 7 }));
    expect(seven.items.filter((i) => i.block === 'repertoire').map((i) => i.durationSec)).toEqual([300]);
    expect(seven.items.at(-1)).toMatchObject({ block: 'song', durationSec: 300 });
  });

  it('rule 3 (v1.1 §7.3-3): slot 1 = new-chord pair assigned longest ago; slot 2 = at-risk required pair; cap 6', () => {
    // Stage 3 new chords Em, Am: slot 1 picks a pair with one of them.
    const plan = generateRoutine(input({ stage: 3 }));
    const runs = plan.items.filter((i) => i.exerciseType === 'E2');
    expect(/Em|Am/.test(String(runs[0]!.params.direction))).toBe(true);

    // Slot 1 avoids the new-chord pair assigned most recently.
    const appearances = new Map([['E2|pair:A|Em', { session: 9, day: 9 }]]);
    const history: PracticeHistory = { sessionNumber: 10, practiceDay: 10, appearances };
    const slot1 = generateRoutine(input({ stage: 3, history })).items.find((i) => i.exerciseType === 'E2')!;
    expect(slot1.params.pair).not.toBe('A|Em');

    // Slot 2: a required, unpassed pair not assigned for ≥ 5 practice days comes first.
    const risk = new Map<string, { session: number; day: number }>();
    for (const id of ['A|D', 'A|E', 'D|E', 'A|Em', 'Am|E', 'Am|D', 'D|Em', 'Am|Em'])
      risk.set(`E2|pair:${id}`, { session: 9, day: 9 });
    risk.set('E2|pair:D|E', { session: 4, day: 4 });
    const atRisk = generateRoutine(
      input({ stage: 3, history: { sessionNumber: 10, practiceDay: 10, appearances: risk } }),
    );
    expect(atRisk.items.filter((i) => i.exerciseType === 'E2').map((i) => i.params.pair)).toContain('D|E');

    const capped = generateRoutine(input({ changesDoneToday: 5 }));
    expect(capped.items.filter((i) => i.exerciseType === 'E2').length).toBe(1);
    expect(capped.items.some((i) => i.block === 'rest')).toBe(false);
    const none = generateRoutine(input({ changesDoneToday: 6 }));
    expect(none.items.filter((i) => i.exerciseType === 'E2').length).toBe(0);
    expect(none.notices).toContainEqual({ code: 'changesCapReached' });
  });

  it('rule 3 (v1.1): one-pair stage → both slots on that pair in opposite directions; at-risk ties → lower median', () => {
    const one = generateRoutine(input({ stage: 1 }));
    expect(
      one.items
        .filter((i) => i.exerciseType === 'E2')
        .map((i) => i.params.direction)
        .sort(),
    ).toEqual(['A>D', 'D>A']);
    // Two at-risk required pairs, both last assigned 6 practice days ago: the lower recent median first.
    const t = NOW - 6 * DAY_MS;
    const samples: MetricSample[] = [];
    for (let k = 0; k < 3; k++) {
      samples.push(sample('pair:A|E', 'cpmQualified', 12, t + k));
      samples.push(sample('pair:D|E', 'cpmQualified', 25, t + k));
    }
    const appearances = new Map<string, { session: number; day: number }>();
    for (const id of ['A|D', 'A|Em', 'Am|E', 'Am|D', 'D|Em', 'Am|Em'])
      appearances.set(`E2|pair:${id}`, { session: 9, day: 10 });
    appearances.set('E2|pair:A|E', { session: 3, day: 4 });
    appearances.set('E2|pair:D|E', { session: 3, day: 4 });
    const plan = generateRoutine(
      input({
        stage: 3,
        skills: buildSkills(samples),
        history: { sessionNumber: 10, practiceDay: 10, appearances },
      }),
    );
    expect(plan.items.filter((i) => i.exerciseType === 'E2').map((i) => i.params.pair)).toContain('A|E');
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
    const notGap = generateRoutine(input({ stage: 3, lastPracticeAt: NOW - 3 * DAY_MS }));
    expect(notGap.items.some((i) => i.block === 'stageReview')).toBe(false);
  });

  it('rule 6 (v1.1 §7.3-6): due reviews go into blocks of their kind, oldest due first', () => {
    const review = (subjectKey: string, kind: ReviewItem['kind'], dueAgo: number): ReviewItem => ({
      subjectKey,
      kind,
      step: 1,
      due: NOW - dueAgo,
      enqueuedAt: NOW - 5 * DAY_MS,
      lastReviewedAt: null,
      lapses: 0,
    });
    const due = [
      review('chord:D', 'chord', 2000),
      review('chord:A', 'chord', 1000),
      review('pair:A|D', 'pair', 1000),
      review('song:s01', 'song', 1000),
    ];
    const plan = generateRoutine(input({ stage: 3, dueReviews: due }));
    // Chord: the weak/review E1 slot takes the chord due first.
    expect(plan.items.find((i) => i.reviewOf?.startsWith('chord:'))).toMatchObject({
      exerciseType: 'E1',
      reviewOf: 'chord:D',
    });
    // Song (Stage 1–6): played once in perform stage before this stage's song, inside the song block.
    const songs = plan.items.filter((i) => i.block === 'song');
    expect(songs[0]).toMatchObject({ reviewOf: 'song:s01', durationSec: 180, params: { mode: 'perform' } });
    expect(songs.reduce((sum, i) => sum + i.durationSec, 0)).toBe(600);
    expect(plan.totalSec).toBe(1200);
    // Pair: slot 2 when no required pair is at risk.
    const appearances = new Map<string, { session: number; day: number }>();
    for (const id of ['A|D', 'A|E', 'D|E', 'A|Em', 'Am|E', 'Am|D', 'D|Em', 'Am|Em'])
      appearances.set(`E2|pair:${id}`, { session: 9, day: 10 });
    const calm = generateRoutine(
      input({ stage: 3, dueReviews: due, history: { sessionNumber: 10, practiceDay: 10, appearances } }),
    );
    expect(calm.items.some((i) => i.exerciseType === 'E2' && i.reviewOf === 'pair:A|D')).toBe(true);
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

  it('Stage 0 (v1.1): tuning, muted strumming, self-checks (first three sessions), diagram quiz, fret positions', () => {
    const first = generateRoutine(input({ stage: 0, sessionsInStage: 0 }));
    expect(new Set(first.items.map((i) => i.exerciseType))).toEqual(new Set(['E0', 'E5', 'K1', 'Q1', 'E16']));
    expect(first.items.find((i) => i.exerciseType === 'K1')?.params.items).toEqual([
      'posture',
      'pick',
      'countAloud',
    ]);
    expect(first.items.find((i) => i.exerciseType === 'E16')?.durationSec).toBe(180);
    // After the first three sessions only "아직" items return, 3 sessions after they last appeared (§11.12).
    const answered = buildSkills([
      sample('check:posture', 'done', 1, NOW - DAY_MS),
      sample('check:pick', 'done', 1, NOW - DAY_MS),
      sample('check:countAloud', 'done', 0, NOW - DAY_MS),
    ]);
    const seen = (session: number): PracticeHistory => ({
      sessionNumber: 6,
      practiceDay: 6,
      appearances: new Map(
        ['posture', 'pick', 'countAloud'].map((id) => [`K1|check:${id}`, { session, day: session }]),
      ),
    });
    const soon = generateRoutine(input({ stage: 0, sessionsInStage: 4, skills: answered, history: seen(4) }));
    expect(soon.items.some((i) => i.exerciseType === 'K1')).toBe(false);
    expect(soon.items.find((i) => i.exerciseType === 'E16')?.durationSec).toBe(240);
    expect(soon.totalSec).toBe(1200);
    const again = generateRoutine(
      input({ stage: 0, sessionsInStage: 4, skills: answered, history: seen(3) }),
    );
    expect(again.items.find((i) => i.exerciseType === 'K1')?.params.items).toEqual(['countAloud']);
    expect(first.items[0]!.block).toBe('tuning');
  });

  it('rule 10: deterministic for the same input and seed', () => {
    const a = generateRoutine(input({ stage: 5, seed: 7 }));
    const b = generateRoutine(input({ stage: 5, seed: 7 }));
    expect(a).toEqual(b);
  });

  it('a pair prescription takes the technique slot (②) when no rotation entry is due by rule ①', () => {
    const prescriptions = [
      {
        kind: 'omcToPfc' as const,
        subjectKey: 'pair:Am|Em',
        startedSession: 9,
        startedAt: NOW - DAY_MS,
        expiresAfterSessions: 8,
        reason: 'conditionalPromotion' as const,
      },
    ];
    const appearances = new Map([
      ['Q5|quiz:tab', { session: 9, day: 9 }],
      ['E17|riff:R2', { session: 8, day: 8 }],
    ]);
    const plan = generateRoutine(
      input({ stage: 4, prescriptions, history: { sessionNumber: 10, practiceDay: 10, appearances } }),
    );
    expect(plan.items.find((i) => i.block === 'technique')).toMatchObject({
      exerciseType: 'E4',
      params: { pair: 'Am|Em' },
    });
    // An entry due by rule ① comes first; the prescription does not displace it.
    const due = generateRoutine(input({ stage: 4, prescriptions }));
    expect(due.items.find((i) => i.block === 'technique')?.exerciseType).not.toBe('E4');
  });

  it("rule 6 (cards): due note cards share the Q2 block when Q3 is not in today's rotation; else Q3 asks them first", () => {
    const card = (subjectKey: string): ReviewItem => ({
      subjectKey,
      kind: 'card',
      step: 1,
      due: NOW - 1000,
      enqueuedAt: NOW - 5 * DAY_MS,
      lastReviewedAt: NOW - 3 * DAY_MS,
      lapses: 0,
    });
    const dueReviews = [card('card:note:0:0'), card('card:note:5:0')];
    const split = generateRoutine(input({ stage: 4, dueReviews }));
    const recall = split.items.filter((i) => i.block === 'recall');
    expect(recall.map((i) => [i.exerciseType, i.durationSec])).toEqual([
      ['Q2', 30],
      ['Q3', 30],
    ]);
    expect(recall[1]!.params.focus).toEqual(['card:note:0:0', 'card:note:5:0']);
    expect(split.totalSec).toBe(1200);
    // Stage 5 rotates Q3 through its technique list; on a Q3 day the cards go into that run instead.
    const q3Day = generateRoutine(input({ stage: 5, dueReviews }));
    const q3 = q3Day.items.find((i) => i.exerciseType === 'Q3');
    if (q3 && q3.block === 'technique') {
      expect(q3.params.focus).toEqual(['card:note:0:0', 'card:note:5:0']);
      expect(q3Day.items.filter((i) => i.block === 'recall').map((i) => i.exerciseType)).toEqual(['Q2']);
    }
  });

  it('rule 1 (L < T): the song block gives time first (to 300 s), then knowledge and technique; Stage 7+ too', () => {
    const t = (stage: number, minutes: number) =>
      generateRoutine(
        input({ stage, sessionMinutes: minutes, sessionsInStage: 9, firstPracticeAt: NOW - 90 * DAY_MS }),
      );
    const eight = t(8, 20);
    expect(eight.items.find((i) => i.block === 'song')?.durationSec).toBe(300);
    expect(eight.items.some((i) => i.block === 'knowledge')).toBe(false);
    expect(eight.items.find((i) => i.block === 'repertoire')?.durationSec).toBe(300);
    // Song −240, knowledge −60, technique rotation −120 (−60 on a self-check day, whose K1 card stays).
    expect(eight.totalSec).toBe(eight.selfChecks.length > 0 ? 1800 - 240 - 60 - 60 : 1800 - 240 - 60 - 120);
    // Longer sessions add to the repertoire block from Stage 7.
    expect(t(8, 35).items.find((i) => i.block === 'repertoire')?.durationSec).toBe(600);
  });

  it('rule 5 notice only when a previous-stage review item is placed (Stage 7 has no new-chord slot)', () => {
    const seven = generateRoutine(input({ stage: 7, lastPracticeAt: NOW - 5 * DAY_MS }));
    expect(seven.items.some((i) => i.block === 'stageReview')).toBe(false);
    expect(seven.notices.some((n) => n.code === 'gapReview')).toBe(false);
  });
});

describe('SPEC v1.1 §11.16 E11 daily cap', () => {
  const hammerItems = (minutes: number) =>
    generateRoutine(
      input({ stage: 11, sessionMinutes: 30, sessionsInStage: 5, hammerMinutesToday: minutes }),
    ).items.filter((i) => i.exerciseType === 'E11');
  it("E11 carries today's minutes and is left out once ten minutes are reached", () => {
    // Stage 11's technique rotation is E11 alone; whether it plays today depends on the rotation, so look at
    // every session of the cycle.
    const plans = [0, 1, 2].map((n) =>
      generateRoutine(
        input({
          stage: 11,
          sessionMinutes: 30,
          sessionsInStage: 5 + n,
          hammerMinutesToday: 4,
          history: { ...input().history, sessionNumber: 20 + n },
        }),
      ).items.filter((i) => i.exerciseType === 'E11'),
    );
    const any = plans.flat();
    expect(any.length).toBeGreaterThan(0);
    for (const item of any) expect(item.params.minutesToday).toBe(4);
    expect(hammerItems(10)).toEqual([]);
  });
});

describe('SPEC v1.1 §7.4 PFC ↔ OMC prescriptions at Stage 8', () => {
  const prescription = (kind: 'omcToPfc' | 'pfcToOmc', pair: string) => ({
    kind,
    subjectKey: `pair:${pair}`,
    startedSession: 9,
    startedAt: NOW - DAY_MS,
    expiresAfterSessions: 8,
    reason: 'stagnation' as const,
  });
  /** Canonical pairs of the plan's items of one exercise type (E2/E3 carry a direction 'A>B'). */
  const pairsIn = (plan: ReturnType<typeof generateRoutine>, type: string) =>
    plan.items
      .filter((i) => i.exerciseType === type)
      .map((i) => pairId(...parseDirected(String(i.params.direction))));

  it('OMC → PFC puts the pair in the E3 slot; PFC → OMC takes it out of E3 and back to a one-minute change', () => {
    const base = { stage: 8, gVoicing: 'G-4f', sessionMinutes: 30 } as const;
    const plain = generateRoutine(input(base));
    const [natural] = pairsIn(plain, 'E3');
    expect(natural).toBeDefined();
    expect(pairsIn(plain, 'E2')).not.toContain(natural);

    const other = stageDef(8).stagePairs.find((id) => id !== natural && !pairsIn(plain, 'E2').includes(id))!;
    const toPfc = generateRoutine(input({ ...base, prescriptions: [prescription('omcToPfc', other)] }));
    expect(pairsIn(toPfc, 'E3')).toEqual([other]);

    const toOmc = generateRoutine(input({ ...base, prescriptions: [prescription('pfcToOmc', natural!)] }));
    expect(pairsIn(toOmc, 'E3')).not.toContain(natural);
    expect(pairsIn(toOmc, 'E2')).toContain(natural);
  });
});

describe('SPEC v1.1 §7.5 scale and riff review drafts', () => {
  const due = (subjectKey: string, kind: 'scale' | 'riff'): ReviewItem => ({
    subjectKey,
    kind,
    step: 1,
    due: NOW - 1000,
    enqueuedAt: NOW - 9 * DAY_MS,
    lastReviewedAt: NOW - 3 * DAY_MS,
    lapses: 0,
  });

  const ladderAt = (subjectKey: string, bpm: number): SkillState => ({
    subjectKey,
    lastPracticedAt: NOW - DAY_MS,
    metrics: {
      ladderBpm: {
        count: 1,
        last: bpm,
        best: bpm,
        lastAt: NOW - DAY_MS,
        firstAt: NOW - DAY_MS,
        recent: [bpm],
        dayBest: {},
      },
    },
  });

  it('a scale review plays the reviewed step; a riff review plays at its ladder tempo', () => {
    // Every rotation entry appeared last session, so rule ③ (a due review of the block's kind) applies.
    const recent = Object.values(stageDef(9).rotation)
      .flat()
      .map((e) => [entryKey(e), { session: 10, day: 10 }] as const);
    const plan = generateRoutine(
      input({
        stage: 9,
        gVoicing: 'G-4f',
        sessionMinutes: 30,
        history: { sessionNumber: 11, practiceDay: 11, appearances: new Map(recent) },
        dueReviews: [due('scale:em-pent-open:s2', 'scale'), due('riff:R2', 'riff')],
        skills: new Map([['riff:R2', ladderAt('riff:R2', 85)]]),
      }),
    );
    expect(plan.items.find((i) => i.reviewOf === 'scale:em-pent-open:s2')?.params).toMatchObject({
      scaleId: 'em-pent-open',
      step: 2,
      review: true,
    });
    // Rule 10: the riff's current ladder tempo (above its goal tempo 80 once graduated).
    expect(plan.items.find((i) => i.reviewOf === 'riff:R2')?.params).toMatchObject({ riffId: 'R2', bpm: 85 });
  });
});

describe('SPEC v1.1 §11.10 repertoire block: "차례로 친다"', () => {
  const repertoireSkill = (id: string, extra: Record<string, number> = {}): [string, SkillState] => [
    `song:${id}`,
    {
      subjectKey: `song:${id}`,
      lastPracticedAt: NOW - DAY_MS,
      metrics: Object.fromEntries(
        Object.entries({ repertoire: 1, ...extra }).map(([name, v]) => [
          name,
          { count: 1, last: v, best: v, lastAt: NOW, firstAt: NOW, recent: [v], dayBest: {} },
        ]),
      ),
    },
  ];

  it('the next repertoire song in id order, wrapping; hidden once memorized; none to move to → null', () => {
    const skills = new Map([
      repertoireSkill('s01'),
      repertoireSkill('s03', { hiddenMemorized: 1 }),
      repertoireSkill('s05'),
    ]);
    const input = { songs: PRACTICE_SONGS, stage: 8, skills };
    expect(nextRepertoireSong(input, 's01')).toMatchObject({
      songId: 's03',
      mode: 'perform',
      chartHidden: true,
    });
    expect(nextRepertoireSong(input, 's03')).toMatchObject({ songId: 's05', chartHidden: false });
    expect(nextRepertoireSong(input, 's05')).toMatchObject({ songId: 's01' });
    expect(nextRepertoireSong({ ...input, skills: new Map([repertoireSkill('s01')]) }, 's01')).toBeNull();
  });
});
