/**
 * Line icons (24 × 24, `currentColor`), drawn here so the app needs no icon dependency. Always decorative:
 * the control next to or around an icon carries the text.
 */
import type { ReactNode } from 'react';

export type IconName =
  | 'home'
  | 'path'
  | 'tools'
  | 'chart'
  | 'settings'
  | 'back'
  | 'tuner'
  | 'metronome'
  | 'chord'
  | 'clock'
  | 'flame'
  | 'repeat'
  | 'check'
  | 'play'
  | 'flag'
  | 'chevronDown'
  | 'pause'
  | 'alert'
  | 'info';

const PATHS: Record<IconName, ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
    </>
  ),
  // A winding road with a flag: the curriculum as a route.
  path: (
    <>
      <path d="M5 21c0-4 4-4 7-6s7-2 7-6" />
      <circle cx="5" cy="21" r="0.5" />
      <path d="M19 9V3l-4 1.5L19 6" />
    </>
  ),
  // A tuning fork.
  tools: (
    <>
      <path d="M9 3v7a3 3 0 0 0 6 0V3" />
      <path d="M12 13v8" />
      <path d="M10 21h4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V7" />
      <path d="M17 16v-8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </>
  ),
  back: <path d="M15 5 8 12l7 7" />,
  tuner: (
    <>
      <path d="M4 18a8 8 0 1 1 16 0" />
      <path d="M12 18l4-6" />
    </>
  ),
  metronome: (
    <>
      <path d="M8 3h8l3 18H5L8 3Z" />
      <path d="m12 15 5-8" />
    </>
  ),
  chord: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M5 9h14M5 15h14M10 3v18M14 3v18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  flame: (
    <path d="M12 21c4 0 7-2.6 7-6.5 0-4-3.5-6-4.5-10.5C12 6 11 8 11 10c-1-1-2-2-2-4-2.5 2-4 5-4 8.5C5 18.4 8 21 12 21Z" />
  ),
  repeat: (
    <>
      <path d="M4 12a8 8 0 0 1 14-5.3L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M20 12a8 8 0 0 1-14 5.3L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  play: <path d="M8 5v14l11-7L8 5Z" />,
  flag: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </>
  ),
  chevronDown: <path d="m6 9 6 6 6-6" />,
  pause: (
    <>
      <path d="M9 5v14" />
      <path d="M15 5v14" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20L12 3Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 7.5h.01" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      {PATHS[name]}
    </svg>
  );
}
