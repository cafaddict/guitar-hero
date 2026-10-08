/**
 * SPEC v1.1 §14.9 curriculum simulation, Stage 0–7 (M9 scope: AC-RT2 slots/rotation/prescriptions, AC-RT5
 * parameters, AC-PG2/PG3 wiring). The real plugin registry and `pluginParamsFor` are injected; only exercise
 * results come from the learner models.
 */
import { describe, expect, it } from 'vitest';
import { CURRICULUM, stageDef } from '../content/curriculum';
import { riffById } from '../content/riffs';
import type { RoutineItem } from '../content/schemas';
import { PRACTICE_SONGS } from '../content/songs';
import { simulationDeps } from '../exercises/testing/simDeps';
import { entryKey } from './routine';
import { rowSeconds, stageTemplate, type TemplateSlot } from './routineTemplates';
import { FINGERTIP_LOAD_TYPES } from './safety';
import { blankLearner, improvingLearner } from './simLearners';
import { type LearnerModel, type SimResult, type SimSession, simulate } from './simulate';

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
    // Deadlock = all criteria met in a session but no promotion in the next one.
    for (let i = 0; i + 1 < reach.sessions.length; i++) {
      const s = reach.sessions[i]!;
      const next = reach.sessions[i + 1]!;
      if (s.evaluation?.allMet) expect(next.stage, `day ${s.day}`).not.toBe(s.stage === 7 ? -1 : s.stage);
    }
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
