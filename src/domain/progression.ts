/**
 * Progression engine (SPEC v1.1 §7.4): evaluates data-defined unlock rules, conditional promotion (3-week pair
 * plateau), stagnation detection (2 weeks → prescriptions), G voicing switches and graduation into the review
 * queue. Pure: time and the recent metric samples are arguments.
 */
import { modeOpenBpm, STRUM_MODES } from '../content/patterns';
import { RIFF_TARGET_EXTRA_BPM, RIFFS } from '../content/riffs';
import type { PracticeSong, StageDef, UnlockRule } from '../content/schemas';
import { classOfVoicing, type GVoicing } from '../content/voicings';
import { PFC_GRADUATION_DAYS, SCALE_GRADUATION_BPM } from './exerciseResults';
import { pairKey, pairsAmong, parsePairId } from './pairs';
import {
  DAY_MS,
  type MetricSample,
  type Prescription,
  type PrescriptionKind,
  type ProgressionState,
  type ReviewKind,
  type SkillState,
  startOfDay,
} from './records';
import { chordLevel, cleanRatio, daysReaching, median } from './skills';

export interface RuleContext {
  stage: number;
  curriculum: readonly StageDef[];
  songs: readonly PracticeSong[];
  skills: ReadonlyMap<string, SkillState>;
  sessionsInStage: number;
  stageEnteredAt: number;
  examPassed: boolean;
  now: number;
  /** Metric samples of (at least) the last 21 days, for the 3-week pair plateau. */
  recentSamples: readonly MetricSample[];
}

export interface RuleEvaluation {
  rule: UnlockRule;
  met: boolean;
  /** 0..1 progress for the checklist UI. */
  progress: number;
  /** Subjects still missing (e.g. pair ids or chord classes). */
  missing: string[];
}

/** Per-minute criteria count only runs of at least 55 s (SPEC v1.1 §7.1). */
export const PAIR_METRIC = 'cpmQualified';
export const PAIR_PASS_CPM = 30;
export const PAIR_PASS_DAYS = 2;

/** Chord classes unlocked up to and including `stage`. */
export function unlockedChordClasses(curriculum: readonly StageDef[], stage: number): string[] {
  const classes: string[] = [];
  for (const def of curriculum) {
    if (def.stage > stage) continue;
    for (const id of def.newChords) {
      const cls = classOfVoicing(id);
      if (!classes.includes(cls)) classes.push(cls);
    }
  }
  return classes;
}

/** Core pairs (§6.5) among the chords unlocked up to `stage` (Stage 0–7 pair universe). */
export function unlockedPairIds(curriculum: readonly StageDef[], stage: number): string[] {
  return pairsAmong(unlockedChordClasses(curriculum, stage));
}

/** Pairs a stage rotates through: Stage 0–7 the unlocked core pairs, Stage 8–11 that stage's own pairs. */
export function stagePairUniverse(curriculum: readonly StageDef[], stage: number): string[] {
  const def = curriculum.find((d) => d.stage === stage);
  if (def && def.stagePairs.length > 0) return [...def.stagePairs];
  return unlockedPairIds(curriculum, stage);
}

/** A pair is passed when it reached ≥ 30 qualified changes/min on two different days (§7.1 "쌍 ≥30"). */
export function pairPassed(skills: ReadonlyMap<string, SkillState>, id: string): boolean {
  const [a, b] = parsePairId(id);
  return daysReaching(skills.get(pairKey(a, b)), PAIR_METRIC, PAIR_PASS_CPM) >= PAIR_PASS_DAYS;
}

/** §7.1 "Q2: X 3초 안 정답": the recall card passed (correct within 3 s) on two different days. */
export function recallPassed(skills: ReadonlyMap<string, SkillState>, chordClass: string): boolean {
  return daysReaching(skills.get(`recall:${chordClass}`), 'pass', 1) >= 2;
}

