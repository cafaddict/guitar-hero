import type { ReactNode } from 'react';

export type ScreenWidth = 'narrow' | 'wide';

/** Forms and reading screens stay one comfortable column; dashboards use the iPad landscape width. */
export const SCREEN_WIDTH: Record<ScreenWidth, string> = {
  narrow: 'max-w-3xl',
  wide: 'max-w-6xl',
};

/** Page frame: one h1 per screen, `#main` target for the skip link. */
export function Screen({
  title,
  eyebrow,
  width = 'narrow',
  children,
}: {
  title: string;
  /** A short line above the title (today's date, the stage group). */
  eyebrow?: ReactNode;
  width?: ScreenWidth;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      className={`mx-auto w-full ${SCREEN_WIDTH[width]} px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-10`}
    >
      <header className="mb-6">
        {eyebrow !== undefined && <p className="mb-1 text-sm font-medium text-muted">{eyebrow}</p>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      </header>
      {children}
    </main>
  );
}
