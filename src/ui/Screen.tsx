import type { ReactNode } from 'react';
import { LoadingPlaceholder } from './LoadingPlaceholder';

export type ScreenWidth = 'narrow' | 'wide';

/** Forms and reading screens stay one comfortable column; dashboards use the iPad landscape width. */
export const SCREEN_WIDTH: Record<ScreenWidth, string> = {
  narrow: 'max-w-3xl',
  wide: 'max-w-6xl',
};

/**
 * Page frame: one h1 per screen, `#main` target for the skip link. `busy` marks the frame drawn while the
 * screen's data loads (`aria-busy`); checks and screenshots wait until no element is busy (D-088).
 */
export function Screen({
  title,
  eyebrow,
  width = 'narrow',
  busy = false,
  children,
}: {
  title: string;
  /** A short line above the title (today's date, the stage group). */
  eyebrow?: ReactNode;
  width?: ScreenWidth;
  busy?: boolean;
  /** Left out while `busy`: the screen then shows the loading placeholder. */
  children?: ReactNode;
}) {
  return (
    <main
      id="main"
      aria-busy={busy || undefined}
      className={`mx-auto w-full ${SCREEN_WIDTH[width]} px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-10`}
    >
      <header className="mb-6">
        {eyebrow !== undefined && <p className="mb-1 text-sm font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      </header>
      {busy && children == null ? <LoadingPlaceholder /> : children}
    </main>
  );
}
