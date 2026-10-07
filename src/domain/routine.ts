/**
 * Today's routine generator (SPEC §7.3). Pure and deterministic: same input (incl. seed) → same output.
 *
 * Order: tuning → warm-up → chord precision (or stage review after a > 3-day gap) → one-minute changes
 * (30 s rest between) → rhythm → technique → review slot → practice song (always last).
 */
import { patternById } from '../content/patterns';
import type { PracticeSong, RoutineItem, StageDef } from '../content/schemas';
import { classOfVoicing, voicingForClass } from '../content/voicings';
import { pairDirKey, pairKey, parseDirected, parsePairId } from './pairs';
import { deriveSeed, mulberry32, shuffled } from './prng';
import { unlockedChordClasses, unlockedPairIds } from './progression';
import { DAY_MS, type ReviewItem, type SelfReport, type SkillState } from './records';
import {
  decideSessionLength,
  FINGERTIP_LOAD_TYPES,
  PAIN_REDUCTION_FACTOR,
  type PainAdvice,
  painAdvice,
} from './safety';
import { cleanRatio, recentMedian } from './skills';

export interface RoutineInput {
  stage: number;
  curriculum: readonly StageDef[];
  songs: readonly PracticeSong[];
  gVoicing: 'G-2f' | 'G-3f';
  skills: ReadonlyMap<string, SkillState>;
  now: number;
  lastPracticeAt: number | null;
  firstPracticeAt: number | null;
  lastSelfReport: SelfReport | null;
  sessionMinutes: number;
  confirmedOverCap: boolean;
  dueReviews: readonly ReviewItem[];
  /** One-minute-change runs already done today (daily cap 6). */
  changesDoneToday: number;
  /** Pair ids prescribed after a conditional promotion (anchor/air drills). */
  prescribedDrills: readonly string[];
  seed: number;
}

export type RoutineNotice =
  | { code: 'restDay' }
  | { code: 'painReduced' }
  | { code: 'gapReview'; days: number }
  | { code: 'capApplied'; minutes: number }
  | { code: 'changesCapReached' };

export interface RoutinePlan {
  kind: 'practice' | 'rest';
  items: RoutineItem[];
  totalSec: number;
  sessionMinutes: number;
  needsCapConfirmation: boolean;
  painAdvice: PainAdvice;
  notices: RoutineNotice[];
}

export const DAILY_CHANGE_RUN_CAP = 6;
export const GAP_REVIEW_DAYS = 3;
const SONG_MIN_SEC = 540;
const SONG_MAX_SEC = 600;
const REVIEW_SLOT_MAX_SEC = 180;
const CHANGE_RUN_SEC = 60;
const CHANGE_REST_SEC = 30;

interface Builder {
  items: RoutineItem[];
  seq: number;
}

function add(b: Builder, item: Omit<RoutineItem, 'id'>): void {
  b.seq += 1;
  b.items.push({ id: `r${String(b.seq).padStart(2, '0')}`, ...item });
}

function used(b: Builder): number {
  return b.items.reduce((sum, item) => sum + item.durationSec, 0);
}

interface PairCandidate {
  dir: string;
  includesNew: boolean;
  median: number;
  lastAt: number;
  tieBreak: number;
}

/** Rule 3: new chord first, then lowest recent-3 median, then least recently practiced. */
function rankPairs(input: RoutineInput, def: StageDef, newClasses: ReadonlySet<string>): string[] {
  const rng = mulberry32(deriveSeed(input.seed, 'pairs'));
  const directed = new Set<string>(def.focusPairs);
  for (const id of unlockedPairIds(input.curriculum, input.stage)) {
    const [a, b] = parsePairId(id);
    directed.add(`${a}>${b}`);
    directed.add(`${b}>${a}`);
  }
  const candidates: PairCandidate[] = [...directed].sort().map((dir) => {
    const [from, to] = parseDirected(dir);
    const skill = input.skills.get(pairDirKey(from, to));
    return {
      dir,
      includesNew: newClasses.has(from) || newClasses.has(to),
      median: recentMedian(skill, 'cpm', 3) ?? -1,
      lastAt: skill?.lastPracticedAt ?? 0,
      tieBreak: rng(),
    };
  });
  candidates.sort(
    (x, y) =>
      Number(y.includesNew) - Number(x.includesNew) ||
      x.median - y.median ||
      x.lastAt - y.lastAt ||
      x.tieBreak - y.tieBreak,
  );
  return candidates.map((c) => c.dir);
}

