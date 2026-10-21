/** The tempo of a metronome exercise, sized with the viewport like the timer (SPEC §12.2: 15–25 % for the key number). */
export function BigBpm({ bpm }: { bpm: number }) {
  return (
    <p
      className="font-black tabular-nums leading-none tracking-tight"
      data-core-number
      style={{ fontSize: 'clamp(2.5rem, 10vh, 5rem)' }}
    >
      {bpm}
      <span className="text-[0.35em] font-bold text-muted"> BPM</span>
    </p>
  );
}
