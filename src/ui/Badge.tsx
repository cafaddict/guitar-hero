import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'accent' | 'ok' | 'fail' | 'retry' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-muted',
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok',
  fail: 'bg-fail-soft text-fail',
  retry: 'bg-retry-soft text-retry',
  info: 'bg-info-soft text-info',
};

/** A small pill label (review, passed, current). Text always says the state; the tint only repeats it. */
export function Badge({
  tone = 'neutral',
  className = '',
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`}
      {...rest}
    />
  );
}
