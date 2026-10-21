import type { ReactNode } from 'react';

/**
 * A ring that fills clockwise with `value` (0..1). Decorative: `label` is the text a screen reader hears, and
 * `children` (usually the percentage) sit in the middle for sighted users.
 */
export function ProgressRing({
  value,
  label,
  size = 72,
  stroke = 8,
  children,
}: {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const clamped = Math.min(1, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-field [stroke-opacity:0.35]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="stroke-accent transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <span className="sr-only">{label}</span>
      {children !== undefined && (
        <span aria-hidden="true" className="absolute text-sm font-bold tabular-nums">
          {children}
        </span>
      )}
    </div>
  );
}

/** "42%" for a 0..1 fraction. */
export function percent(value: number): string {
  return `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;
}
