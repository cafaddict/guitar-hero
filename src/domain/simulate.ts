/**
 * Curriculum simulation (SPEC v1.1 §14.9): a virtual learner follows the generated routine one session per day,
 * using the same domain code as the app (`generateRoutine`, `evaluateStage`, `prepareSession`, the review queue).
 * Pure: app-layer functions (plugin params, plugin metrics, skill/review updates) are injected, so the test can
 * pass the real registry and only the exercise results come from a learner model.
 */
import type { PracticeSong, RoutineItem, StageDef } from '../content/schemas';
import type { DerivedState } from './derive';
import { practiceHistory } from './history';
import { evaluateStage, LAST_PLAYABLE_STAGE, promote, type StageEvaluation } from './progression';
import {
  type Attempt,
  DAY_MS,
  initialProgression,
  type MetricSample,
  type MetricSampleInput,
  type ProgressionState,
  type ReviewItem,
  type SelfReport,
  type Session,
  type SkillState,
} from './records';
import { generateRoutine, type RoutinePlan, requiredUnpassedPairs } from './routine';
import { stretchStartFretFrom } from './safety';
import { prepareSession } from './sessionPrep';
import { dueReviews } from './srs';

/** App functions the simulation needs, injected by the caller (tests pass the real ones). */
export interface SimDeps {
  /** Routine item → validated plugin params (`pluginParamsFor` with the registered plugin). */
  paramsFor(item: RoutineItem, stage: number, gVoicing: ProgressionState['gVoicing']): unknown;
  /** The plugin's metric extraction (throws when the learner produced an invalid result). */
  toMetrics(exerciseType: string, result: unknown, params: unknown): MetricSampleInput[];
  /** Skill and review update for one stored attempt (`applyAttempt`). */
  applyAttempt(state: DerivedState, attempt: Attempt): { samples: MetricSample[] };
}

/** What a learner model sees when it produces one run's result. */
export interface LearnerContext {
  stage: number;
  day: number;
  now: number;
  /** The learner's own memory across runs (counters per subject). */
  memory: Map<string, number>;
}

export interface LearnerModel {
  name: string;
  /** The result of running `item` with `params`, or null for "nothing recorded". */
  result(item: RoutineItem, params: unknown, ctx: LearnerContext): unknown | null;
  /** Self report after the session (pain), or null. */
  selfReport?(ctx: LearnerContext): SelfReport | null;
  /** Accepts home suggestions (G switch, conditional promotion) at the next session start. */
  acceptsSuggestions: boolean;
}

export interface SimSession {
  day: number;
  /** Session number (1-based). */
  session: number;
  practiceDay: number;
  stage: number;
  now: number;
  plan: RoutinePlan;
  /** Params each non-rest item ran with (same order as `plan.items`, null for rests). */
  params: (unknown | null)[];
  /** Stage evaluation after the session. */
  evaluation: StageEvaluation | null;
  prescriptions: ProgressionState['prescriptions'];
  gVoicing: ProgressionState['gVoicing'];
  /** Due reviews at the session start (before the routine was generated). */
  due: ReviewItem[];
  stretchStartFret: number;
  /** Pairs the stage's rules required and that were not passed at the session start (§7.3-3 guarantee). */
  requiredPairs: string[];
  /** Skill states at the session start (to check tempo parameters against the ladder state, §14.9-6). */
  skillsAtStart: ReadonlyMap<string, SkillState>;
}

export interface SimEvent {
  day: number;
  kind: 'promote' | 'conditional' | 'gSwitch' | 'exam' | 'beginner1';
  stage: number;
}

export interface SimState {
  now: number;
  day: number;
  progression: ProgressionState;
  sessions: Session[];
  attempts: Attempt[];
  derived: DerivedState;
  samples: MetricSample[];
  memory: Map<string, number>;
}

export interface SimOptions {
  deps: SimDeps;
  learner: LearnerModel;
  curriculum: readonly StageDef[];
  songs: readonly PracticeSong[];
  days: number;
  /** Fixed stage with promotions off (coverage runs); null = promotions on (reach runs). */
  fixedStage?: number | null;
  /** Start from a snapshot (e.g. the day a stage was entered); default = a fresh learner at Stage 0. */
  start?: SimState;
  startAt?: number;
  /** Mutates the state before a given day's session (e.g. seed due reviews). */
  beforeSession?: (state: SimState) => void;
  /** Stop early (e.g. Beginner 1 complete). */
  stopWhen?: (state: SimState) => boolean;
}

