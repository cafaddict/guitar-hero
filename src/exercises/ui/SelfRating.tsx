import { Button } from '../../ui/Button';

type ManualCommand = 'manual1' | 'manual2' | 'manual3';

/**
 * The 1/2/3 self-rating answers (also keys 1/2/3) used when no microphone judged the run: one decision, so
 * the stage shows them together as its next step (D-090); the question goes in the panel.
 */
export function selfRatingButtons(
  labels: Record<ManualCommand, string>,
  onPick: (cmd: ManualCommand) => void,
) {
  return (['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
    <Button key={cmd} large variant="secondary" onClick={() => onPick(cmd)}>
      {k + 1} {labels[cmd]}
    </Button>
  ));
}
