/**
 * SPEC v1.1 §14.9 curriculum simulation, Stage 0–7 (M9 scope: AC-RT2 slots/rotation/prescriptions, AC-RT5
 * parameters, AC-PG2/PG3 wiring). The real plugin registry and `pluginParamsFor` are injected; only exercise
 * results come from the learner models.
 */
import { describe, expect, it } from 'vitest';
import { CURRICULUM, stageDef } from '../content/curriculum';
import { riffById } from '../content/riffs';
import type { RoutineItem, UnlockRule } from '../content/schemas';
import { PRACTICE_SONGS } from '../content/songs';
import { simulationDeps } from '../exercises/testing/simDeps';
import { unlockedPairIds } from './progression';
import { dayKey, type ReviewKind } from './records';
import { entryKey } from './routine';
import { rowSeconds, stageTemplate, type TemplateSlot } from './routineTemplates';
import { FINGERTIP_LOAD_TYPES } from './safety';
import { blankLearner, improvingLearner } from './simLearners';
import { type LearnerModel, type SimResult, type SimSession, simulate } from './simulate';
import { applySample } from './skills';

const deps = simulationDeps();
const base = { deps, curriculum: CURRICULUM, songs: PRACTICE_SONGS };
const reach = simulate({
  ...base,
  learner: improvingLearner(),
  days: 200,
  stopWhen: (s) => s.progression.completedBeginner1,
});
const COVERAGE_DAYS = 28;

function coverage(stage: number, learner: LearnerModel): SimResult {
  const start = reach.stageEntries.get(stage);
  if (!start) throw new Error(`the improving learner never entered stage ${stage}`);
  return simulate({ ...base, learner, days: COVERAGE_DAYS, fixedStage: stage, start });
}

const keysOf = (session: SimSession) => new Set(session.plan.items.map((i) => i.key));

/** §14.9-4: every rotation entry appears at least once in every 3 consecutive sessions. */
function rotationGaps(run: SimResult, stage: number): string[] {
  const def = stageDef(stage);
  const entries = [
    ...def.rotation.rhythm,
    ...def.rotation.scales,
    ...def.rotation.technique,
    ...def.rotation.knowledge,
  ];
  const gaps: string[] = [];
  for (const entry of entries) {
    const key = entryKey(entry);
    for (let i = 0; i + 3 <= run.sessions.length; i++) {
      if (!run.sessions.slice(i, i + 3).some((s) => keysOf(s).has(key)))
        gaps.push(`${key} @ session ${i + 1}`);
    }
  }
  return gaps;
}

/** §7.3-3: a required, unpassed pair is assigned within 7 practice days (or gets passed meanwhile). */
function pairGuaranteeMisses(run: SimResult): string[] {
  const misses: string[] = [];
  const sessions = run.sessions;
  for (let i = 0; i + 7 <= sessions.length; i++) {
    for (const pair of sessions[i]!.requiredPairs) {
      const window = sessions.slice(i, i + 7);
      const assigned = window.some((s) =>
        s.plan.items.some(
          (item) => (item.exerciseType === 'E2' || item.exerciseType === 'E3') && item.params.pair === pair,
        ),
      );
      const passed = window.some((s) => !s.requiredPairs.includes(pair));
      if (!assigned && !passed) misses.push(`${pair} from day ${sessions[i]!.day}`);
    }
  }
  return misses;
}

function templateSeconds(item: RoutineItem, stage: number, k1Day: boolean): number | undefined {
  if (!item.slot) return undefined;
  const row = stageTemplate(stage).rows.find((r) => JSON.stringify(r.slot) === item.slot);
  return row ? rowSeconds(row, k1Day) : undefined;
}