/** Songs completed in perform (or hidden) stage with ≤ 2 stops (§11.10 "완주"). */
export function songCompleted(skills: ReadonlyMap<string, SkillState>, songId: string): boolean {
  return (skills.get(`song:${songId}`)?.metrics.performCompleted?.best ?? 0) >= 1;
}

export function songMatches(
  song: PracticeSong,
  filter: { stage?: number | undefined; anyChords?: readonly string[] | undefined },
): boolean {
  if (filter.stage !== undefined && song.stage !== filter.stage) return false;
  if (filter.anyChords) {
    const chords = new Set(song.sections.flatMap((s) => s.bars));
    if (!filter.anyChords.some((c) => chords.has(c))) return false;
  }
  return true;
}

function subjectsMatching(skills: ReadonlyMap<string, SkillState>, subject: string): SkillState[] {
  if (subject.endsWith('*')) {
    const prefix = subject.slice(0, -1);
    return [...skills.values()].filter((s) => s.subjectKey.startsWith(prefix));
  }
  const skill = skills.get(subject);
  return skill ? [skill] : [];
}

function countAtLeast(skills: SkillState[], metric: string, minValue: number): number {
  // Summaries keep only recent values; dayBest/count are exact. For "reached ≥ minValue n times" we use
  // the recent window plus the per-day bests (a lower bound that is exact for n ≤ 10).
  let n = 0;
  for (const skill of skills) {
    const summary = skill.metrics[metric];
    if (!summary) continue;
    const recentHits = summary.recent.filter((v) => v >= minValue).length;
    const dayHits = Object.values(summary.dayBest).filter((v) => v >= minValue).length;
    n += Math.max(recentHits, dayHits);
  }
  return n;
}

/** Calendar days since entering the stage (day of entry = day 0). */
export function daysInStage(stageEnteredAt: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(stageEnteredAt)) / DAY_MS);
}

const fromList = (rule: UnlockRule, total: number, missing: string[]): RuleEvaluation => ({
  rule,
  met: missing.length === 0,
  progress: total > 0 ? 1 - missing.length / total : 1,
  missing,
});

