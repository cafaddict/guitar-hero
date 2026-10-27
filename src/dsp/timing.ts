/**
 * Mode D — strum timing against the metronome grid (SPEC §10.8).
 *
 * User-facing timing error = strum time − (scheduled grid time + RTT). Strums are matched greedily to the
 * nearest expected slot inside a BPM-dependent window; strums in rest slots count as extra.
 */

export interface TimingSlot {
  /** Scheduled grid time (s, audio clock). */
  time: number;
  /** Whether the pattern expects a strum here ('-' rests do not). */
  expected: boolean;
}

export type SlotJudgement = 'hit' | 'miss' | 'extra' | 'empty';

export interface TimingAnalysis {
  judgements: SlotJudgement[];
  /** Offset (ms) for each hit slot, aligned with `judgements` (null when not a hit). */
  offsetsMs: (number | null)[];
  hits: number;
  misses: number;
  extras: number;
  /** Strums that matched no slot at all (outside every window). */
  unmatched: number;
  /** Slot index each strum was matched to (input order), or null (SPEC v1.1 §14.8 swing slot assignment). */
  strumSlots: (number | null)[];
  hitRate: number;
  meanOffsetMs: number | null;
  sdOffsetMs: number | null;
  /** Hit rate after removing a stable personal lead/lag (mean of recent runs). */
  hitRateCorrected: number;
  windowMs: number;
}

/**
 * Window (design value): below 80 BPM ±80 ms (D-100, was ±60), 80–100 BPM ±50 ms, 100+ BPM ±40 ms. Below 80 BPM
 * the closest slots (swing 2/3, 6/8 eighths) are ≥ 250 ms apart, so two windows never overlap.
 */
export function timingWindowMs(bpm: number): number {
  if (bpm < 80) return 80;
  if (bpm < 100) return 50;
  return 40;
}

function judge(
  slots: readonly TimingSlot[],
  strumTimes: readonly number[],
  rttS: number,
  windowS: number,
  shiftS: number,
) {
  const judgements: SlotJudgement[] = slots.map((s) => (s.expected ? 'miss' : 'empty'));
  const offsets: (number | null)[] = slots.map(() => null);
  const pairs: { slot: number; strum: number; dist: number }[] = [];
  strumTimes.forEach((t, strum) => {
    slots.forEach((slot, i) => {
      const dist = Math.abs(t - (slot.time + rttS + shiftS));
      if (dist <= windowS) pairs.push({ slot: i, strum, dist });
    });
  });
  pairs.sort((x, y) => x.dist - y.dist);
  const usedSlot = new Set<number>();
  const usedStrum = new Set<number>();
  const strumSlots: (number | null)[] = strumTimes.map(() => null);
  for (const p of pairs) {
    if (usedSlot.has(p.slot) || usedStrum.has(p.strum)) continue;
    usedSlot.add(p.slot);
    usedStrum.add(p.strum);
    strumSlots[p.strum] = p.slot;
    const slot = slots[p.slot]!;
    if (slot.expected) {
      judgements[p.slot] = 'hit';
      offsets[p.slot] = (strumTimes[p.strum]! - (slot.time + rttS)) * 1000;
    } else {
      judgements[p.slot] = 'extra';
    }
  }
  return { judgements, offsets, unmatched: strumTimes.length - usedStrum.size, strumSlots };
}

export function analyzeTiming(
  slots: readonly TimingSlot[],
  strumTimes: readonly number[],
  rttS: number,
  bpm: number,
  personalOffsetMs: number | null = null,
): TimingAnalysis {
  const windowMs = timingWindowMs(bpm);
  const base = judge(slots, strumTimes, rttS, windowMs / 1000, 0);
  const hitOffsets = base.offsets.filter((o): o is number => o !== null);
  const hits = base.judgements.filter((j) => j === 'hit').length;
  const misses = base.judgements.filter((j) => j === 'miss').length;
  const extras = base.judgements.filter((j) => j === 'extra').length + base.unmatched;
  const expected = slots.filter((s) => s.expected).length;
  const mean = hitOffsets.length ? hitOffsets.reduce((s, o) => s + o, 0) / hitOffsets.length : null;
  const sd =
    hitOffsets.length > 1 && mean !== null
      ? Math.sqrt(hitOffsets.reduce((s, o) => s + (o - mean) ** 2, 0) / (hitOffsets.length - 1))
      : null;
  const corrected =
    personalOffsetMs === null
      ? base
      : judge(slots, strumTimes, rttS, windowMs / 1000, personalOffsetMs / 1000);
  const correctedHits = corrected.judgements.filter((j) => j === 'hit').length;
  return {
    judgements: base.judgements,
    offsetsMs: base.offsets,
    hits,
    misses,
    extras,
    unmatched: base.unmatched,
    strumSlots: base.strumSlots,
    hitRate: expected ? hits / expected : 0,
    meanOffsetMs: mean,
    sdOffsetMs: sd,
    hitRateCorrected: expected ? correctedHits / expected : 0,
    windowMs,
  };
}

/** Personal lead/lag: mean offset of the most recent runs, only when at least 3 exist (SPEC §10.8). */
export function personalOffset(recentMeanOffsetsMs: readonly number[]): number | null {
  const recent = recentMeanOffsetsMs.slice(-5);
  if (recent.length < 3) return null;
  return recent.reduce((s, x) => s + x, 0) / recent.length;
}

/** Inter-onset-interval coefficient of variation (E8): sd(IOI)/mean(IOI). */
export function ioiCv(strumTimes: readonly number[]): number | null {
  return pooledIoiCv([strumTimes]);
}

/**
 * ioiCv over several stretches played apart (segments between pauses, D-085): the intervals are taken inside
 * each group only — the gap of a pause is not an interval — and pooled. Null with fewer than two intervals.
 */
export function pooledIoiCv(groups: readonly (readonly number[])[]): number | null {
  const iois: number[] = [];
  for (const times of groups) for (let i = 1; i < times.length; i++) iois.push(times[i]! - times[i - 1]!);
  if (iois.length < 2) return null;
  const mean = iois.reduce((s, x) => s + x, 0) / iois.length;
  const sd = Math.sqrt(iois.reduce((s, x) => s + (x - mean) ** 2, 0) / (iois.length - 1));
  return mean > 0 ? sd / mean : null;
}