/** §14.9-4 "합계": Σ block time = T, or T minus the pain reductions on pain-reduced days. */
function sumErrors(run: SimResult): string[] {
  const errors: string[] = [];
  for (const s of run.sessions) {
    if (s.plan.kind !== 'practice') continue;
    const k1Day = s.plan.selfChecks.length > 0;
    let expected = s.plan.templateSec;
    if (s.plan.painAdvice === 'reduceFingertipLoad') {
      for (const item of s.plan.items) {
        if (!FINGERTIP_LOAD_TYPES.has(item.exerciseType)) continue;
        // A review song shares the song row; reductions only touch E1/E2/E3 rows.
        const original = templateSeconds(item, s.stage, k1Day) ?? item.durationSec;
        expected -= original - item.durationSec;
      }
      // Rows whose item was left out that day (E11/E12 after a pain report, §7.3-7) are missing from T.
      const slots = new Set(s.plan.items.map((i) => i.slot));
      for (const row of stageTemplate(s.stage).rows)
        if (rowSeconds(row, k1Day) > 0 && !slots.has(JSON.stringify(row.slot)))
          expected -= rowSeconds(row, k1Day);
    }
    if (s.plan.totalSec !== expected) errors.push(`day ${s.day}: ${s.plan.totalSec} ≠ ${expected}`);
  }
  return errors;
}

/** §14.9-6: tempo items start at the ladder's current BPM (−10 under a slower-tempo prescription). */
function tempoErrors(run: SimResult): string[] {
  const errors: string[] = [];
  for (const s of run.sessions) {
    for (const item of s.plan.items) {
      const p = item.params;
      let subject: string | null = null;
      let start = 60;
      if (item.exerciseType === 'E5') subject = `strum:${String(p.patternId)}:${String(p.mode)}`;
      else if (item.exerciseType === 'E6') subject = `onebeat:${(p.progression as string[]).join('-')}`;
      else if (item.exerciseType === 'E8') subject = `altpick:${String(p.stringIdx)}`;
      else if (item.exerciseType === 'E17') {
        subject = `riff:${String(p.riffId)}`;
        start = riffById(String(p.riffId)).bpm;
      }
      if (!subject) continue;
      const current = s.skillsAtStart.get(subject)?.metrics.ladderBpm?.last ?? start;
      const slower = s.prescriptions.some((x) => x.kind === 'slowerTempo' && x.subjectKey === subject);
      const expected = slower ? Math.max(30, current - 10) : current;
      if (p.bpm !== expected) errors.push(`day ${s.day} ${subject}: ${String(p.bpm)} ≠ ${expected}`);
    }
  }
  return errors;
}

/** Does a routine item practise a learn item's reference ('E1', 'E5:P1', 'E5:dynamics', 'K1:posture')? */
function refMatches(ref: string, item: RoutineItem): boolean {
  const [exercise, variant] = ref.split(':') as [string, string | undefined];
  if (item.exerciseType !== exercise) return false;
  if (variant === undefined) return true;
  if (exercise === 'K1') return ((item.params.items as string[] | undefined) ?? []).includes(variant);
  if (variant === 'dynamics') return item.params.dynamics === true;
  return item.params.patternId === variant;
}

/** §14.9-4 learn coverage: each learn item practised ≥ 2 times in every window of 7 practice days. */
function learnGaps(run: SimResult, stage: number): string[] {
  const def = stageDef(stage);
  const gaps: string[] = [];
  for (const learn of def.learn) {
    const selfCheckOnly = learn.practicedBy.every((r) => r.startsWith('K1:'));
    for (let i = 0; i + 7 <= run.sessions.length; i++) {
      const window = run.sessions.slice(i, i + 7);
      if (selfCheckOnly) {
        // Left out from the window in which every self-check item it names became "됐어요" (§7.1).
        const after = run.sessions[i + 7]?.skillsAtStart ?? run.state.derived.skills;
        const done = learn.practicedBy.every(
          (r) => after.get(`check:${r.slice(3)}`)?.metrics.done?.last === 1,
        );
        if (done) continue;
      }
      const count = window
        .flatMap((s) => s.plan.items)
        .filter((item) => learn.practicedBy.some((r) => refMatches(r, item))).length;
      if (count < 2) gaps.push(`"${learn.text}" ${count}× from day ${window[0]!.day}`);
    }
  }
  return gaps;
}

/**
 * §14.9-3 rule → exercise table (fixed): every unlock rule must be fed by its exercise at least once in every
 * 7 practice days. examPassed / daysInStageAtLeast / sessionsInStageAtLeast have no exercise and are left out.
 */
