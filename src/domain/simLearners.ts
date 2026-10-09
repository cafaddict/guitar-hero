/**
 * Virtual learners for the curriculum simulation (SPEC v1.1 §14.9-2): deterministic, numbers fixed by the SPEC.
 * Each model turns a routine item and its plugin params into a schema-valid exercise result.
 */
import type { RoutineItem } from '../content/schemas';
import { pairId } from './pairs';
import type { SelfReport } from './records';
import type { LearnerContext, LearnerModel } from './simulate';

type Params = Record<string, unknown>;

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback = 0) => (typeof v === 'number' ? v : fallback);

/** Counts runs per key and returns the 0-based index of this run. */
function nextRun(ctx: LearnerContext, key: string): number {
  const n = ctx.memory.get(key) ?? 0;
  ctx.memory.set(key, n + 1);
  return n;
}

export interface ImprovingOptions {
  /** A pair (undirected id) stuck at a fixed rate from its first run (the `plateau` model). */
  stuckPair?: { id: string; cpm: number; stage: number };
  /** Pain report every this many practice days (the `pain` model). */
  painEveryDays?: number;
  /** Tempo ladders never move (an adversarial model for the −10 BPM prescription, §7.4). */
  stuckLadders?: boolean;
}

/** A cycle-type run (E9·E10·E11·E17) with every cycle flawless. */
function flawlessCycles(count: number) {
  return Array.from({ length: count }, () => ({ flawless: true, uncertain: false, stops: 0, okRatio: 1 }));
}

function quizResult(questions: number, accuracy: number, reactionMs: number) {
  return { questions, correct: Math.round(accuracy * questions), meanReactionMs: reactionMs };
}

/** Q3/Q4 with knowledge cards (§7.5): due cards first, then the quiz's own cards in turn. */
function cardQuiz(p: Params, accuracy: number, reactionMs: number, cardOf: (k: number) => string) {
  const questions = num(p.questions, 10);
  const focus = Array.isArray(p.focus) ? (p.focus as string[]) : [];
  const correct = Math.round(accuracy * questions);
  return {
    ...quizResult(questions, accuracy, reactionMs),
    items: Array.from({ length: questions }, (_, k) => ({
      card: focus[k] ?? cardOf(k),
      correct: k < correct,
      reactionMs,
    })),
    ...(typeof p.scope === 'string' ? { scope: p.scope } : {}),
    ...(typeof p.kind === 'string' ? { kind: p.kind } : {}),
  };
}