export interface SimResult {
  sessions: SimSession[];
  events: SimEvent[];
  state: SimState;
  /** Snapshot of the state at the start of the day each stage was entered (reach runs). */
  stageEntries: Map<number, SimState>;
}

const SESSION_MINUTES_RUN = 25;
/** Default first session: a Monday evening, local time. */
export const SIM_START = new Date(2026, 0, 5, 19).getTime();
const EXAM_ITEMS = ['1', '2', '3', '4', '5'] as const;
const RECENT_DAYS = 22;

export function freshState(startAt: number): SimState {
  return {
    now: startAt,
    day: 0,
    progression: initialProgression(startAt),
    sessions: [],
    attempts: [],
    derived: { skills: new Map(), reviews: new Map() },
    samples: [],
    memory: new Map(),
  };
}

/** A deep-enough copy so a snapshot is not changed by the run that continues from it. */
export function cloneState(state: SimState): SimState {
  return {
    now: state.now,
    day: state.day,
    progression: structuredClone(state.progression),
    sessions: [...state.sessions],
    attempts: [...state.attempts],
    derived: { skills: new Map(state.derived.skills), reviews: new Map(state.derived.reviews) },
    samples: [...state.samples],
    memory: new Map(state.memory),
  };
}

function evaluate(state: SimState, curriculum: readonly StageDef[], songs: readonly PracticeSong[]) {
  const def = curriculum.find((d) => d.stage === state.progression.stage);
  if (!def) return null;
  return evaluateStage(def, {
    stage: state.progression.stage,
    curriculum,
    songs,
    skills: state.derived.skills,
    sessionsInStage: state.progression.sessionsInStage,
    stageEnteredAt: state.progression.stageEnteredAt,
    examPassed: EXAM_ITEMS.every((item) => state.progression.exam[item] !== undefined),
    now: state.now,
    recentSamples: state.samples.filter((s) => s.at >= state.now - RECENT_DAYS * DAY_MS),
  });
}

