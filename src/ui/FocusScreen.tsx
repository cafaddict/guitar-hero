import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ko } from '../i18n/ko';
import { Icon } from './icons';
import { LoadingPlaceholder } from './LoadingPlaceholder';

/** Where "나가기" goes: back in the app's history (or a fallback on a cold start), a route, or a handler. */
export type FocusExit = { back: string } | { to: string } | { onExit: () => void };

/** Registers what "나가기" does while the exit is locked (null: nothing, the exit stays disabled). */
const ExitGuardContext = createContext<(guard: (() => void) | null) => void>(() => {});

/**
 * While mounted, a locked "나가기" runs `guard` instead of staying dead (D-094): a running exercise passes its
 * "그만할까요?" question, the touch twin of Esc. `guard` must be stable (useCallback).
 */
export function useExitGuard(guard: () => void): void {
  const register = useContext(ExitGuardContext);
  useEffect(() => {
    register(guard);
    return () => register(null);
  }, [register, guard]);
}

/**
 * Practice frame (D-087): no app navigation, a slim header with "나가기", the title and a status slot.
 * While a run is active a stray tap must not drop it: "나가기" asks first through the run's guard (as Esc does),
 * and is disabled only when no guard is up (the moment the microphone starts).
 * Not sticky: a pinned header would cover the controls a scrolled practice screen needs.
 */
export function FocusScreen({
  title,
  exit,
  exitDisabled = false,
  aside,
  busy = false,
  children,
}: {
  title: string;
  exit: FocusExit;
  exitDisabled?: boolean;
  aside?: ReactNode;
  /** Drawn while the screen's data loads (`aria-busy`, see Screen). */
  busy?: boolean;
  /** Left out while `busy`: the screen then shows the loading placeholder. */
  children?: ReactNode;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [guard, setGuard] = useState<(() => void) | null>(null);
  // A function in state is stored through the updater form.
  const registerGuard = useCallback((next: (() => void) | null) => setGuard(() => next), []);
  const guarded = exitDisabled && guard !== null;
  const leave = () => {
    if (exitDisabled) {
      guard?.();
      return;
    }
    if ('onExit' in exit) exit.onExit();
    else if ('to' in exit) navigate(exit.to);
    // `default` is the entry the app was opened on: there is no in-app page to go back to.
    else if (location.key !== 'default') navigate(-1);
    else navigate(exit.back);
  };
  return (
    <main
      id="main"
      aria-busy={busy || undefined}
      className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6 lg:px-8"
    >
      <header className="-mx-4 mb-5 flex min-h-16 items-center gap-3 border-b border-border px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <button
          type="button"
          onClick={leave}
          disabled={exitDisabled && !guarded}
          title={exitDisabled && !guarded ? ko.focus.exitWhileRunning : undefined}
          className="-ml-2 inline-flex min-h-12 shrink-0 items-center gap-1 rounded-xl px-2 font-semibold text-muted hover:text-fg disabled:opacity-40"
          data-testid="focus-exit"
        >
          <Icon name="back" />
          {ko.focus.exit}
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{title}</h1>
        {aside !== undefined && <div className="shrink-0 text-sm text-muted">{aside}</div>}
      </header>
      <ExitGuardContext.Provider value={registerGuard}>
        {busy && children == null ? <LoadingPlaceholder /> : children}
      </ExitGuardContext.Provider>
    </main>
  );
}
