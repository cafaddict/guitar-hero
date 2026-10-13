/**
 * E11 hammer-on finger gym (SPEC v1.1 §11.16, 01:117 Finger Gym): from the 6th string, 5th fret. Each beat has two
 * eighths — finger a picked, finger b hammered on (no pick) — four beats per string, strings 6 → 1. A string is
 * a cycle. Picked notes are judged by §10.10 (hard); hammer-ons only by the legato beta ("참고(베타)").
 * After the run: "간격이 고르게 들렸나요" 1–3. Ladder: picked hit_rate ≥ 90 % and a rating of 3 → +5 BPM (to 80).
 * Daily: 5 minutes recommended, at most 10 (the session/library refuse more on the same day).
 */
import { z } from 'zod';
import { positionMidi } from '../../content/scales';
import {
  HAMMER_MAX_BPM,
  HAMMER_PAIRS,
  HAMMER_PICKED_HIT_RATE,
  type HammerResult,
} from '../../domain/exerciseResults';
import { type PlannedNote, SequenceRunner, type SequenceView } from '../sequence/runner';
import type { ExerciseContext, RunnerCommand } from '../types';

export const HAMMER_RECOMMENDED_MS = 5 * 60_000;
export const HAMMER_DAILY_CAP_MS = 10 * 60_000;
export const HAMMER_BASE_FRET = 5;
const BEATS_PER_STRING = 4;

export const e11ParamsSchema = z.object({
  pair: z.enum(HAMMER_PAIRS).default('1-2'),
  bpm: z.number().int().min(30).max(HAMMER_MAX_BPM).default(60),
  /** Minutes of E11 already played today (the daily cap, §11.16). */
  minutesToday: z.number().min(0).default(0),
});
export type E11Params = z.infer<typeof e11ParamsSchema>;

export interface E11View extends SequenceView {
  pair: (typeof HAMMER_PAIRS)[number];
  /** Hammer-ons heard by the legato beta so far (null without a microphone). */
  legato: { heard: number; total: number } | null;
  awaitingRating: boolean;
  /** Today's cap already reached: the run cannot start. */
  capped: boolean;
}

export function hammerLadder(pickedHitRate: number, rating: number | null): 'up' | 'stay' {
  return pickedHitRate >= HAMMER_PICKED_HIT_RATE && rating === 3 ? 'up' : 'stay';
}

export class HammerRunner extends SequenceRunner<HammerResult, E11View> {
  private rating: number | null = null;
  private startedMs: number | null = null;
  private endedMs: number | null = null;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E11Params,
  ) {
    super(ctx, params.bpm, false, 2);
  }

  /** Time left today before the daily cap (§11.16). */
  private get capLeftMs(): number {
    return HAMMER_DAILY_CAP_MS - this.params.minutesToday * 60_000;
  }

  private get capped(): boolean {
    return this.capLeftMs <= 0;
  }

  protected planCycle(k: number): PlannedNote[] {
    const string = 6 - (k % 6);
    const [a, b] = this.params.pair.split('-').map(Number) as [number, number];
    const picked = { string, fret: HAMMER_BASE_FRET + a - 1 };
    const hammered = { string, fret: HAMMER_BASE_FRET + b - 1 };
    return Array.from({ length: BEATS_PER_STRING }, () => [
      { ...picked, finger: a, midi: positionMidi(picked) },
      { ...hammered, finger: b, midi: positionMidi(hammered), legato: true },
    ]).flat();
  }

  private legatoCounts(): { heard: number; total: number } | null {
    if (this.source === 'self') return null;
    let heard = 0;
    let total = 0;
    for (const c of this.cycleRecords) {
      // Odd slots are the hammer-ons; faults list only what was not OK/HAMMER_OK.
      const slots = BEATS_PER_STRING * 2;
      for (let i = 1; i < slots; i += 2) {
        total++;
        if (!c.faults?.some((f) => f.index === i)) heard++;
      }
    }
    return { heard, total };
  }

  private pickedHitRate(): number | null {
    if (this.source === 'self') return null;
    let hit = 0;
    let total = 0;
    for (const c of this.cycleRecords) {
      for (let i = 0; i < BEATS_PER_STRING * 2; i += 2) {
        total++;
        if (!c.faults?.some((f) => f.index === i && f.status === 'MISSED')) hit++;
      }
    }
    return total ? hit / total : null;
  }

  protected view(): E11View {
    return {
      ...this.baseView(),
      pair: this.params.pair,
      legato: this.legatoCounts(),
      awaitingRating: this.phase === 'review' && !this.baseView().analyzing && this.rating === null,
      capped: this.capped,
    };
  }

  override command(cmd: RunnerCommand): void {
    if (this.capped && this.phase === 'ready' && cmd !== 'abort') return;
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next')) this.startedMs = this.ctx.clock.now();
    if (this.phase === 'review' && cmd === 'abort') {
      super.command(cmd);
      return;
    }
    if (this.phase === 'review' && !this.baseView().analyzing) {
      const rating = cmd === 'manual1' ? 1 : cmd === 'manual2' ? 2 : cmd === 'manual3' ? 3 : null;
      if (rating !== null) {
        this.rating = rating;
        this.setPhase('done');
      }
      return;
    }
    const before = this.phase;
    super.command(cmd);
    if ((before === 'running' || before === 'countIn') && this.phase !== before) {
      this.endedMs = this.ctx.clock.now();
      // Always ask for the evenness rating (also without a microphone, where the run ends straight away).
      if (this.phase === 'done' && cmd !== 'abort') this.setPhase('review');
    }
  }

  override tick(): void {
    const playing = this.phase === 'running' || this.phase === 'countIn';
    // The daily cap also ends a run in progress (to the evenness rating).
    if (playing && this.startedMs !== null && this.ctx.clock.now() - this.startedMs >= this.capLeftMs)
      this.command('toggle');
    const before = this.phase;
    super.tick();
    // The base runner ends the review when judging is done; E11 still waits for the rating.
    if (before === 'review' && this.phase === 'done' && this.rating === null) this.setPhase('review');
  }

  override hasResult(): boolean {
    return this.rating !== null || super.hasResult();
  }

  finish(): HammerResult {
    const picked = this.pickedHitRate();
    const ratio =
      picked ??
      (this.cycleRecords.length
        ? this.cycleRecords.filter((c) => c.flawless).length / this.cycleRecords.length
        : 0);
    return {
      pair: this.params.pair,
      bpm: this.params.bpm,
      cycles: [...this.cycleRecords],
      source: this.source,
      pickedHitRate: picked,
      legatoBeta: this.legatoCounts(),
      evenRating: this.rating,
      ladder: hammerLadder(ratio, this.rating),
      durationMs: Math.max(
        0,
        (this.endedMs ?? this.ctx.clock.now()) - (this.startedMs ?? this.ctx.clock.now()),
      ),
    };
  }
}
