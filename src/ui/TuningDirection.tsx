/**
 * "조이세요 / 푸세요" with the cents number and a tuning-peg picture showing which way to turn it (SPEC v1.1 §9.3).
 * Without a known string (chromatic tuner) only the text and cents are shown.
 */
import { type HeadStyle, pegTurn, tuningAction } from '../domain/tuningGuide';
import { ko } from '../i18n/ko';

function PegArrow({ turn }: { turn: 'cw' | 'ccw' }) {
  // A peg button seen from the front with a curved arrow around it.
  const arc = turn === 'cw' ? 'M 30 8 A 22 22 0 1 1 8 30' : 'M 30 8 A 22 22 0 1 0 52 30';
  const head = turn === 'cw' ? 'M 8 30 l -5 -8 m 5 8 l 7 -5' : 'M 52 30 l 5 -8 m -5 8 l -7 -5';
  return (
    <svg
      viewBox="0 0 60 60"
      className="h-16 w-16 text-accent"
      aria-hidden="true"
      data-testid="peg-arrow"
      data-turn={turn}
    >
      <ellipse
        cx="30"
        cy="30"
        rx="9"
        ry="13"
        className="fill-surface-2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d={arc} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d={head} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function TuningDirection({
  cents,
  stringIdx,
  head,
}: {
  cents: number | null;
  stringIdx: number | null;
  head: HeadStyle;
}) {
  if (cents === null) return null;
  const action = tuningAction(cents);
  return (
    <div className="flex items-center gap-3" data-testid="tuning-direction" data-action={action}>
      {action !== 'inTune' && stringIdx !== null && <PegArrow turn={pegTurn(stringIdx, head, action)} />}
      <p className="text-lg">
        <span className="font-bold tabular-nums">{ko.common.cents(cents)}</span>
        {' · '}
        {ko.tuningGuide[action]}
        {action !== 'inTune' && stringIdx !== null && (
          <span className="block text-sm text-muted">
            {ko.tuningGuide.peg(pegTurn(stringIdx, head, action))}
          </span>
        )}
      </p>
    </div>
  );
}