const RULE_EXERCISE: Readonly<Record<string, (rule: UnlockRule) => string | null>> = {
  recallPassed: () => 'Q2',
  pairsPassedAtLeast: () => 'E2',
  unlockedPairsAtLeast: () => 'E2',
  scaleStepGraduated: () => 'E10',
  scaleMemorized: () => 'E10',
  songsCompletedAtLeast: () => 'S',
  quizRunAtLeast: () => 'Q3',
  chordCleanRatioAtLeast: () => 'E1',
  metricAtLeast: (rule) =>
    rule.kind === 'metricAtLeast'
      ? rule.subject.startsWith('strum:')
        ? 'E5'
        : rule.subject.startsWith('altpick')
          ? 'E8'
          : rule.subject === 'quiz:diagram'
            ? 'Q1'
            : null
      : null,
  countAtLeast: (rule) =>
    rule.kind === 'countAtLeast'
      ? rule.subject.startsWith('strum:')
        ? 'E5'
        : rule.subject.startsWith('tuning')
          ? 'E0'
          : null
      : null,
  distinctDaysAtLeast: () => null,
  examPassed: () => null,
  daysInStageAtLeast: () => null,
  sessionsInStageAtLeast: () => null,
};

function ruleGaps(run: SimResult, stage: number): string[] {
  const gaps: string[] = [];
  for (const rule of stageDef(stage).unlockRules) {
    const exercise = RULE_EXERCISE[rule.kind]!(rule);
    if (exercise === null) continue;
    for (let i = 0; i + 7 <= run.sessions.length; i++) {
      const window = run.sessions.slice(i, i + 7);
      if (!window.some((s) => s.plan.items.some((item) => item.exerciseType === exercise)))
        gaps.push(`${rule.kind} (${exercise}) from day ${window[0]!.day}`);
    }
  }
  return gaps;
}

