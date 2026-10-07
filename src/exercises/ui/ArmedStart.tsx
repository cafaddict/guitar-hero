import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import type { RunnerPhase } from '../types';

/** "Armed" (first strum starts, SPEC §12.3) or "ready" (button/Space starts) prompt for metronome exercises. */
export function ArmedStart({ phase, onStart }: { phase: RunnerPhase; onStart: () => void }) {
  if (phase !== 'armed' && phase !== 'ready') return null;
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="armed-start" data-phase={phase}>
      <p>{phase === 'armed' ? ko.exercises.e5.armed : ko.exercises.e5.ready}</p>
      <Button large onClick={onStart}>
        {ko.exercises.e5.start}
      </Button>
    </div>
  );
}
