import type { ReactNode } from 'react';

/** Page frame: one h1 per screen, `#main` target for the skip link. */
export function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl p-4">
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      {children}
    </main>
  );
}
