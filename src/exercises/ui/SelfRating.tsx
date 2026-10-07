import { Button } from '../../ui/Button';

/** 1/2/3 self-rating buttons (also keys 1/2/3) used when no microphone judged the run. */
export function SelfRating({
  prompt,
  labels,
  onPick,
}: {
  prompt: string;
  labels: Record<'manual1' | 'manual2' | 'manual3', string>;
  onPick: (cmd: 'manual1' | 'manual2' | 'manual3') => void;
}) {
  return (
    <div>
      <p>{prompt}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['manual1', 'manual2', 'manual3'] as const).map((cmd, k) => (
          <Button key={cmd} large variant="secondary" onClick={() => onPick(cmd)}>
            {k + 1} {labels[cmd]}
          </Button>
        ))}
      </div>
    </div>
  );
}