export function evaluateRule(rule: UnlockRule, ctx: RuleContext): RuleEvaluation {
  switch (rule.kind) {
    case 'countAtLeast': {
      const n = countAtLeast(subjectsMatching(ctx.skills, rule.subject), rule.metric, rule.minValue);
      return {
        rule,
        met: n >= rule.count,
        progress: Math.min(1, n / rule.count),
        missing: n >= rule.count ? [] : [rule.subject],
      };
    }
    case 'metricAtLeast': {
      const best = Math.max(
        Number.NEGATIVE_INFINITY,
        ...subjectsMatching(ctx.skills, rule.subject).map(
          (s) => s.metrics[rule.metric]?.best ?? Number.NEGATIVE_INFINITY,
        ),
      );
      const met = best >= rule.value;
      const progress = Number.isFinite(best) ? Math.max(0, Math.min(1, best / rule.value)) : 0;
      return { rule, met, progress, missing: met ? [] : [rule.subject] };
    }
    case 'distinctDaysAtLeast': {
      const days = daysReaching(ctx.skills.get(rule.subject), rule.metric, rule.value);
      return {
        rule,
        met: days >= rule.days,
        progress: Math.min(1, days / rule.days),
        missing: days >= rule.days ? [] : [rule.subject],
      };
    }
    case 'unlockedPairsAtLeast': {
      const pairs = unlockedPairIds(ctx.curriculum, ctx.stage);
      const missing = pairs.filter((id) => {
        const [a, b] = parsePairId(id);
        return daysReaching(ctx.skills.get(pairKey(a, b)), PAIR_METRIC, rule.value) < rule.days;
      });
      return fromList(rule, pairs.length, missing);
    }
    case 'pairsPassedAtLeast': {
      const missing = rule.pairs.filter((id) => !pairPassed(ctx.skills, id));
      const passed = rule.pairs.length - missing.length;
      const met = passed >= rule.minCount;
      return { rule, met, progress: Math.min(1, passed / rule.minCount), missing: met ? [] : missing };
    }
    case 'recallPassed':
      return fromList(
        rule,
        rule.voicingIds.length,
        rule.voicingIds.filter((id) => !recallPassed(ctx.skills, classOfVoicing(id))),
      );
    case 'sessionsInStageAtLeast': {
      const met = ctx.sessionsInStage >= rule.count;
      return {
        rule,
        met,
        progress: Math.min(1, ctx.sessionsInStage / rule.count),
        missing: met ? [] : ['sessions'],
      };
    }
    case 'daysInStageAtLeast': {
      const days = daysInStage(ctx.stageEnteredAt, ctx.now);
      return {
        rule,
        met: days >= rule.days,
        progress: Math.min(1, days / rule.days),
        missing: days >= rule.days ? [] : ['days'],
      };
    }
    case 'songsCompletedAtLeast': {
      const candidates = ctx.songs.filter((song) => songMatches(song, rule.filter));
      const done = candidates.filter((song) => songCompleted(ctx.skills, song.id)).length;
      const met = done >= rule.count;
      return {
        rule,
        met,
        progress: Math.min(1, done / rule.count),
        missing: met ? [] : candidates.filter((song) => !songCompleted(ctx.skills, song.id)).map((s) => s.id),
      };
    }
    case 'scaleStepGraduated': {
      const best = ctx.skills.get(`scale:${rule.scaleId}:s${rule.step}`)?.metrics.streakBpm?.best ?? 0;
      const met = best >= rule.bpm;
      return { rule, met, progress: Math.min(1, best / rule.bpm), missing: met ? [] : [rule.scaleId] };
    }
    case 'scaleMemorized': {
      const met = (ctx.skills.get(`scale:${rule.scaleId}:memorized`)?.metrics.memorized?.best ?? 0) >= 1;
      return { rule, met, progress: met ? 1 : 0, missing: met ? [] : [rule.scaleId] };
    }
    case 'chordCleanRatioAtLeast': {
      const ratios = rule.voicingIds.map((id) => {
        const skill = ctx.skills.get(`chord:${id}`);
        const recent = skill?.metrics.clean?.recent ?? [];
        return recent.length >= rule.window ? (cleanRatio(skill) ?? 0) : 0;
      });
      const best = Math.max(0, ...ratios);
      const met = best >= rule.ratio;
      return {
        rule,
        met,
        progress: Math.min(1, best / rule.ratio),
        missing: met ? [] : [...rule.voicingIds],
      };
    }
    case 'quizRunAtLeast': {
      const best = ctx.skills.get(`quiz:notes:${rule.scope}`)?.metrics.qualifiedAccuracy?.best ?? 0;
      const met = best >= rule.accuracy;
      return { rule, met, progress: Math.min(1, best / rule.accuracy), missing: met ? [] : [rule.scope] };
    }
    case 'examPassed':
      return {
        rule,
        met: ctx.examPassed,
        progress: ctx.examPassed ? 1 : 0,
        missing: ctx.examPassed ? [] : ['exam'],
      };
  }
}

// --- 3-week pair plateau (conditional promotion) ---------------------------------------------------------

export const PLATEAU_WINDOW_DAYS = 21;
export const PLATEAU_MIN_RUNS = 6;
export const PLATEAU_MIN_ELAPSED_DAYS = 14;
export const PLATEAU_MIN_GAIN = 2;

/**
 * SPEC v1.1 §7.4 "쌍 정체(3주)": in the 21 days ending today the pair has ≥ 6 qualified runs, the first of them
 * at least 14 days before today, and the median of the last 3 rose less than 2 over the median of the first 3.
 */
