/**
 * Live per-bar timing feedback (D-077) for E5, E6 and E8. While a run plays, each bar is judged as soon as the
 * verdicts of its strums can have arrived (judged onsets come ~0.4 s after the strum), with the same
 * `analyzeTiming` the end-of-run score uses, applied to that bar alone. A strum only ever matches a slot inside
 * that slot's ±window and slots are more than two windows apart, so a bar's verdicts here are exactly the ones
 * the final analysis gives. View-only: nothing here is recorded.
 */
import { analyzeTiming, type SlotJudgement, type TimingSlot, timingWindowMs } from '../dsp/timing';

/** Judged onsets arrive ~0.4 s after the strum plus worker time (the same margin as GridRecorder.SETTLE_S). */
export const LIVE_LAG_S = 0.7;

export type LiveBarStatus = 'good' | 'off' | 'miss' | 'stop';

export interface LiveBar {
  bar: number;
  status: LiveBarStatus;
  expected: number;
  hits: number;
  misses: number;
  extras: number;
  /** Mean offset of the hits (ms, + = late); for a late/early beat 1 (E6) the nearest strum's offset. */
  offsetMs: number | null;
  /** Per slot of the bar, in order (E5 shows them on the pattern cells). */
  judgements: SlotJudgement[];
  /** E6: the chord of a changing bar sounded like this bar's chord ('right') or the previous one. */
  chord?: 'right' | 'wrong' | null;
}

export interface BarSlots {
  bar: number;
  slots: TimingSlot[];
}

/** Groups a run's slot grid into bars of `perBar` slots. */
export function barsOf(slots: readonly TimingSlot[], perBar: number): BarSlots[] {
  const out: BarSlots[] = [];
  for (let i = 0; i < slots.length; i += perBar)
    out.push({ bar: out.length, slots: slots.slice(i, i + perBar) });
  return out;
}

/**
 * Strums (recording timeline) that belong to each bar: split at the midpoint between the last slot of one bar
 * and the first slot of the next (+ RTT), so every strum is counted in exactly one bar.
 */
export function barRegions(bars: readonly BarSlots[], rttS: number): { from: number; to: number }[] {
  return bars.map((b, i) => {
    const prev = bars[i - 1];
    const next = bars[i + 1];
    const first = b.slots[0]!.time;
    const last = b.slots[b.slots.length - 1]!.time;
    return {
      from: prev ? (prev.slots[prev.slots.length - 1]!.time + first) / 2 + rttS : Number.NEGATIVE_INFINITY,
      to: next ? (last + next.slots[0]!.time) / 2 + rttS : Number.POSITIVE_INFINITY,
    };
  });
}

/** The bar's status from its counts: every slot right → good; nothing played → stop; half or more missed → miss. */
function statusOf(
  expected: number,
  hits: number,
  misses: number,
  extras: number,
  strums: number,
): LiveBarStatus {
  if (strums === 0 && expected > 0) return 'stop';
  if (misses === 0 && extras === 0) return 'good';
  return expected > 0 && hits / expected < 0.5 ? 'miss' : 'off';
}

/** One bar judged on its own (E5, E8): the strums in its region against its slots. */
export function judgeBar(
  bar: BarSlots,
  region: { from: number; to: number },
  strums: readonly number[],
  rttS: number,
  bpm: number,
): LiveBar {
  const mine = strums.filter((t) => t >= region.from && t < region.to);
  const r = analyzeTiming(bar.slots, mine, rttS, bpm, null);
  const expected = bar.slots.filter((s) => s.expected).length;
  return {
    bar: bar.bar,
    status: statusOf(expected, r.hits, r.misses, r.extras, mine.length),
    expected,
    hits: r.hits,
    misses: r.misses,
    extras: r.extras,
    offsetMs: r.meanOffsetMs,
    judgements: r.judgements,
  };
}

/** When a bar's last slot verdict can have arrived (recording timeline). */
export function barReadyAt(bar: BarSlots, rttS: number, bpm: number, lagS = LIVE_LAG_S): number {
  return bar.slots[bar.slots.length - 1]!.time + rttS + timingWindowMs(bpm) / 1000 + lagS;
}

/**
 * Bars ready by `now`, judged (E5, E8). `known` holds the bars already judged; they are kept as they were.
 */
export function settleBars(
  bars: readonly BarSlots[],
  strums: readonly number[],
  rttS: number,
  bpm: number,
  now: number,
  known: readonly LiveBar[],
): LiveBar[] {
  if (known.length >= bars.length) return [...known];
  const regions = barRegions(bars, rttS);
  const out = [...known];
  for (let b = known.length; b < bars.length; b++) {
    const bar = bars[b]!;
    // Strums up to the region's end (half way to the next bar) count here too: wait until they can be heard.
    const to = regions[b]!.to;
    const ready = Math.max(barReadyAt(bar, rttS, bpm), Number.isFinite(to) ? to + LIVE_LAG_S : 0);
    if (now < ready) break;
    out.push(judgeBar(bar, regions[b]!, strums, rttS, bpm));
  }
  return out;
}

/**
 * E6 beat-1 bar (SPEC v1.1 §11.7): on time when a strum lands inside the window around beat 1; a strum elsewhere
 * in the bar = late/early ('off', with the nearest strum's offset); no strum at all = a stop. Beat 1 is known
 * ~1 s after the downbeat; "stop" only once the bar is over. `barStart` is the bar's own downbeat (bars after a
 * pause play on a new grid, D-085).
 */
export function judgeBeatOne(input: {
  bar: number;
  barStart: number;
  barS: number;
  strums: readonly number[];
  rttS: number;
  bpm: number;
  now: number;
  lagS?: number;
}): Omit<LiveBar, 'chord'> | null {
  const lag = input.lagS ?? LIVE_LAG_S;
  const windowS = timingWindowMs(input.bpm) / 1000;
  const beat1 = input.barStart + input.rttS;
  if (input.now < beat1 + windowS + lag) return null;
  const slot = { time: input.barStart, expected: true };
  // Same stop region as stoppedBars(): [bar start − window, next bar start − window), recording timeline.
  const from = beat1 - windowS;
  const to = beat1 + input.barS - windowS;
  const inBar = input.strums.filter((t) => t >= from && t < to);
  const near = inBar.filter((t) => Math.abs(t - beat1) <= windowS);
  const r = analyzeTiming([slot], near, input.rttS, input.bpm, null);
  const base = { bar: input.bar, expected: 1, extras: 0, judgements: r.judgements };
  if (r.hits === 1) return { ...base, status: 'good', hits: 1, misses: 0, offsetMs: r.meanOffsetMs };
  const heardSoFar = inBar.filter((t) => t <= input.now - lag);
  if (heardSoFar.length > 0) {
    const nearest = heardSoFar.reduce((a, b) => (Math.abs(b - beat1) < Math.abs(a - beat1) ? b : a));
    return { ...base, status: 'off', hits: 0, misses: 1, offsetMs: (nearest - beat1) * 1000 };
  }
  // Nothing yet: a stop only once the whole bar has passed.
  if (input.now < to + lag) return null;
  return { ...base, status: 'stop', hits: 0, misses: 1, offsetMs: null };
}
