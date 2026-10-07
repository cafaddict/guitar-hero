import { formatClock } from '../../audio/timer';
import { ko } from '../../i18n/ko';

/** Remaining time at 15–25% of the viewport height (SPEC §12.2). */
export function BigTimer({ remainingMs }: { remainingMs: number | null }) {
  if (remainingMs === null) return null;
  return (
    <p
      className="text-center font-bold tabular-nums leading-none"
      style={{ fontSize: 'clamp(3rem, 18vh, 10rem)' }}
    >
      <span className="sr-only">{ko.exercises.common.remaining} </span>
      <span data-testid="timer-remaining">{formatClock(remainingMs)}</span>
    </p>
  );
}