export function isPairPlateaued(samples: readonly MetricSample[], id: string, now: number): boolean {
  const from = now - PLATEAU_WINDOW_DAYS * DAY_MS;
  const [a, b] = parsePairId(id);
  const key = pairKey(a, b);
  const inWindow = samples
    .filter((s) => s.subjectKey === key && s.metric === PAIR_METRIC && s.at >= from && s.at <= now)
    .sort((x, y) => x.at - y.at);
  if (inWindow.length < PLATEAU_MIN_RUNS) return false;
  if (inWindow[0]!.at > now - PLATEAU_MIN_ELAPSED_DAYS * DAY_MS) return false;
  const values = inWindow.map((s) => s.value);
  return median(values.slice(-3))! - median(values.slice(0, 3))! < PLATEAU_MIN_GAIN;
}

export interface StageEvaluation {
  stage: number;
  rules: RuleEvaluation[];
  allMet: boolean;
  /** Every non-pair rule is met and the missing pairs (up to the shortfall) are plateaued for 3 weeks. */
  conditionalAvailable: boolean;
  /** Pair ids to prescribe after a conditional promotion. */
  plateauedPairs: string[];
  progress: number;
}

const PAIR_RULE_KINDS: ReadonlySet<UnlockRule['kind']> = new Set([
  'unlockedPairsAtLeast',
  'pairsPassedAtLeast',
]);

export function evaluateStage(def: StageDef, ctx: RuleContext): StageEvaluation {
  const rules = def.unlockRules.map((rule) => evaluateRule(rule, ctx));
  const allMet = rules.length > 0 && rules.every((r) => r.met);
  const unmet = rules.filter((r) => !r.met);
  const pairOnly = unmet.length > 0 && unmet.every((r) => PAIR_RULE_KINDS.has(r.rule.kind));
  const plateauedPairs: string[] = [];
  let pairRulesSatisfiable = pairOnly;
  for (const r of unmet) {
    if (!PAIR_RULE_KINDS.has(r.rule.kind)) continue;
    const plateaued = r.missing.filter((id) => isPairPlateaued(ctx.recentSamples, id, ctx.now));
    plateauedPairs.push(...plateaued);
    if (r.rule.kind === 'unlockedPairsAtLeast') {
      if (plateaued.length !== r.missing.length) pairRulesSatisfiable = false;
    } else if (r.rule.kind === 'pairsPassedAtLeast') {
      const passed = r.rule.pairs.length - r.missing.length;
      if (plateaued.length < r.rule.minCount - passed) pairRulesSatisfiable = false;
    }
  }
  // Beginner 2 is completed only by meeting Stage 11's rules (§7.7): no conditional completion.
  const conditionalAvailable = pairRulesSatisfiable && plateauedPairs.length > 0 && def.stage < FINAL_STAGE;
  const progress = rules.length ? rules.reduce((sum, r) => sum + r.progress, 0) / rules.length : 0;
  return { stage: def.stage, rules, allMet, conditionalAvailable, plateauedPairs, progress };
}

/** Stage 7's graduation exam completes Beginner 1; promotion then continues into Stage 8 (SPEC v1.1 §7.2). */
export const BEGINNER1_LAST_STAGE = 7;
/** The last stage: meeting its rules completes Beginner 2 and the routine stays at this stage (§7.7). */
export const FINAL_STAGE = 11;

/** Conditional-promotion and stagnation prescriptions run for 8 sessions (D-060); −10 BPM runs one week. */
export const PRESCRIPTION_SESSIONS = 8;
export const SLOWER_TEMPO_DAYS = 7;
export const SLOWER_TEMPO_BPM = 10;

/**
 * Moves to the next stage — leaving Stage 7 also marks Beginner 1 complete (§7.2) — or, at the final stage,
 * records Beginner 2 complete and stays (§7.7). A conditional promotion adds the plateaued pairs' prescriptions
 * (precise fast changes + anchor/air drill) to the next stage.
 */
