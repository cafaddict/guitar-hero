import type { ReactNode } from 'react';

/**
 * A number with its label above ("이번 주" / "35분"). The label ends in a space so the tile still reads as one
 * phrase ("이번 주 35분") to screen readers and text queries.
 */
export function Stat({
  label,
  value,
  sub,
  icon,
  testId,
}: {
  label: string;
  value: string;
  sub?: string | undefined;
  icon?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5" data-testid={testId}>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {`${label} `}
      </p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums leading-tight">
        {value}
        {sub !== undefined && <span className="ml-1 text-sm font-medium text-muted">{` ${sub}`}</span>}
      </p>
    </div>
  );
}
