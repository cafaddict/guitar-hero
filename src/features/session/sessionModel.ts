/**
 * Session runner model (SPEC §12.1 "세션 러너", §7.3-8). Pure: walks the routine items in order, keeps the
 * practice time as clock differences (pauses excluded), raises the break reminder after every 30 continuous
 * minutes, and supports skip / previous / pause. The exercise runs themselves are hosted elsewhere.
 */
import type { RoutineItem } from '../../content/schemas';
import type { KeyAction } from '../../data/settings';
import { BREAK_AFTER_MS } from '../../domain/safety';

export interface SessionState {
  index: number;
  /** Item ids that ended (attempt stored, rest finished, or nothing to record). */
  done: string[];
  skipped: string[];
  /** Ids of items whose run produced a stored Attempt. */
  recorded: string[];
  paused: boolean;
  /** Clock value (ms) when the current un-paused stretch started, or null while paused. */
  runningSince: number | null;
  /** Practice time accumulated before `runningSince`. */
  practiceMs: number;
  /** Practice time when the break reminder was last shown (multiples of 30 min). */
  breakShownAtMs: number;
  itemStartedAtMs: number;
}

export function startSession(now: number): SessionState {
  return {
    index: 0,
    done: [],
    skipped: [],
    recorded: [],
    paused: false,
    runningSince: now,
    practiceMs: 0,
    breakShownAtMs: 0,
    itemStartedAtMs: 0,
  };
}

export function practiceMs(state: SessionState, now: number): number {
  return state.practiceMs + (state.runningSince === null ? 0 : now - state.runningSince);
}

export function pause(state: SessionState, now: number): SessionState {
  if (state.paused) return state;
  return { ...state, paused: true, practiceMs: practiceMs(state, now), runningSince: null };
}

export function resume(state: SessionState, now: number): SessionState {
  if (!state.paused) return state;
  return { ...state, paused: false, runningSince: now };
}

function moveTo(state: SessionState, index: number, now: number): SessionState {
  return { ...state, index, itemStartedAtMs: practiceMs(state, now) };
}

/** An Attempt was stored for this item — counted as soon as it is saved, whichever way the user leaves it. */
export function markRecorded(state: SessionState, itemId: string): SessionState {
  return state.recorded.includes(itemId) ? state : { ...state, recorded: [...state.recorded, itemId] };
}

/** The current item ended (run finished, rest over): move to the next one. */
export function completeItem(state: SessionState, items: readonly RoutineItem[], now: number): SessionState {
  const item = items[state.index];
  if (!item) return state;
  const done = state.done.includes(item.id) ? state.done : [...state.done, item.id];
  return moveTo({ ...state, done }, state.index + 1, now);
}

export function skipItem(state: SessionState, items: readonly RoutineItem[], now: number): SessionState {
  const item = items[state.index];
  if (!item) return state;
  return moveTo({ ...state, skipped: [...state.skipped, item.id] }, state.index + 1, now);
}

export function previousItem(state: SessionState, now: number): SessionState {
  return state.index === 0 ? state : moveTo(state, state.index - 1, now);
}

export function isFinished(state: SessionState, items: readonly RoutineItem[]): boolean {
  return state.index >= items.length;
}

/** Remaining planned seconds of the current item (its soft budget; never forced). */
export function itemRemainingSec(state: SessionState, items: readonly RoutineItem[], now: number): number {
  const item = items[state.index];
  if (!item) return 0;
  return Math.max(0, item.durationSec - (practiceMs(state, now) - state.itemStartedAtMs) / 1000);
}

/** Break reminder due (SPEC §7.3-8): once per 30 minutes of continuous practice. */
export function breakDue(state: SessionState, now: number): boolean {
  return practiceMs(state, now) - state.breakShownAtMs >= BREAK_AFTER_MS;
}

export function acknowledgeBreak(state: SessionState, now: number): SessionState {
  const elapsed = practiceMs(state, now);
  return { ...state, breakShownAtMs: elapsed - (elapsed % BREAK_AFTER_MS) };
}

export type SessionKeyCommand = 'advance' | 'previous' | 'resume';

/**
 * Keyboard / pedal between runs (§12.3), so a routine can be walked without touching the screen. While a run is
 * in progress its own keys apply instead; starting an item is the exercise host's toggle/next.
 */
export function sessionKeyCommand(
  action: KeyAction | null,
  view: { paused: boolean; isRest: boolean; runEnded: boolean; first: boolean },
): SessionKeyCommand | null {
  if (view.paused) return action === 'toggle' || action === 'next' ? 'resume' : null;
  if (action === 'prev') return view.first ? null : 'previous';
  if (action === 'next' || action === 'toggle') return view.isRest || view.runEnded ? 'advance' : null;
  return null;
}