export function promote(
  state: ProgressionState,
  now: number,
  conditional: boolean,
  pairs: readonly string[] = [],
  sessionNumber = 0,
): ProgressionState {
  // A stay already closed in the history (a v1 user who completed Beginner 1 at Stage 7 and now moves on to
  // Stage 8) is updated, not recorded twice.
  const row = { stage: state.stage, enteredAt: state.stageEnteredAt, leftAt: now, conditional };
  const last = state.history.at(-1);
  const history =
    last && last.stage === row.stage && last.enteredAt === row.enteredAt
      ? [...state.history.slice(0, -1), row]
      : [...state.history, row];
  if (state.stage >= FINAL_STAGE) {
    if (state.completedBeginner2) return state;
    return { ...state, history, completedBeginner2: true, beginner2CompletedAt: now };
  }
  const added: Prescription[] = conditional
    ? pairs.map((id) => ({
        kind: 'omcToPfc',
        subjectKey: `pair:${id}`,
        startedSession: sessionNumber,
        startedAt: now,
        expiresAfterSessions: PRESCRIPTION_SESSIONS,
        reason: 'conditionalPromotion',
      }))
    : [];
  const kept = state.prescriptions.filter((p) => !added.some((a) => a.subjectKey === p.subjectKey));
  return {
    ...state,
    ...(state.stage === BEGINNER1_LAST_STAGE ? { completedBeginner1: true } : {}),
    stage: state.stage + 1,
    stageEnteredAt: now,
    sessionsInStage: 0,
    history,
    prescriptions: [...kept, ...added],
  };
}

// --- 2-week stagnation (prescriptions) --------------------------------------------------------------------

export const STAGNATION_WINDOW_DAYS = 14;
export const STAGNATION_MIN_RUNS = 4;
export const STAGNATION_MIN_ELAPSED_DAYS = 9;

export interface Stagnation {
  subjectKey: string;
  prescription: PrescriptionKind;
}

/** Ladder subjects and the tempo at which they stop being judged for stagnation (SPEC v1.1 §7.4). */
export interface LadderTargets {
  /** Graduated, or the ladder reached its goal → not stagnant by definition. */
  done(subjectKey: string, currentBpm: number): boolean;
}

const LADDER_PREFIXES = ['strum:', 'scale:', 'riff:', 'altpick:'] as const;

function isLadderSubject(key: string): boolean {
  if (key === 'altpick:any') return false;
  if (key.startsWith('strum:')) return key.split(':').length === 3;
  return LADDER_PREFIXES.some((p) => key.startsWith(p));
}

/** Groups window samples per subject, oldest first. */
function windowSamples(samples: readonly MetricSample[], metric: string, from: number, now: number) {
  const bySubject = new Map<string, MetricSample[]>();
  for (const s of samples) {
    if (s.metric !== metric || s.at < from || s.at > now) continue;
    const list = bySubject.get(s.subjectKey) ?? [];
    list.push(s);
    bySubject.set(s.subjectKey, list);
  }
  for (const list of bySubject.values()) list.sort((a, b) => a.at - b.at);
  return bySubject;
}

/**
 * SPEC v1.1 §7.4 "정체 감지" (research 01:389 "2주"): over the 14 days ending today, a subject with ≥ 4 runs whose
 * first run is ≥ 9 days old and whose key metric did not improve enough:
 * - pair (E2): median of the last 3 vs the first 3 qualified runs, + 2 → OMC → PFC
 * - pair (E3): clean rate below 0.5 rising < 0.1 → PFC → OMC
 * - chord (E1): clean ratio of the last 10 vs the first 10 checks, + 0.1 → pluck mode
 * - pattern / scale / riff / alternate picking: ladder tempo, + 5 → one week at −10 BPM
 * Passed pairs and acquired chords are not watched; neither are ladders that graduated or reached their goal.
 */
