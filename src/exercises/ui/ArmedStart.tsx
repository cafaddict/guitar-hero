import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { RunnerPhase } from '../types';

const waiting = (phase: RunnerPhase) => phase === 'armed' || phase === 'ready';

/** "Armed" (the first strum starts, SPEC §12.3) or "ready" (the button or Space starts) prompt. */
export function ArmedPrompt({ phase }: { phase: RunnerPhase }) {
  if (!waiting(phase)) return null;
  return (
    <p className="text-xl" data-testid="armed-start" data-phase={phase}>
      {phase === 'armed' ? ko.exercises.e5.armed : ko.exercises.e5.ready}
    </p>
  );
}

/** The start button of an armed or ready metronome exercise: the stage's next step (D-090). */
export function armedStartButton(phase: RunnerPhase, onStart: () => void) {
  if (!waiting(phase)) return undefined;
  return (
    <Button large onClick={onStart}>
      {ko.exercises.e5.start}
    </Button>
  );
}