describe('§14.9 simulation — reach (Stage 0–7)', () => {
  it('the improving learner promotes through every stage to Beginner 1 without a deadlock', () => {
    expect(reach.state.progression.completedBeginner1).toBe(true);
    const promotions = reach.events.filter((e) => e.kind === 'promote');
    expect(promotions.map((e) => e.stage)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // Each stage is left within its minimum stay + 20 practice days (one session per day).
    let enteredDay = 1;
    for (const e of promotions) {
      const minSessions = stageDef(e.stage - 1).minSessions;
      expect(e.day - enteredDay, `stage ${e.stage - 1}`).toBeLessThanOrEqual(minSessions + 20);
      enteredDay = e.day;
    }
    // Deadlock = all criteria met in a session but no promotion (or Beginner 1 completion) in the next one.
    for (let i = 0; i + 1 < reach.sessions.length; i++) {
      const s = reach.sessions[i]!;
      if (!s.evaluation?.allMet) continue;
      const next = reach.sessions[i + 1]!;
      const advanced = reach.events.some(
        (e) => e.day === next.day && (e.kind === 'promote' || e.kind === 'beginner1'),
      );
      expect(advanced || next.stage !== s.stage, `day ${s.day}`).toBe(true);
    }
    const last = reach.sessions.at(-1)!;
    expect(reach.events.some((e) => e.kind === 'beginner1' && e.day <= last.day + 1)).toBe(true);
  });

  it('E7 start fret: one fret lower after three pain-free runs at a fret, down to 1 (nextStretchStartFret, §7.4)', () => {
    const frets = reach.sessions.flatMap((s) =>
      s.plan.items.filter((i) => i.exerciseType === 'E7').map((i) => Number(i.params.startFret)),
    );
    expect(frets.length).toBeGreaterThan(6);
    expect(frets.slice(0, 7)).toEqual([5, 5, 5, 4, 4, 4, 3]);
    for (let i = 1; i < frets.length; i++) expect(frets[i]).toBeLessThanOrEqual(frets[i - 1]!);
    expect(Math.min(...frets)).toBeGreaterThanOrEqual(1);
    for (const s of reach.sessions)
      for (const i of s.plan.items.filter((x) => x.exerciseType === 'E7'))
        expect(i.params.startFret).toBe(s.stretchStartFret);
  });

  it('G voicing: the switch to three-finger G is suggested and accepted at Stage 6; E1 then uses G-3f (§6.4)', () => {
    const switchEvent = reach.events.find((e) => e.kind === 'gSwitch');
    expect(switchEvent?.stage).toBe(6);
    const after = reach.sessions.filter((s) => s.day > switchEvent!.day);
    const gChecks = after
      .flatMap((s) => s.plan.items)
      .filter((i) => i.exerciseType === 'E1' && String(i.params.voicingId).startsWith('G'));
    expect(gChecks.length).toBeGreaterThan(0);
    for (const item of gChecks) expect(item.params.voicingId).toBe('G-3f');
  });
});

describe.each([0, 1, 2, 3, 4, 5, 6, 7])(
  '§14.9 simulation — Stage %i coverage (28 days, improving)',
  (stage) => {
    const run = coverage(stage, improvingLearner());

    it('every rotation entry appears at least once in every 3 sessions', () => {
      expect(rotationGaps(run, stage)).toEqual([]);
    });

    it('required, unpassed pairs are assigned within 7 practice days', () => {
      expect(pairGuaranteeMisses(run)).toEqual([]);
    });

    it('every learn item is practised at least twice in every 7 practice days (§14.9-4, AC-TR2)', () => {
      expect(learnGaps(run, stage)).toEqual([]);
    });

    it('every unlock rule is fed by its exercise at least once in every 7 practice days (§14.9-3/4)', () => {
      expect(ruleGaps(run, stage)).toEqual([]);
    });

    it('Σ block time = the template length T on every day', () => {
      expect(sumErrors(run)).toEqual([]);
      for (const s of run.sessions) expect(s.plan.templateSec).toBe(1200);
    });

    it('parameters: progression mode carries ≥ 2 chords; tempos follow the ladder; E7 follows the stretch records', () => {
      for (const s of run.sessions)
        for (const item of s.plan.items)
          if (item.exerciseType === 'E5' && item.params.mode === 'progression')
            expect(new Set(item.params.chords as string[]).size, `day ${s.day}`).toBeGreaterThanOrEqual(2);
      expect(tempoErrors(run)).toEqual([]);
      for (const s of run.sessions)
        for (const item of s.plan.items.filter((i) => i.exerciseType === 'E7'))
          expect(item.params.startFret).toBe(s.stretchStartFret);
    });
  },
);

describe('§14.9 simulation — other learners (Stage 0–7)', () => {
  it('blank learner, Stage 0–1: rotation and pair guarantees still hold', () => {
    for (const stage of [0, 1]) {
      const run = coverage(stage, blankLearner());
      expect(rotationGaps(run, stage)).toEqual([]);
      expect(pairGuaranteeMisses(run)).toEqual([]);
      expect(sumErrors(run)).toEqual([]);
      expect(learnGaps(run, stage)).toEqual([]);
    }
  });

  it('plateau learner: conditional promotion within 22 practice days of Stage 3; the prescription joins Stage 4 and expires', () => {
    const plateau = simulate({
      ...base,
      learner: improvingLearner({ stuckPair: { id: 'Am|Em', cpm: 25, stage: 3 } }, 'plateau'),
      days: 120,
      stopWhen: (s) => s.progression.stage >= 5,
    });
    const entered3 = plateau.events.find((e) => e.kind === 'promote' && e.stage === 3)!;
    const conditional = plateau.events.find((e) => e.kind === 'conditional');
    expect(conditional?.stage).toBe(4);
    expect(conditional!.day - entered3.day).toBeLessThanOrEqual(22);
    const stage4 = plateau.sessions.filter((s) => s.stage === 4);
    expect(stage4[0]!.prescriptions.map((p) => [p.kind, p.subjectKey, p.reason])).toEqual([
      ['omcToPfc', 'pair:Am|Em', 'conditionalPromotion'],
    ]);
    // The prescription takes the technique slot only when no rotation entry is due (②), never displacing one.
    const drills = stage4.filter((s) => s.plan.items.some((i) => i.key === 'E4|drill:Am|Em'));
    expect(drills.length).toBeGreaterThan(0);
    const run = { ...plateau, sessions: stage4 };
    expect(rotationGaps(run, 4)).toEqual([]);
    // Expires after 8 sessions.
    const lastWith = stage4.filter((s) => s.prescriptions.length > 0).length;
    expect(lastWith).toBeLessThanOrEqual(8);
    // No deadlock: Stage 4 is still left.
    expect(plateau.state.progression.stage).toBeGreaterThanOrEqual(5);
  });

  it('pain learner: the day after a pain report halves E1/E2 and the guarantees hold', () => {
    const pain = simulate({
      ...base,
      learner: improvingLearner({ painEveryDays: 7 }, 'pain'),
      days: 200,
      stopWhen: (s) => s.progression.completedBeginner1,
    });
    expect(pain.state.progression.completedBeginner1).toBe(true);
    const reduced = pain.sessions.filter((s) => s.plan.painAdvice === 'reduceFingertipLoad');
    expect(reduced.length).toBeGreaterThan(5);
    for (const s of reduced) {
      const k1Day = s.plan.selfChecks.length > 0;
      for (const item of s.plan.items.filter((i) => FINGERTIP_LOAD_TYPES.has(i.exerciseType))) {
        const original = templateSeconds(item, s.stage, k1Day)!;
        expect(item.durationSec).toBe(Math.max(30, Math.round((original * 0.5) / 15) * 15));
      }
      for (const [i, item] of s.plan.items.entries()) {
        const params = s.params[i] as { blockMs?: number; durationMs?: number } | null;
        if (item.exerciseType === 'E1') expect(params?.blockMs).toBe(item.durationSec * 1000);
        if (item.exerciseType === 'E2') expect(params?.durationMs).toBe(item.durationSec * 1000);
      }
      expect(s.plan.items.some((i) => i.exerciseType === 'E11' || i.exerciseType === 'E12')).toBe(false);
    }
    expect(sumErrors(pain)).toEqual([]);
    for (let stage = 0; stage <= 7; stage++) {
      const run = { ...pain, sessions: pain.sessions.filter((s) => s.stage === stage) };
      expect(rotationGaps(run, stage), `stage ${stage}`).toEqual([]);
      const covered = coverage(stage, improvingLearner({ painEveryDays: 7 }, 'pain'));
      expect(learnGaps(covered, stage), `stage ${stage}`).toEqual([]);
      expect(pairGuaranteeMisses(covered), `stage ${stage}`).toEqual([]);
    }
  });

  it('plateau learner, Stage 3 coverage: learn items, rotation and pair guarantees hold', () => {
    const run = coverage(3, improvingLearner({ stuckPair: { id: 'Am|Em', cpm: 25, stage: 3 } }, 'plateau'));
    expect(learnGaps(run, 3)).toEqual([]);
    expect(rotationGaps(run, 3)).toEqual([]);
    expect(pairGuaranteeMisses(run)).toEqual([]);
  });

  it('withReviews learner, Stage 5 (AC-RT3): 30 items due at once are assigned FIFO within max(7, ⌈q/c⌉+1) days', () => {
    const start = reach.stageEntries.get(5)!;
    const pairs = unlockedPairIds(CURRICULUM, 5);
    const chords = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C'];
    const patterns = ['P0', 'P1', 'P2', 'P3', 'P4'];
    const seeded: { subjectKey: string; kind: ReviewKind; due: number }[] = [];
    const run = simulate({
      ...base,
      learner: improvingLearner({}, 'withReviews'),
      days: COVERAGE_DAYS,
      fixedStage: 5,
      start,
      beforeSession: (state) => {
        if (state.day !== start.day + 1) return;
        const due = (k: number) => state.now - (30 - k) * 60_000; // distinct due times → a FIFO order to check
        const subjects: [string, ReviewKind][] = [
          ...pairs.map((id): [string, ReviewKind] => [`pair:${id}`, 'pair']),
          ...chords.map((c): [string, ReviewKind] => [`chord:${c}`, 'chord']),
          ...patterns.map((p): [string, ReviewKind] => [`strum:${p}`, 'pattern']),
        ];
        // Interleave kinds so the FIFO order is not simply grouped by kind.
        const order = [...subjects].sort(
          (a, b) => (a[0].length % 3) - (b[0].length % 3) || a[0].localeCompare(b[0]),
        );
        order.forEach(([subjectKey, kind], k) => {
          seeded.push({ subjectKey, kind, due: due(k) });
          state.derived.reviews.set(subjectKey, {
            subjectKey,
            kind,
            step: 1,
            due: due(k),
            enqueuedAt: state.now - 10 * 86_400_000,
            lastReviewedAt: null,
            lapses: 0,
          });
        });
        // Every Stage 5 pair already passed (two days ≥ 30), so no pair is "at risk" (§14.9-2 withReviews).
        for (const id of pairs)
          for (const daysAgo of [9, 8]) {
            const at = state.now - daysAgo * 86_400_000;
            const sample = {
              subjectKey: `pair:${id}`,
              metric: 'cpmQualified',
              value: 31,
              at,
              day: dayKey(at),
              attemptId: `seed-${id}-${daysAgo}`,
            };
            state.derived.skills.set(
              sample.subjectKey,
              applySample(state.derived.skills.get(sample.subjectKey), sample),
            );
          }
      },
    });
    expect(seeded).toHaveLength(30);
    const firstAssigned = new Map<string, number>();
    run.sessions.forEach((s, i) => {
      for (const item of s.plan.items)
        if (item.reviewOf && !firstAssigned.has(item.reviewOf)) firstAssigned.set(item.reviewOf, i);
    });
    const capacity: Record<string, number> = { chord: 1, pair: 1, pattern: 1 / 3 };
    for (const kind of ['chord', 'pair', 'pattern'] as const) {
      const items = seeded.filter((x) => x.kind === kind).sort((a, b) => a.due - b.due);
      const bound = Math.max(7, Math.ceil(items.length / capacity[kind]!) + 1);
      const delays = items.map((x) => firstAssigned.get(x.subjectKey));
      for (const [k, d] of delays.entries()) {
        expect(d, `${items[k]!.subjectKey} assigned`).toBeDefined();
        // Days from becoming due (the first session) to the session that assigned it (+1: that day counts).
        expect(d! + 1, `${items[k]!.subjectKey} delay`).toBeLessThanOrEqual(bound);
      }
      // FIFO: an item due earlier is never assigned after one due later.
      for (let k = 1; k < delays.length; k++)
        expect(delays[k]!, `${kind} FIFO at ${k}`).toBeGreaterThanOrEqual(delays[k - 1]!);
    }
    expect(learnGaps(run, 5)).toEqual([]);
    expect(rotationGaps(run, 5)).toEqual([]);
  });

  it('stuck ladders (§7.4): −10 BPM for a week from the ladder tempo, never cumulative, the ladder kept', () => {
    const run = simulate({
      ...base,

      learner: improvingLearner({ stuckLadders: true }, 'stuck'),

      days: 40,

      fixedStage: 4,

      start: reach.stageEntries.get(4)!,
    });

    const prescribed = run.sessions.filter((s) => s.prescriptions.some((p) => p.kind === 'slowerTempo'));

    expect(prescribed.length).toBeGreaterThan(0);

    for (const s of run.sessions) {
      for (const item of s.plan.items.filter((i) => i.exerciseType === 'E5')) {
        const subject = `strum:${String(item.params.patternId)}:${String(item.params.mode)}`;

        const ladder = s.skillsAtStart.get(subject)?.metrics.ladderBpm?.last ?? 60;

        const slowed = s.prescriptions.some((p) => p.kind === 'slowerTempo' && p.subjectKey === subject);

        expect(item.params.bpm, `day ${s.day} ${subject}`).toBe(slowed ? ladder - 10 : ladder);

        // The stored ladder never sinks below where it started (the learner never passes or fails twice).

        expect(ladder, `day ${s.day} ${subject}`).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('template slots are JSON of known slot kinds (user templates re-fill from them)', () => {
    for (const s of reach.sessions)
      for (const item of s.plan.items) {
        expect(item.slot, `${item.exerciseType} day ${s.day}`).toBeDefined();
        const slot = JSON.parse(item.slot!) as TemplateSlot;
        expect(typeof slot.kind).toBe('string');
      }
  });
});
