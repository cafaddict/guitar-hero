/** ±50 cents needle; the band shows the pass zone. A native <meter> carries the value for assistive tech. */
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
      <div aria-hidden="true" className="relative h-10 w-full rounded bg-surface-2">
        <div
          className="absolute inset-y-0 bg-ok/30"
          style={{ left: `${50 - passCents}%`, width: `${2 * passCents}%` }}
        />
        <div className="absolute inset-y-0 left-1/2 w-px bg-muted" />
        {cents !== null && (
          <div
            className={`absolute inset-y-0 w-1.5 -translate-x-1/2 rounded ${inZone ? 'bg-ok' : 'bg-retry'}`}
            style={{ left: `${50 + clamped}%` }}
          />
        )}
      </div>
    </div>
  );
}
