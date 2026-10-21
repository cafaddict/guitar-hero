/**
 * The tempo of a metronome exercise, its key number: 16 % of the viewport height (UQ-3: 15–25 %), a little
 * under the timer so the two fit side by side. The unit is a fixed step of the type scale, not a fraction of
 * the number.
 */
export function BigBpm({ bpm }: { bpm: number }) {
  return (
    <p className="flex items-baseline gap-2 tabular-nums leading-none" data-core-number>
      <span className="font-black tracking-tight" style={{ fontSize: 'clamp(2.75rem, 16vh, 13rem)' }}>
        {bpm}
      </span>{' '}
      <span className="text-3xl font-bold text-muted">BPM</span>
    </p>
  );
}
