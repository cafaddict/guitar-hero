import { formatClock } from '../../audio/timer';
import { ko } from '../../i18n/ko';

/**
 * Remaining time, the key number of a timed run: 18 % of the viewport height (SPEC §12.2, UI SPEC UQ-3 wants
 * 15–25 %). The clamp only guards very short or very tall windows; the four reference screens get exactly 18vh.
 * Before the timer starts the runner has no remaining time yet: the planned length stands in, so every timed
 * practice opens on the same big number (D-094).
 */
export function BigTimer({ remainingMs, plannedMs }: { remainingMs: number | null; plannedMs?: number }) {
  const shownMs = remainingMs ?? plannedMs ?? null;
  if (shownMs === null) return null;
  return (
    <p
      className="font-bold tabular-nums leading-none tracking-tight"
      data-core-number
      style={{ fontSize: 'clamp(3rem, 18vh, 15rem)' }}
    >
      <span className="sr-only">{ko.exercises.common.remaining} </span>
      <span data-testid="timer-remaining">{formatClock(shownMs)}</span>
    </p>
  );
}