function chordClassesByWeakness(input: RoutineInput, classes: readonly string[]): string[] {
  const scored = classes.map((cls) => {
    const id = voicingForClass(cls, input.gVoicing);
    return { cls, ratio: cleanRatio(input.skills.get(`chord:${id}`)) ?? -1 };
  });
  return scored.sort((a, b) => a.ratio - b.ratio || a.cls.localeCompare(b.cls)).map((s) => s.cls);
}

function chordItem(
  input: RoutineInput,
  cls: string,
  durationSec: number,
  block: RoutineItem['block'],
): Omit<RoutineItem, 'id'> {
  const voicingId = voicingForClass(cls, input.gVoicing);
  return {
    exerciseType: 'E1',
    params: { voicingId, mode: 'pluck' },
    durationSec,
    block,
    subjectKey: `chord:${voicingId}`,
  };
}

function changeItem(dir: string, block: RoutineItem['block']): Omit<RoutineItem, 'id'> {
  const [from, to] = parseDirected(dir);
  return {
    exerciseType: 'E2',
    params: { direction: dir, pair: pairKey(from, to).slice('pair:'.length) },
    durationSec: CHANGE_RUN_SEC,
    block,
    subjectKey: pairDirKey(from, to),
  };
}

function restItem(): Omit<RoutineItem, 'id'> {
  return { exerciseType: 'REST', params: {}, durationSec: CHANGE_REST_SEC, block: 'rest' };
}

function rhythmItem(
  def: StageDef,
  input: RoutineInput,
  durationSec: number,
  block: RoutineItem['block'],
): Omit<RoutineItem, 'id'> {
  const rng = mulberry32(deriveSeed(input.seed, `rhythm:${def.stage}`));
  const choice = def.rhythm[Math.floor(rng() * def.rhythm.length)] ?? {
    patternId: 'P0',
    mode: 'mute' as const,
  };
  const pattern = patternById(choice.patternId);
  const best = input.skills.get(`strum:${pattern.id}:${choice.mode}`)?.metrics.passBpm?.best;
  const bpm = Math.min(pattern.targetBpm ?? 120, best !== undefined ? best + 5 : 60);
  return {
    exerciseType: 'E5',
    params: { patternId: pattern.id, mode: choice.mode, bpm, bars: 8 },
    durationSec,
    block,
    subjectKey: `strum:${pattern.id}`,
  };
}

function reviewItems(input: RoutineInput): Omit<RoutineItem, 'id'>[] {
  const out: Omit<RoutineItem, 'id'>[] = [];
  let total = 0;
  for (const review of input.dueReviews) {
    const [kind, rest] = [review.kind, review.subjectKey.slice(review.subjectKey.indexOf(':') + 1)];
    let item: Omit<RoutineItem, 'id'>;
    if (kind === 'chord') {
      item = {
        exerciseType: 'E1',
        params: { voicingId: rest, mode: 'pluck' },
        durationSec: 60,
        block: 'review',
        subjectKey: review.subjectKey,
      };
    } else if (kind === 'pair') {
      const [a, b] = parsePairId(rest);
      item = { ...changeItem(`${a}>${b}`, 'review'), subjectKey: review.subjectKey };
    } else if (kind === 'pattern') {
      const pattern = patternById(rest);
      item = {
        exerciseType: 'E5',
        params: { patternId: pattern.id, mode: 'single', bpm: pattern.targetBpm ?? 80, bars: 8 },
        durationSec: 60,
        block: 'review',
        subjectKey: review.subjectKey,
      };
    } else {
      item = {
        exerciseType: 'S',
        params: { songId: rest, mode: 'perform', chartHidden: true },
        durationSec: 180,
        block: 'review',
        subjectKey: review.subjectKey,
      };
    }
    if (total + item.durationSec > REVIEW_SLOT_MAX_SEC) break;
    out.push({ ...item, note: 'review' });
    total += item.durationSec;
  }
  return out;
}

function pickSong(input: RoutineInput, stage: number): PracticeSong | undefined {
  const available = input.songs.filter((s) => s.stage <= stage);
  if (available.length === 0) return undefined;
  const current = available.filter((s) => s.stage === Math.max(...available.map((x) => x.stage)));
  const rng = mulberry32(deriveSeed(input.seed, `song:${Math.floor(input.now / DAY_MS)}`));
  return shuffled(rng, current)[0];
}