/** `improving`: every number from SPEC v1.1 §14.9-2. */
export function improvingLearner(options: ImprovingOptions = {}, name = 'improving'): LearnerModel {
  return {
    name,
    acceptsSuggestions: true,
    selfReport(ctx: LearnerContext): SelfReport | null {
      if (options.painEveryDays && ctx.day % options.painEveryDays === 0)
        return { pain: 6, dangerFlags: [], difficulty: 3, note: '' };
      return { pain: 0, dangerFlags: [], difficulty: 3, note: '' };
    },
    result(item: RoutineItem, raw: unknown, ctx: LearnerContext) {
      const result = baseResult(item, raw, ctx);
      // Like the runners, a run slowed by a −10 BPM prescription carries the ladder tempo it must keep.
      const base = (raw as Params).ladderBase;
      const r =
        result !== null && typeof base === 'number' ? { ...(result as Params), ladderBase: base } : result;
      if (!options.stuckLadders || r === null) return r;
      const x = r as Params;
      if (item.exerciseType === 'E5')
        return { ...x, hitRate: 0.8, hitRateCorrected: 0.8, ladder: 'stay', passed: false };
      if (item.exerciseType === 'E6' || item.exerciseType === 'E8') return { ...x, passed: false };
      if (item.exerciseType === 'E17') return { ...x, ladder: 'stay' };
      return r;
    },
  };

  function baseResult(item: RoutineItem, raw: unknown, ctx: LearnerContext): unknown | null {
    const p = raw as Params;
    switch (item.exerciseType) {
      case 'E0':
        return {
          strings: Array.from({ length: 6 }, (_, idx) => ({ idx, cents: 1, inTune: true })),
          complete: true,
          durationMs: 60_000,
        };
      case 'E1': {
        const voicingId = str(p.voicingId);
        const ratio = Math.min(1, 0.3 + 0.1 * nextRun(ctx, `E1:${voicingId}`));
        const cleanCount = Math.round(ratio * 10);
        return {
          voicingId,
          mode: str(p.mode, 'pluck'),
          earFirst: false,
          attempts: Array.from({ length: 10 }, (_, k) => ({
            perString: [],
            clean: k < cleanCount,
            strumVerdict: null,
            selfAgreement: null,
          })),
          cleanRatio: cleanCount / 10,
        };
      }
      case 'E2': {
        const from = str(p.from);
        const to = str(p.to);
        const id = pairId(from, to);
        const run = nextRun(ctx, `E2:${id}`);
        const stuck = options.stuckPair;
        const cpm =
          stuck && stuck.id === id && ctx.stage >= stuck.stage ? stuck.cpm : Math.min(45, 24 + 3 * run);
        const durationMs = num(p.durationMs, 60_000);
        return {
          pair: id,
          direction: `${from}>${to}`,
          durationMs,
          countMode: 'auto',
          detectedChanges: Math.round((cpm * durationMs) / 60_000),
          correctedChanges: null,
          tapChanges: null,
          lowConfidenceEvents: 0,
          changeTimestampsMs: [],
        };
      }
      case 'E3': {
        // Precise fast changes: clean rate 0.6 first, +0.1 a run (to 1.0); changes = the pair's E2 rate (§14.9-2).
        const from = str(p.from);
        const to = str(p.to);
        const id = pairId(from, to);
        const cleanRate = Math.min(1, 0.6 + 0.1 * nextRun(ctx, `E3:${id}`));
        const cpm = Math.min(45, 24 + 3 * (ctx.memory.get(`E2:${id}`) ?? 0));
        const durationMs = num(p.durationMs, 60_000);
        const arrivals = Math.round((cpm * durationMs) / 60_000);
        return {
          pair: id,
          direction: `${from}>${to}`,
          durationMs,
          arrivals,
          cleanArrivals: Math.round(arrivals * cleanRate),
          source: 'mic',
        };
      }
      case 'E9':
        return {
          startFret: num(p.startFret, 5),
          bpm: num(p.bpm, 60),
          cycles: flawlessCycles(4),
          ladder: 'up',
          source: 'mic',
          hitRate: 1,
          okRatio: 1,
          ioiCv: 0.05,
        };
      case 'E10': {
        const step = num(p.step, 1);
        const bpm = num(p.bpm, 60);
        const hidden = p.tabHidden === true;
        return {
          scaleId: str(p.scaleId),
          step,
          bpm,
          tabHidden: hidden,
          hiddenThroughout: hidden,
          withBacking: p.withBacking === true,
          cycles: flawlessCycles(4),
          ladder: 'up',
          graduated: bpm >= 80,
          memorized: step === 1 && hidden && bpm >= 60,
          source: 'mic',
          // Like the runner, a review run says so (it does not move the scale's step or ladder).
          ...(p.review === true ? { review: true } : {}),
        };
      }
      case 'E11':
        return {
          pair: str(p.pair, '1-2'),
          bpm: num(p.bpm, 60),
          cycles: flawlessCycles(6),
          source: 'mic',
          pickedHitRate: 1,
          legatoBeta: { heard: 24, total: 24 },
          evenRating: 3,
          ladder: 'up',
          durationMs: item.durationSec * 1000,
        };
      case 'E12':
        return {
          completed: true,
          clarity: 3,
          pain: 0,
          durationMs: num(p.durationMs, item.durationSec * 1000),
        };
      case 'E4':
        return {
          pair: pairId(str(p.from), str(p.to)),
          kind: 'anchor',
          durationMs: num(p.durationMs, 60_000),
          selfReportSuccess: 8,
        };
      case 'E5':
        return {
          patternId: str(p.patternId),
          bpm: num(p.bpm, 60),
          bars: num(p.bars, 8),
          mode: str(p.mode, 'mute'),
          hits: 32,
          misses: 0,
          extras: 0,
          meanOffsetMs: 0,
          sdOffsetMs: 10,
          hitRate: 1,
          hitRateCorrected: 1,
          cuesHidden: p.cuesHidden === true,
          ladder: 'up',
          passed: true,
          source: 'mic',
        };
      case 'E6':
        return {
          progression: p.progression,
          patternId: str(p.patternId, 'P0'),
          bpm: num(p.bpm, 60),
          bars: num(p.bars, 16),
          barsInWindow: num(p.bars, 16),
          stops: 0,
          beat1DelayMsMean: 10,
          missingBarRatio: 0,
          passed: true,
          source: 'mic',
        };
      case 'E7':
        return { startFret: num(p.startFret, 5), durationMs: num(p.durationMs, 60_000), pain: 0 };
      case 'E8':
        return {
          stringIdx: num(p.stringIdx, 3),
          bpm: num(p.bpm, 60),
          bars: num(p.bars, 8),
          hitRate: 1,
          ioiCv: 0.05,
          passed: true,
          source: 'mic',
        };
      case 'E16':
        return {
          positions: (['behind', 'middle', 'onFret'] as const).map((pos) => ({
            pos,
            statuses: ['OK', 'OK'],
            clarity: 0.9,
            decayRatio: 0.5,
          })),
          source: 'mic',
        };
      case 'E17':
        return {
          riffId: str(p.riffId),
          bpm: num(p.bpm, 60),
          tabHidden: p.tabHidden === true,
          cycles: flawlessCycles(4),
          ladder: 'up',
          source: 'mic',
        };
      case 'K1':
        return {
          items: (p.items as string[]).map((id) => ({
            id,
            // "됐어요" at the item's third appearance (§14.9-2).
            status: nextRun(ctx, `K1:${id}`) >= 2 ? 'done' : 'notYet',
          })),
        };
      case 'Q1':
      case 'Q5':
        return quizResult(num(p.questions, 10), 0.95, 2000);
      case 'Q3':
        return cardQuiz(p, 0.95, 2000, (k) => `card:note:${k % 6}:0`);
      case 'Q4':
        return cardQuiz(p, 0.9, 2000, (k) => `card:ear:majmin:${k % 2 === 0 ? 'major' : 'minor'}`);
      case 'Q2': {
        const classes = p.chordClasses as string[];
        const count = Math.max(num(p.count, classes.length), classes.length);
        return {
          items: Array.from({ length: count }, (_, k) => {
            const chordClass = classes[k % classes.length]!;
            return { chordClass, voicingId: chordClass, correct: true, reactionMs: 2500, method: 'mic' };
          }),
        };
      }
      case 'S':
        return {
          songId: str(p.songId),
          mode: str(p.mode, 'learn'),
          chartHidden: p.chartHidden === true,
          bpm: num(p.bpm, 60),
          completed: true,
          stops: 0,
          memorized: p.chartHidden === true,
          beat1HitRate: 1,
        };
      default:
        return null;
    }
  }
}

