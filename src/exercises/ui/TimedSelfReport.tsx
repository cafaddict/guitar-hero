import type { ReactNode } from 'react';
import { Button } from '../../ui/Button';
import type { RunnerPhase } from '../types';
import { BigTimer } from './BigTimer';
import { PracticeStage } from './PracticeStage';

/**
 * Shared stage of the timer + self-report exercises (E4, E7, E12): the drill on the left, the timer and
 * start / stop on the right, then an n/10 report (− value +, confirm).
 */
export function TimedSelfReport({
  phase,
  remainingMs,
  plannedMs,
  children,
  startLabel,
  stopLabel,
  reviewPrompt,
  value,
  confirmLabel,
  onCommand,
  testId,
  stepBack,
}: {
  phase: RunnerPhase;
  remainingMs: number | null;
  /** The run's length, shown before the timer starts. */
  plannedMs: number;
  /** The drill: what to play and how (the stage's figure). */
  children: ReactNode;
  startLabel: string;
  stopLabel: string;
  reviewPrompt: string;
  value: string;
  confirmLabel: string;
  onCommand: (cmd: 'toggle' | 'next' | 'inc' | 'dec') => void;
  testId: string;
  /** The touch twin of ← while the runner can take its last step back (D-096), beside the next step. */
  stepBack?: { label: string; onBack: () => void } | undefined;
}) {
  return (
    <PracticeStage
      data-testid={testId}
      data-phase={phase}
      figure={<div className="flex w-full flex-col gap-4">{children}</div>}
      primary={
        phase === 'ready' ? (
          <Button large onClick={() => onCommand('toggle')}>
            {startLabel}
          </Button>
        ) : phase === 'running' ? (
          <Button large variant="secondary" onClick={() => onCommand('next')}>
            {stopLabel}
          </Button>
        ) : phase === 'review' ? (
          <Button large onClick={() => onCommand('next')}>
            {confirmLabel}
          </Button>
        ) : undefined
      }
      secondary={
        stepBack && (
          <Button variant="secondary" onClick={stepBack.onBack} data-testid={`${testId}-step-back`}>
            {stepBack.label}
          </Button>
        )
      }
    >
      {phase !== 'review' && <BigTimer remainingMs={remainingMs} plannedMs={plannedMs} />}
      {phase === 'review' && (
        <div aria-live="polite" className="flex flex-col gap-3">
          <p className="text-xl">{reviewPrompt}</p>
          <div className="flex items-center gap-3">
            <Button
              large
              variant="secondary"
              className="min-w-16"
              onClick={() => onCommand('dec')}
              aria-label="−"
            >
              −
            </Button>
            <span
              className="min-w-24 text-center text-5xl font-bold tabular-nums"
              data-testid={`${testId}-value`}
            >
              {value}
            </span>
            <Button
              large
              variant="secondary"
              className="min-w-16"
              onClick={() => onCommand('inc')}
              aria-label="+"
            >
              +
            </Button>
          </div>
        </div>
      )}
    </PracticeStage>
  );
}