export function detectStagnation(
  skills: ReadonlyMap<string, SkillState>,
  samples: readonly MetricSample[],
  now: number,
  ladders: LadderTargets,
): Stagnation[] {
  const from = now - STAGNATION_WINDOW_DAYS * DAY_MS;
  const oldEnough = (list: readonly MetricSample[]) =>
    list[0]!.at <= now - STAGNATION_MIN_ELAPSED_DAYS * DAY_MS;
  const out: Stagnation[] = [];

  for (const [key, list] of windowSamples(samples, PAIR_METRIC, from, now)) {
    if (!key.startsWith('pair:') || list.length < STAGNATION_MIN_RUNS || !oldEnough(list)) continue;
    if (pairPassed(skills, key.slice('pair:'.length))) continue;
    const values = list.map((s) => s.value);
    if (median(values.slice(-3))! - median(values.slice(0, 3))! < PLATEAU_MIN_GAIN)
      out.push({ subjectKey: key, prescription: 'omcToPfc' });
  }

  for (const [key, list] of windowSamples(samples, 'cleanRate', from, now)) {
    if (!key.startsWith('pfc:') || list.length < STAGNATION_MIN_RUNS || !oldEnough(list)) continue;
    const first = list[0]!.value;
    const last = list.at(-1)!.value;
    if (last < 0.5 && last - first < 0.1)
      out.push({ subjectKey: `pair:${key.slice('pfc:'.length)}`, prescription: 'pfcToOmc' });
  }

  for (const [key, list] of windowSamples(samples, 'clean', from, now)) {
    if (!key.startsWith('chord:') || !oldEnough(list)) continue;
    const runs = new Set(list.map((s) => s.attemptId)).size;
    if (runs < STAGNATION_MIN_RUNS) continue;
    const level = chordLevel(skills.get(key));
    if (level === 'acquired' || level === 'mastered') continue;
    const ratio = (values: readonly MetricSample[]) =>
      values.filter((s) => s.value >= 1).length / values.length;
    if (ratio(list.slice(-10)) - ratio(list.slice(0, 10)) < 0.1)
      out.push({ subjectKey: key, prescription: 'pluckMode' });
  }

  for (const [key, list] of windowSamples(samples, 'ladderBpm', from, now)) {
    if (!isLadderSubject(key) || list.length < STAGNATION_MIN_RUNS || !oldEnough(list)) continue;
    const current = list.at(-1)!.value;
    if (ladders.done(key, current)) continue;
    if (current - list[0]!.value < 5) out.push({ subjectKey: key, prescription: 'slowerTempo' });
  }

  return out.sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
}

// --- G voicing ---------------------------------------------------------------------------------------------

/**
 * SPEC v1.1 §6.4: two-finger G acquired (Stage 6+) → suggest the three-finger G; three-finger G acquired at
 * Stage 8+ → suggest the four-finger G. Returns the suggested voicing (equal to the current one = no card).
 */
export function suggestedGVoicing(
  state: Pick<ProgressionState, 'stage' | 'gVoicing'>,
  skills: ReadonlyMap<string, SkillState>,
): GVoicing {
  const acquired = (id: string) => {
    const level = chordLevel(skills.get(`chord:${id}`));
    return level === 'acquired' || level === 'mastered';
  };
  if (state.gVoicing === 'G-2f' && state.stage >= 6 && acquired('G-2f')) return 'G-3f';
  if (state.gVoicing === 'G-3f' && state.stage >= 8 && acquired('G-3f')) return 'G-4f';
  return state.gVoicing;
}

// --- strum mode ladder ---------------------------------------------------------------------------------------

/**
 * Two practice days in a row (among the days this subject was practised) with a pass at ≥ `bpm`
 * (SPEC v1.1 §6.10 / §7.1 "연속한 두 연습일", research 01:309).
 */
export function passedOnConsecutiveDays(skill: SkillState | undefined, bpm: number): boolean {
  const practiced = Object.keys(skill?.metrics.hitRate?.dayBest ?? {}).sort();
  const passes = skill?.metrics.passBpm?.dayBest ?? {};
  for (let i = 1; i < practiced.length; i++) {
    if ((passes[practiced[i - 1]!] ?? 0) >= bpm && (passes[practiced[i]!] ?? 0) >= bpm) return true;
  }
  return false;
}