/** `blank`: every run fails, scores zero, self reports "아직". */
export function blankLearner(): LearnerModel {
  const improving = improvingLearner({}, 'blank');
  return {
    name: 'blank',
    acceptsSuggestions: false,
    result(item, raw, ctx) {
      const p = raw as Params;
      const r = improving.result(item, raw, ctx) as Params | null;
      if (r === null) return null;
      switch (item.exerciseType) {
        case 'E0':
          return {
            ...r,
            complete: false,
            strings: (r.strings as Params[]).map((s) => ({ ...s, inTune: false })),
          };
        case 'E1':
          return {
            ...r,
            cleanRatio: 0,
            attempts: (r.attempts as Params[]).map((a) => ({ ...a, clean: false })),
          };
        case 'E2':
          return { ...r, detectedChanges: 0 };
        case 'E5':
          return {
            ...r,
            hits: 0,
            misses: 32,
            hitRate: 0,
            hitRateCorrected: 0,
            ladder: 'stay',
            passed: false,
          };
        case 'E6':
          return { ...r, barsInWindow: 0, stops: 4, missingBarRatio: 1, passed: false };
        case 'E8':
          return { ...r, hitRate: 0, passed: false };
        case 'E16':
          return {
            ...r,
            positions: (r.positions as Params[]).map((pos) => ({ ...pos, statuses: ['MUTED', 'MUTED'] })),
          };
        case 'E17':
        case 'E9':
          return {
            ...r,
            cycles: [{ flawless: false, uncertain: false, stops: 1, okRatio: 0 }],
            ladder: 'stay',
          };
        case 'E10':
          return {
            ...r,
            cycles: [{ flawless: false, uncertain: false, stops: 1, okRatio: 0 }],
            ladder: 'stay',
            graduated: false,
            memorized: false,
          };
        case 'E11':
          return {
            ...r,
            cycles: [{ flawless: false, uncertain: false, stops: 1, okRatio: 0 }],
            pickedHitRate: 0,
            evenRating: 1,
            ladder: 'stay',
          };
        case 'E3':
          return { ...r, cleanArrivals: 0 };
        case 'E12':
          return { ...r, completed: false, clarity: 1 };
        case 'K1':
          return { items: (p.items as string[]).map((id) => ({ id, status: 'notYet' })) };
        case 'Q1':
        case 'Q3':
        case 'Q4':
        case 'Q5':
          return { ...r, correct: 0 };
        case 'Q2':
          return {
            items: (r.items as Params[]).map((item) => ({ ...item, correct: false, reactionMs: null })),
          };
        case 'S':
          return { ...r, completed: false, stops: 3, memorized: false };
        default:
          return r;
      }
    },
  };
}