export function simulate(options: SimOptions): SimResult {
  const { deps, learner, curriculum, songs } = options;
  const state = options.start ? cloneState(options.start) : freshState(options.startAt ?? SIM_START);
  const sessions: SimSession[] = [];
  const events: SimEvent[] = [];
  const stageEntries = new Map<number, SimState>();
  const promotions = options.fixedStage === null || options.fixedStage === undefined;
  if (!promotions) state.progression = { ...state.progression, stage: options.fixedStage! };
  if (promotions && !stageEntries.has(state.progression.stage))
    stageEntries.set(state.progression.stage, cloneState(state));

  for (let i = 0; i < options.days; i++) {
    state.day += 1;
    // One session a day in the evening.
    state.now = state.day === 1 && state.sessions.length === 0 ? state.now : state.now + DAY_MS;
    let history = practiceHistory(state.sessions, state.attempts, state.now);

    // Session start: promotion offered by the last evaluation (accepted), exam, prescriptions, G switch.
    if (promotions) {
      const p = state.progression;
      if (p.stage === 7 && p.sessionsInStage >= 4 && !EXAM_ITEMS.every((k) => p.exam[k] !== undefined)) {
        state.progression = { ...p, exam: Object.fromEntries(EXAM_ITEMS.map((k) => [k, state.now])) };
        events.push({ day: state.day, kind: 'exam', stage: 7 });
      }
      const ev = evaluate(state, curriculum, songs);
      if (
        ev &&
        !state.progression.completedBeginner1 &&
        (ev.allMet || (ev.conditionalAvailable && learner.acceptsSuggestions))
      ) {
        const conditional = !ev.allMet;
        const before = state.progression.stage;
        state.progression = promote(
          state.progression,
          state.now,
          conditional,
          ev.plateauedPairs,
          history.sessionNumber,
        );
        events.push({
          day: state.day,
          kind:
            state.progression.completedBeginner1 && before >= LAST_PLAYABLE_STAGE
              ? 'beginner1'
              : conditional
                ? 'conditional'
                : 'promote',
          stage: state.progression.stage,
        });
        if (state.progression.stage !== before) stageEntries.set(state.progression.stage, cloneState(state));
      }
    }
    options.beforeSession?.(state);
    history = practiceHistory(state.sessions, state.attempts, state.now);
    const recentSamples = state.samples.filter((s) => s.at >= state.now - RECENT_DAYS * DAY_MS);
    const prep = prepareSession({
      progression: state.progression,
      skills: state.derived.skills,
      recentSamples,
      sessionNumber: history.sessionNumber,
      now: state.now,
    });
    state.progression = prep.progression;
    if (prep.gSuggestion && learner.acceptsSuggestions) {
      state.progression = { ...state.progression, gVoicing: prep.gSuggestion };
      events.push({ day: state.day, kind: 'gSwitch', stage: state.progression.stage });
    }

    const finished = state.sessions.filter((s) => s.endedAt !== null);
    const last = finished.at(-1);
    const due = dueReviews([...state.derived.reviews.values()], state.now);
    const stretchRuns = state.attempts.flatMap((a) =>
      a.exerciseType === 'E7' ? [a.result as { startFret: number; pain: number | null }] : [],
    );
    const stretchStartFret = stretchStartFretFrom(stretchRuns);
    const plan = generateRoutine({
      stage: state.progression.stage,
      curriculum,
      songs,
      gVoicing: state.progression.gVoicing,
      skills: state.derived.skills,
      now: state.now,
      lastPracticeAt: last?.startedAt ?? null,
      firstPracticeAt: finished[0]?.startedAt ?? null,
      lastSelfReport: last?.selfReport ?? null,
      sessionMinutes: null,
      confirmedOverCap: true,
      dueReviews: due,
      changesDoneToday: 0,
      prescriptions: state.progression.prescriptions,
      history,
      sessionsInStage: state.progression.sessionsInStage,
      stretchStartFret,
      userTemplate: null,
      seed: state.day,
    });

    const skillsAtStart = new Map(state.derived.skills);
    const stageDefNow = curriculum.find((d) => d.stage === state.progression.stage)!;
    const requiredPairs = requiredUnpassedPairs(
      {
        stage: state.progression.stage,
        curriculum,
        songs,
        skills: skillsAtStart,
        sessionsInStage: state.progression.sessionsInStage,
        now: state.now,
      },
      stageDefNow,
    );
    const sessionId = `sim-${state.day}`;
    const ctx: LearnerContext = {
      stage: state.progression.stage,
      day: state.day,
      now: state.now,
      memory: state.memory,
    };
    const params: (unknown | null)[] = [];
    let completed = 0;
    let offset = 0;
    for (const item of plan.items) {
      if (item.exerciseType === 'REST') {
        params.push(null);
        continue;
      }
      const p = deps.paramsFor(item, state.progression.stage, state.progression.gVoicing);
      params.push(p);
      const result = learner.result(item, p, ctx);
      offset += item.durationSec * 1000;
      if (result === null) continue;
      deps.toMetrics(item.exerciseType, result, p);
      const attempt: Attempt = {
        id: `${sessionId}-${item.id}`,
        sessionId,
        exerciseType: item.exerciseType,
        exerciseVersion: 1,
        startedAt: state.now + offset - item.durationSec * 1000,
        endedAt: state.now + offset,
        params: p,
        result,
        detectorVersion: null,
        processingMs: 0,
        reviewOf: item.reviewOf ?? null,
        routineKey: item.key ?? null,
      };
      state.attempts.push(attempt);
      state.samples.push(...deps.applyAttempt(state.derived, attempt).samples);
      completed += 1;
    }
    const report = learner.selfReport?.(ctx) ?? null;
    state.sessions.push({
      id: sessionId,
      startedAt: state.now,
      endedAt: state.now + SESSION_MINUTES_RUN * 60_000,
      routineId: null,
      plannedItems: plan.items.length,
      completedItems: completed,
      selfReport: report,
      stage: state.progression.stage,
    });
    if (completed > 0)
      state.progression = { ...state.progression, sessionsInStage: state.progression.sessionsInStage + 1 };
    sessions.push({
      day: state.day,
      session: history.sessionNumber,
      practiceDay: history.practiceDay,
      stage: state.progression.stage,
      now: state.now,
      plan,
      params,
      evaluation: evaluate(state, curriculum, songs),
      prescriptions: state.progression.prescriptions,
      gVoicing: state.progression.gVoicing,
      due,
      stretchStartFret,
      requiredPairs,
      skillsAtStart,
    });
    if (options.stopWhen?.(state)) break;
  }
  return { sessions, events, state, stageEntries };
}
