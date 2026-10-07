/**
 * Live single-take selection (mirrors src/dsp/take.ts selectTakeEvent, used by the benchmarks): after the app
 * arms a take ("pluck string n", "strum the chord"), the first judged onset is the take; another onset within
 * 400 ms makes it ambiguous (MULTIPLE_ONSETS); nothing at all for a while triggers the energy fallback.
 * Coarse worklet onsets arrive ~0.4 s before the judged event of the same strum, so they decide ambiguity.
 */
import { TAKE_SPAN_MS } from '../dsp/take';
import type { JudgedEvent } from './types';

/** Coarse onsets are frame centres; refinement moves the judged onset up to ~45 ms earlier. */
const SAME_EVENT_S = 0.06;
/** Events slightly before arming still belong to the take (UI latency). */
const ARM_TOLERANCE_S = 0.05;
/** An onset that has not produced a judged take after this long (dropped/ignored segment) no longer blocks the fallback. */
const ONSET_SETTLE_S = 1;

export type TakeDecision = 'ignore' | 'multiple' | 'take';

export class TakeTracker {
  private armedAt: number | null = null;
  private coarse: number[] = [];
  private lastCoarse: number | null = null;
  private fallbackRequested = false;

  constructor(private readonly now: () => number) {}

  get armed(): boolean {
    return this.armedAt !== null;
  }

  get armedTime(): number | null {
    return this.armedAt;
  }

  arm(): void {
    this.armedAt = this.now();
    this.coarse = [];
    this.lastCoarse = null;
    this.fallbackRequested = false;
  }

  disarm(): void {
    this.armedAt = null;
  }

  noteCoarse(time: number): void {
    if (this.armedAt === null || time < this.armedAt - ARM_TOLERANCE_S) return;
    this.coarse.push(time);
    this.lastCoarse = time;
  }

  decide(event: JudgedEvent): TakeDecision {
    if (this.armedAt === null || event.time < this.armedAt - ARM_TOLERANCE_S) return 'ignore';
    const span = TAKE_SPAN_MS / 1000;
    const another = this.coarse.some((t) => t > event.time + SAME_EVENT_S && t <= event.time + span);
    return another ? 'multiple' : 'take';
  }

  /**
   * True once per arming when no take came out of `seconds` after arming: either nothing was heard, or the
   * onsets heard ≥ 1 s ago never produced a judged take. Time to try the energy fallback.
   */
  shouldFallback(seconds: number): boolean {
    if (this.armedAt === null || this.fallbackRequested) return false;
    const now = this.now();
    if (now - this.armedAt < seconds) return false;
    if (this.lastCoarse !== null && now - this.lastCoarse < ONSET_SETTLE_S) return false;
    this.fallbackRequested = true;
    return true;
  }
}
