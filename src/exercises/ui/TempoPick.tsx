/**
 * −5 / +5 tempo steppers of a ladder exercise waiting to start (E5, E9, E10, E17, D-098); ↑/↓ do the same.
 * Large (≥ 64 px): tapped with a hand off the guitar. Space/Enter on a stepper focused with Tab stay its own
 * click, so picking with the keyboard never also starts the run (the pause button's pattern, D-085). A tap or
 * mouse click lets go of the focus, so the next Space starts the run as it does everywhere (SPEC §12.3).
 */
import type { MouseEvent } from 'react';
import { NATIVE_KEYS_ATTR } from '../../app/keys';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';

/** The step of one press, the ladder's (LADDER_STEP_BPM); the runners clamp the result. */
const STEP_BPM = 5;

export function TempoPick({ onPick }: { onPick: (cmd: 'inc' | 'dec') => void }) {
  const pick = (cmd: 'inc' | 'dec') => (event: MouseEvent<HTMLButtonElement>) => {
    // `detail` counts pointer clicks; a click from Space/Enter has none and keeps the focus.
    if (event.detail > 0) event.currentTarget.blur();
    onPick(cmd);
  };
  return (
    <fieldset aria-label={ko.exercises.common.tempoPick} className="flex gap-3" data-testid="tempo-pick">
      <Button
        large
        variant="secondary"
        className="min-w-16"
        aria-label={ko.metronome.decrease(STEP_BPM)}
        onClick={pick('dec')}
        data-testid="tempo-down"
        {...{ [NATIVE_KEYS_ATTR]: '' }}
      >
        −{STEP_BPM}
      </Button>
      <Button
        large
        variant="secondary"
        className="min-w-16"
        aria-label={ko.metronome.increase(STEP_BPM)}
        onClick={pick('inc')}
        data-testid="tempo-up"
        {...{ [NATIVE_KEYS_ATTR]: '' }}
      >
        +{STEP_BPM}
      </Button>
    </fieldset>
  );
}
