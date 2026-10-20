import type { HTMLAttributes, ReactNode } from 'react';

export type CardTone = 'default' | 'notice' | 'accent' | 'ok' | 'fail' | 'retry' | 'info';

const TONES: Record<CardTone, string> = {
  default: 'border-border bg-surface',
  notice: 'border-transparent bg-surface-2',
  accent: 'border-accent/50 bg-accent-soft',
  ok: 'border-ok/40 bg-ok-soft',
  fail: 'border-fail/40 bg-fail-soft',
  retry: 'border-retry/40 bg-retry-soft',
  info: 'border-info/40 bg-info-soft',
};

type CardElement = 'div' | 'section' | 'li' | 'article' | 'aside';

/**
 * The panel every screen is built from. Keeps the `card` class: the high-contrast theme outlines it.
 * `tone` tints the ground for status panels; every text token stays ≥ 4.5:1 on each tint.
 */
export function Card({
  as: Element = 'div',
  tone = 'default',
  className = '',
  ...rest
}: HTMLAttributes<HTMLElement> & { as?: CardElement; tone?: CardTone }) {
  return <Element className={`card rounded-2xl border p-4 sm:p-5 ${TONES[tone]} ${className}`} {...rest} />;
}

/** Card title row: a heading on the left, an optional short value (total time, count) on the right. */
export function CardHeader({
  title,
  aside,
  level = 2,
  className = '',
}: {
  title: ReactNode;
  aside?: ReactNode;
  level?: 2 | 3;
  className?: string;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={`mb-3 flex items-baseline justify-between gap-3 ${className}`}>
      <Heading className={level === 2 ? 'text-lg font-bold' : 'font-semibold'}>{title}</Heading>
      {aside !== undefined && <span className="shrink-0 tabular-nums text-muted">{aside}</span>}
    </div>
  );
}