export function modeGraduated(
  skills: ReadonlyMap<string, SkillState>,
  patternId: string,
  mode: (typeof STRUM_MODES)[number],
): boolean {
  return passedOnConsecutiveDays(skills.get(`strum:${patternId}:${mode}`), modeOpenBpm(patternId));
}

/** Open modes of a pattern, in order: mute is always open; each graduation opens the next (§6.10). */
export function openModes(
  skills: ReadonlyMap<string, SkillState>,
  patternId: string,
): (typeof STRUM_MODES)[number][] {
  const open: (typeof STRUM_MODES)[number][] = ['mute'];
  for (let i = 0; i < STRUM_MODES.length - 1; i++) {
    if (!modeGraduated(skills, patternId, STRUM_MODES[i]!)) break;
    open.push(STRUM_MODES[i + 1]!);
  }
  return open;
}

// --- graduation into the review queue -------------------------------------------------------------------------

export interface Graduation {
  subjectKey: string;
  kind: ReviewKind;
}

/**
 * Items that have graduated and belong in the review queue (SPEC v1.1 §7.5): acquired chords, pairs passed
 * (≥ 30 on two days), patterns whose progression mode graduated (§6.10), songs played through without a stop
 * in perform / hidden stage (repertoire, §11.10).
 */
export function graduatedItems(skills: ReadonlyMap<string, SkillState>): Graduation[] {
  const out: Graduation[] = [];
  for (const skill of skills.values()) {
    const key = skill.subjectKey;
    const parts = key.split(':');
    if (key.startsWith('chord:') && parts.length === 2) {
      const level = chordLevel(skill);
      if (level === 'acquired' || level === 'mastered') out.push({ subjectKey: key, kind: 'chord' });
    } else if (key.startsWith('pair:') && parts.length === 2) {
      if (daysReaching(skill, PAIR_METRIC, PAIR_PASS_CPM) >= PAIR_PASS_DAYS)
        out.push({ subjectKey: key, kind: 'pair' });
    } else if (key.startsWith('strum:') && parts.length === 3 && parts[2] === 'progression') {
      if (passedOnConsecutiveDays(skill, modeOpenBpm(parts[1]!)))
        out.push({ subjectKey: `strum:${parts[1]}`, kind: 'pattern' });
    } else if (key.startsWith('song:') && parts.length === 2) {
      if ((skill.metrics.repertoire?.best ?? 0) >= 1) out.push({ subjectKey: key, kind: 'song' });
    } else if (key.startsWith('scale:') && parts.length === 3 && /^s\d$/.test(parts[2]!)) {
      // A graduated scale step (SPEC v1.1 §11.13, §7.5): four flawless cycles in a row at ≥ 80 BPM.
      if ((skill.metrics.streakBpm?.best ?? 0) >= SCALE_GRADUATION_BPM)
        out.push({ subjectKey: key, kind: 'scale' });
    } else if (key.startsWith('riff:') && parts.length === 2) {
      // A riff passed at its goal tempo (its own tempo + 20, §11.19).
      const riff = RIFFS.find((r) => r.id === parts[1]);
      if (riff && (skill.metrics.passBpm?.best ?? 0) >= riff.bpm + RIFF_TARGET_EXTRA_BPM)
        out.push({ subjectKey: key, kind: 'riff' });
    }
  }
  return out.sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
}

/** E3 pair graduation (SPEC v1.1 §11.11): a pass on two different days. */
export function pfcGraduated(skills: ReadonlyMap<string, SkillState>, pair: string): boolean {
  const skill = skills.get(`pfc:${pair}`);
  return skill !== undefined && daysReaching(skill, 'pass', 1) >= PFC_GRADUATION_DAYS;
}
