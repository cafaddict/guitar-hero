/**
 * ±50 cents needle; the band shows the pass zone and the ticks mark −50 / 0 / +50, so the direction reads
 * without colour. A native <meter> carries the value for assistive tech.
 */
export function CentsNeedle({
  cents,
  passCents,
  label,
}: {
  cents: number | null;
  passCents: number;
  label: string;
}) {
  const clamped = cents === null ? 0 : Math.max(-50, Math.min(50, cents));
  const inZone = cents !== null && Math.abs(cents) <= passCents;
  return (
    <div className="relative">
      <meter className="sr-only" aria-label={label} min={-50} max={50} value={Math.round(clamped)} />
      <div aria-hidden="true" className="relative h-12 w-full rounded-xl bg-surface-2">
        {/* The pass zone: a soft band with solid edges, the edges carrying the contrast (≥ 3:1, H6). */}
        <div
          className="absolute inset-y-0 border-x-2 border-ok bg-ok-soft"
          style={{ left: `${50 - passCents}%`, width: `${2 * passCents}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-muted" />
        {cents !== null && (
          <div
            className={`absolute inset-y-0 w-2 -translate-x-1/2 rounded-full ${inZone ? 'bg-ok' : 'bg-retry'}`}
            style={{ left: `${50 + clamped}%` }}
          />
        )}
      </div>
      <div aria-hidden="true" className="mt-1 flex justify-between text-sm tabular-nums text-muted">
        <span>−50</span>
        <span>0</span>
        <span>+50</span>
      </div>
    </div>
  );
}
