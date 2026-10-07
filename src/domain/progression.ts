/**
 * Progression engine (SPEC §7.4): evaluates data-defined unlock rules, conditional promotion,
 * plateau (stagnation) detection and graduation into the review queue. Pure.
 */
import type { StageDef, UnlockRule } from '../content/schemas';
import { classOfVoicing } from '../content/voicings';
import { pairKey, pairsAmong, parsePairId } from './pairs';
import { DAY_MS, type ProgressionState, type ReviewKind, type SkillState } from './records';
import { chordLevel, daysReaching, median } from './skills';

export interface RuleContext {
  stage: number;
  curriculum: readonly StageDef[];
  skills: ReadonlyMap<string, SkillState>;
  sessionsInStage: number;
  examPassed: boolean;
  now: number;
}

export interface RuleEvaluation {
  rule: UnlockRule;
  met: boolean;
  /** 0..1 progress for the checklist UI. */
  progress: number;
  /** Subjects still missing (e.g. pair ids or chord classes). */
  missing: string[];
}

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

export function unlockedPairIds(curriculum: readonly StageDef[], stage: number): string[] {
  return pairsAmong(unlockedChordClasses(curriculum, stage));
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
        return daysReaching(ctx.skills.get(pairKey(a, b)), 'cpm', rule.value) < rule.days;
      });
      return {
        rule,
        met: missing.length === 0,
        progress: pairs.length ? 1 - missing.length / pairs.length : 1,
        missing,
      };
    }
    case 'recallUnlocked': {
      const classes = unlockedChordClasses(ctx.curriculum, ctx.stage);
      const missing = classes.filter((c) => (ctx.skills.get(`recall:${c}`)?.metrics.pass?.best ?? 0) < 1);
      return {
        rule,
        met: missing.length === 0,
        progress: classes.length ? 1 - missing.length / classes.length : 1,
        missing,
      };
    }
    case 'sessionsInStageAtLeast': {
      const met = ctx.sessionsInStage >= rule.count;
      return {
        rule,
        met,
        progress: Math.min(1, ctx.sessionsInStage / rule.count),
        missing: met ? [] : ['sessions'],
      };
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

const PLATEAU_WINDOW_DAYS = 21;
const PLATEAU_MIN_GAIN = 2;

/**
 * "3주 동안 중앙값이 +2 미만으로만 오름" (SPEC §7.4): the pair has been practiced for at least 21 days and
 * the median of its last 3 sessions is less than 2 changes/min above the median of its first 3 sessions
 * inside the window start. Uses per-day bests so one long day does not dominate.
 */
export function isPairPlateaued(skill: SkillState | undefined, now: number): boolean {
  const summary = skill?.metrics.cpm;
  if (!summary) return false;
  if (now - summary.firstAt < PLATEAU_WINDOW_DAYS * DAY_MS) return false;
  const days = Object.keys(summary.dayBest).sort();
  if (days.length < 4) return false;
  const values = days.map((d) => summary.dayBest[d]!);
  const baseline = median(values.slice(0, 3))!;
  const current = median(values.slice(-3))!;
  return current - baseline < PLATEAU_MIN_GAIN;
}

export interface StageEvaluation {
  stage: number;
  rules: RuleEvaluation[];
  allMet: boolean;
  /** Pair rules are the only unmet ones and every missing pair is plateaued for 3 weeks. */
  conditionalAvailable: boolean;
  /** Pair ids to drill (anchor/air) after a conditional promotion. */
  plateauedPairs: string[];
  progress: number;
}

export function evaluateStage(def: StageDef, ctx: RuleContext): StageEvaluation {
  const rules = def.unlockRules.map((rule) => evaluateRule(rule, ctx));
  const allMet = rules.length > 0 && rules.every((r) => r.met);
  const unmet = rules.filter((r) => !r.met);
  const pairOnly = unmet.length > 0 && unmet.every((r) => r.rule.kind === 'unlockedPairsAtLeast');
  const missingPairs = unmet.flatMap((r) => (r.rule.kind === 'unlockedPairsAtLeast' ? r.missing : []));
  const plateauedPairs = missingPairs.filter((id) => {
    const [a, b] = parsePairId(id);
    return isPairPlateaued(ctx.skills.get(pairKey(a, b)), ctx.now);
  });
  const conditionalAvailable =
    pairOnly && missingPairs.length > 0 && plateauedPairs.length === missingPairs.length;
  const progress = rules.length ? rules.reduce((sum, r) => sum + r.progress, 0) / rules.length : 0;
  return { stage: def.stage, rules, allMet, conditionalAvailable, plateauedPairs, progress };
}

export const LAST_PLAYABLE_STAGE = 7;

/** Moves to the next stage (or marks Beginner 1 complete after Stage 7). */
export function promote(
  state: ProgressionState,
  now: number,
  conditional: boolean,
  drills: readonly string[] = [],
): ProgressionState {
  const history = [
    ...state.history,
    { stage: state.stage, enteredAt: state.stageEnteredAt, leftAt: now, conditional },
  ];
  if (state.stage >= LAST_PLAYABLE_STAGE) {
    return { ...state, history, completedBeginner1: true };
  }
  return {
    ...state,
    stage: state.stage + 1,
    stageEnteredAt: now,
    sessionsInStage: 0,
    history,
    prescribedDrills: conditional ? [...drills] : [],
  };
}

const STAGNATION_DAYS = 14;

export interface Stagnation {
  subjectKey: string;
  metric: string;
  prescription: 'anchorDrill' | 'pluckMode' | 'slowerTempo';
}

/**
 * "2주 동안 핵심 지표 개선 없음" (SPEC §7.4): practiced both before and during the last 14 days, and the best
 * value of the last 14 days does not exceed the best before. Returns a prescription per stagnant subject.
 */
export function detectStagnation(skills: ReadonlyMap<string, SkillState>, now: number): Stagnation[] {
  const cutoff = now - STAGNATION_DAYS * DAY_MS;
  const watched: { prefix: string; metric: string; prescription: Stagnation['prescription'] }[] = [
    { prefix: 'pair:', metric: 'cpm', prescription: 'anchorDrill' },
    { prefix: 'chord:', metric: 'clean', prescription: 'pluckMode' },
    { prefix: 'strum:', metric: 'hitRate', prescription: 'slowerTempo' },
  ];
  const out: Stagnation[] = [];
  for (const skill of skills.values()) {
    const rule = watched.find(
      (w) => skill.subjectKey.startsWith(w.prefix) && skill.subjectKey.split(':').length === 2,
    );
    if (!rule) continue;
    const summary = skill.metrics[rule.metric];
    if (!summary || summary.firstAt >= cutoff || summary.lastAt < cutoff) continue;
    const before: number[] = [];
    const recent: number[] = [];
    for (const [day, value] of Object.entries(summary.dayBest)) {
      (new Date(`${day}T12:00:00`).getTime() < cutoff ? before : recent).push(value);
    }
    if (before.length === 0 || recent.length === 0) continue;
    if (Math.max(...recent) <= Math.max(...before)) {
      out.push({ subjectKey: skill.subjectKey, metric: rule.metric, prescription: rule.prescription });
    }
  }
  return out.sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
}

/** Switch from the two-finger G to the three-finger G once the two-finger G is acquired (Stage 6 "후반"). */
export function suggestedGVoicing(
  state: ProgressionState,
  skills: ReadonlyMap<string, SkillState>,
): 'G-2f' | 'G-3f' {
  if (state.gVoicing === 'G-3f') return 'G-3f';
  const level = chordLevel(skills.get('chord:G-2f'));
  return state.stage >= 6 && (level === 'acquired' || level === 'mastered') ? 'G-3f' : 'G-2f';
}

export interface Graduation {
  subjectKey: string;
  kind: ReviewKind;
}

/**
 * Items that have graduated and belong in the review queue (SPEC §7.5): acquired chords, pairs at ≥ 30 on
 * two days, patterns passed at their target tempo on two days, completed songs.
 */
export function graduatedItems(
  skills: ReadonlyMap<string, SkillState>,
  patternTargets: Readonly<Record<string, number>>,
): Graduation[] {
  const out: Graduation[] = [];
  for (const skill of skills.values()) {
    const key = skill.subjectKey;
    const parts = key.split(':');
    if (parts.length !== 2) continue;
    if (key.startsWith('chord:')) {
      const level = chordLevel(skill);
      if (level === 'acquired' || level === 'mastered') out.push({ subjectKey: key, kind: 'chord' });
    } else if (key.startsWith('pair:')) {
      if (daysReaching(skill, 'cpm', 30) >= 2) out.push({ subjectKey: key, kind: 'pair' });
    } else if (key.startsWith('strum:')) {
      const target = patternTargets[parts[1]!];
      if (target !== undefined && daysReaching(skill, 'passBpm', target) >= 2)
        out.push({ subjectKey: key, kind: 'pattern' });
    } else if (key.startsWith('song:')) {
      if ((skill.metrics.completed?.best ?? 0) >= 1) out.push({ subjectKey: key, kind: 'song' });
    }
  }
  return out.sort((a, b) => a.subjectKey.localeCompare(b.subjectKey));
}
