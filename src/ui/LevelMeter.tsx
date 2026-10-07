/** Input level bar: −60…0 dBFS, red when clipping. A native <meter> carries the value for assistive tech. */
export function LevelMeter({ rms, clipped, label }: { rms: number | null; clipped: boolean; label: string }) {
  const db = rms === null ? -Infinity : 20 * Math.log10(Math.max(rms, 1e-9));
  const shown = Number.isFinite(db) ? Math.max(-60, Math.min(0, db)) : -60;
  const fraction = (shown + 60) / 60;
  return (
    <div className="relative">
      <meter className="sr-only" aria-label={label} min={-60} max={0} value={Math.round(shown)} />
      <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded bg-surface-2">
        <div className={`h-full ${clipped ? 'bg-fail' : 'bg-ok'}`} style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  );
}
