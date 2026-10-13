/**
 * Live per-bar feedback while playing (D-077): one cell per bar (wrapping, no horizontal scroll), coloured and
 * marked by its status, and a polite live line describing the bar just judged. View-only.
 */
import { ko } from '../../i18n/ko';
import type { LiveBar, LiveBarStatus } from '../liveTiming';

const TONE: Record<LiveBarStatus, string> = {
  good: 'text-ok',
  off: 'text-retry',
  miss: 'text-fail',
  stop: 'text-fail',
};

/** What the live line says about a bar: beat 1 and the chord (E6), or the slot counts (E5, E8). */
export function liveBarText(bar: LiveBar, kind: 'beatOne' | 'counts'): string {
  const t = ko.exercises.live;
  const n = bar.bar + 1;
  if (kind === 'counts') return t.counts(n, bar.hits, bar.expected, bar.misses, bar.extras);
  return t.beatOne(
    n,
    t.status[bar.status],
    bar.offsetMs === null ? null : t.timing(bar.offsetMs),
    bar.chord ? t.chord[bar.chord] : null,
  );
}

export function LiveBars({
  bars,
  live,
  current,
  kind,
}: {
  bars: number;
  live: readonly LiveBar[];
  /** The bar playing now (0-based), outlined. */
  current: number | null;
  kind: 'beatOne' | 'counts';
}) {
  const t = ko.exercises.live;
  const last = live[live.length - 1];
  return (
    <section data-testid="live-bars" aria-label={t.title}>
      <ol className="flex flex-wrap gap-1">
        {Array.from({ length: bars }, (_, i) => i).map((b) => {
          const bar = live[b];
          const label = t.cell(b + 1, bar ? t.status[bar.status] : t.pending);
          return (
            <li
              key={b}
              data-testid="live-bar"
              data-status={bar?.status ?? 'pending'}
              {...(bar?.chord ? { 'data-chord': bar.chord } : {})}
              aria-label={label}
              title={bar ? liveBarText(bar, kind) : label}
              className={`flex h-9 w-9 items-center justify-center rounded-md bg-surface text-lg font-bold ${bar ? TONE[bar.status] : 'text-muted'} ${current === b ? 'ring-2 ring-accent' : ''}`}
            >
              <span aria-hidden="true">
                {bar ? t.icon[bar.status] : '·'}
                {bar?.chord === 'wrong' ? '♪' : ''}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1 min-h-6" aria-live="polite" data-testid="live-last">
        {last ? liveBarText(last, kind) : ''}
      </p>
    </section>
  );
}
