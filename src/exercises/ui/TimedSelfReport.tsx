import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import type { RunnerPhase } from '../types';
import { BigTimer } from './BigTimer';

/** Shared frame for timer + self-report exercises (E4, E7): start/stop, then an n/10 report. */
export function TimedSelfReport({
  phase,
  remainingMs,
  children,
  startLabel,
  stopLabel,
  reviewPrompt,
  value,
  confirmLabel,
  onCommand,
  testId,
}: {
  phase: RunnerPhase;
  remainingMs: number | null;
  children: ReactNode;
  startLabel: string;
  stopLabel: string;
  reviewPrompt: string;
  value: string;
  confirmLabel: string;
  onCommand: (cmd: 'toggle' | 'next' | 'inc' | 'dec') => void;
  testId: string;
}) {
  return (
    <div className="flex flex-col gap-4" data-testid={testId} data-phase={phase}>
      {children}
      {phase !== 'review' && <BigTimer remainingMs={remainingMs} />}
      {phase === 'ready' && (
        <Button large onClick={() => onCommand('toggle')}>
          {startLabel}
        </Button>
      )}
      {phase === 'running' && (
        <Button large variant="secondary" onClick={() => onCommand('next')}>
          {stopLabel}
        </Button>
      )}
      {phase === 'review' && (
        <div aria-live="polite">
          <p>{reviewPrompt}</p>
          <div className="mt-2 flex items-center gap-3">
            <Button large variant="secondary" onClick={() => onCommand('dec')} aria-label="−">
              −
            </Button>
            <span
              className="min-w-20 text-center text-4xl font-bold tabular-nums"
              data-testid={`${testId}-value`}
            >
              {value}
            </span>
            <Button large variant="secondary" onClick={() => onCommand('inc')} aria-label="+">
              +
            </Button>
            <Button large onClick={() => onCommand('next')}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