/** Rule 4: never two consecutive items with the same exercise + subject. Swaps a later item in to fix collisions. */
export function interleave(items: RoutineItem[]): RoutineItem[] {
  const out = [...items];
  const same = (a: RoutineItem | undefined, b: RoutineItem | undefined) =>
    !!a && !!b && a.exerciseType === b.exerciseType && (a.subjectKey ?? '') === (b.subjectKey ?? '');
  const clashesAt = (list: RoutineItem[], k: number) =>
    same(list[k - 1], list[k]) || same(list[k], list[k + 1]);
  for (let i = 1; i < out.length; i++) {
    if (!same(out[i - 1], out[i])) continue;
    for (let j = i + 1; j < out.length; j++) {
      const trial = [...out];
      [trial[i], trial[j]] = [trial[j]!, trial[i]!];
      if (!clashesAt(trial, i) && !clashesAt(trial, j)) {
        out.splice(0, out.length, ...trial);
        break;
      }
    }
  }
  return out;
}

function stageZeroPlan(b: Builder): void {
  add(b, { exerciseType: 'E0', params: {}, durationSec: 120, block: 'tuning', subjectKey: 'tuning:session' });
  add(b, {
    exerciseType: 'E5',
    params: { patternId: 'P0', mode: 'mute', bpm: 60, bars: 4 },
    durationSec: 60,
    block: 'warmup',
    subjectKey: 'strum:P0',
  });
  add(b, {
    exerciseType: 'Q1',
    params: { questions: 10 },
    durationSec: 300,
    block: 'technique',
    subjectKey: 'quiz:diagram',
  });
  add(b, {
    exerciseType: 'E5',
    params: { patternId: 'P0', mode: 'mute', bpm: 60, bars: 8 },
    durationSec: 300,
    block: 'rhythm',
    subjectKey: 'strum:P0',
  });
  add(b, {
    exerciseType: 'E0',
    params: { drill: true },
    durationSec: 180,
    block: 'technique',
    subjectKey: 'tuning:session',
  });
  add(b, {
    exerciseType: 'Q1',
    params: { questions: 10 },
    durationSec: 240,
    block: 'technique',
    subjectKey: 'quiz:diagram',
  });
}

export function generateRoutine(input: RoutineInput): RoutinePlan {
  const advice = painAdvice(input.lastSelfReport);
  const length = decideSessionLength(
    input.sessionMinutes,
    input.firstPracticeAt,
    input.now,
    input.confirmedOverCap,
  );
  const notices: RoutineNotice[] = [];
  if (length.capped) notices.push({ code: 'capApplied', minutes: length.minutes });
  if (advice === 'restDay') {
    return {
      kind: 'rest',
      items: [],
      totalSec: 0,
      sessionMinutes: length.minutes,
      needsCapConfirmation: false,
      painAdvice: advice,
      notices: [{ code: 'restDay' }],
    };
  }

  const def = input.curriculum.find((s) => s.stage === input.stage);
  if (!def) throw new Error(`no stage ${input.stage}`);
  const budget = length.minutes * 60;
  const b: Builder = { items: [], seq: 0 };

  if (input.stage === 0) {
    stageZeroPlan(b);
  } else {
    const newClasses = new Set(def.newChords.map(classOfVoicing));
    const unlocked = unlockedChordClasses(input.curriculum, input.stage);
    const gapDays =
      input.lastPracticeAt === null ? 0 : Math.floor((input.now - input.lastPracticeAt) / DAY_MS);
    let changeRuns = Math.max(0, DAILY_CHANGE_RUN_CAP - input.changesDoneToday);
    if (changeRuns === 0) notices.push({ code: 'changesCapReached' });

    // 1–2. Tuning and warm-up (E7 stretch from Stage 4, light muted strumming before).
    add(b, {
      exerciseType: 'E0',
      params: {},
      durationSec: 60,
      block: 'tuning',
      subjectKey: 'tuning:session',
    });
    if (input.stage >= 4) {
      add(b, { exerciseType: 'E7', params: {}, durationSec: 90, block: 'warmup', subjectKey: 'stretch' });
    } else {
      add(b, {
        exerciseType: 'E5',
        params: { patternId: 'P0', mode: 'mute', bpm: 60, bars: 4 },
        durationSec: 60,
        block: 'warmup',
        subjectKey: 'strum:P0',
      });
    }

    // Rule 5: more than 3 days off → the first block becomes a review of the previous stage.
    if (gapDays > GAP_REVIEW_DAYS && input.stage >= 1) {
      notices.push({ code: 'gapReview', days: gapDays });
      const prev = input.curriculum.find((s) => s.stage === input.stage - 1);
      const prevClasses =
        prev && prev.newChords.length > 0 ? prev.newChords.map(classOfVoicing) : unlocked.slice(0, 1);
      add(b, chordItem(input, prevClasses[0]!, 90, 'stageReview'));
      const prevPair = prev?.focusPairs[0];
      if (prevPair && changeRuns > 0) {
        add(b, changeItem(prevPair, 'stageReview'));
        changeRuns -= 1;
      } else {
        add(b, chordItem(input, prevClasses[1] ?? unlocked[1] ?? prevClasses[0]!, 60, 'stageReview'));
      }
    } else {
      // 3. Chord precision: new chord 1–2 min + weakest chord 1 min.
      const weakest = chordClassesByWeakness(input, unlocked);
      const focus = [...newClasses][0] ?? weakest[0]!;
      add(b, chordItem(input, focus, 90, 'chord'));
      const second = weakest.find((c) => c !== focus);
      if (second) add(b, chordItem(input, second, 60, 'chord'));
    }

    // 4. One-minute changes: 2 runs (third added below if time allows), 30 s rest between.
    const ranked = rankPairs(input, def, newClasses);
    const firstRuns = Math.min(2, changeRuns, ranked.length);
    for (let i = 0; i < firstRuns; i++) {
      if (i > 0) add(b, restItem());
      add(b, changeItem(ranked[i]!, 'changes'));
    }
    changeRuns -= firstRuns;

    // 5. Rhythm 2 min.
    add(b, rhythmItem(def, input, 120, 'rhythm'));

    // Optional blocks while the song keeps its 9 minutes: review slot, technique, third change run.
    const fits = (sec: number) => used(b) + sec + SONG_MIN_SEC <= budget;
    for (const review of reviewItems(input)) if (fits(review.durationSec)) add(b, review);
    const drillPair = input.prescribedDrills[0];
    const technique = drillPair
      ? { type: 'E4', params: { pair: drillPair } }
      : def.technique.length > 0
        ? def.technique[
            Math.floor(
              mulberry32(deriveSeed(input.seed, `tech:${Math.floor(input.now / DAY_MS)}`))() *
                def.technique.length,
            )
          ]
        : undefined;
    if (technique && fits(60)) {
      const subject =
        technique.type === 'E4'
          ? `pair:${String(technique.params.pair)}`
          : technique.type === 'E8'
            ? `altpick:${String(technique.params.stringIdx ?? 3)}`
            : technique.type;
      add(b, {
        exerciseType: technique.type,
        params: { ...technique.params },
        durationSec: 60,
        block: 'technique',
        subjectKey: subject,
      });
    }
    if (changeRuns > 0 && ranked.length > firstRuns && fits(CHANGE_REST_SEC + CHANGE_RUN_SEC)) {
      add(b, restItem());
      add(b, changeItem(ranked[firstRuns]!, 'changes'));
    }

    // 7. Pain ≥ 5 → halve fingertip-load items.
    if (advice === 'reduceFingertipLoad') {
      notices.push({ code: 'painReduced' });
      for (const item of b.items) {
        if (FINGERTIP_LOAD_TYPES.has(item.exerciseType))
          item.durationSec = Math.max(30, Math.round((item.durationSec * PAIN_REDUCTION_FACTOR) / 15) * 15);
      }
    }

    // 6–7. Practice song, always last: 9–10 minutes.
    const song = pickSong(input, input.stage);
    if (song) {
      const songSec = Math.max(SONG_MIN_SEC, Math.min(SONG_MAX_SEC, budget - used(b)));
      add(b, {
        exerciseType: 'S',
        params: { songId: song.id, mode: 'learn', chartHidden: false, bpm: song.bpmDefault },
        durationSec: songSec,
        block: 'song',
        subjectKey: `song:${song.id}`,
      });
    }
  }

  const song = b.items.at(-1)?.block === 'song' ? b.items.pop() : undefined;
  const items = interleave(b.items);
  if (song) items.push(song);
  return {
    kind: 'practice',
    items,
    totalSec: items.reduce((sum, item) => sum + item.durationSec, 0),
    sessionMinutes: length.minutes,
    needsCapConfirmation: length.needsConfirmation,
    painAdvice: advice,
    notices,
  };
}
