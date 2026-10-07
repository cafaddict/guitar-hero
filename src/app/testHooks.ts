import { audioEngine } from '../audio/engine';

/**
 * Read-only hooks for Playwright. Installed only in the e2e build (`__GH_E2E__`), removed from
 * production bundles by dead-code elimination (checked by E2E-14).
 */
export function installTestHooks(): void {
  if (!__GH_E2E__) return;
  const hooks = Object.freeze({
    get levelRms(): number | null {
      return audioEngine.latestLevel?.rms ?? null;
    },
    get contextTime(): number | null {
      return audioEngine.context?.currentTime ?? null;
    },
  });
  Object.defineProperty(window, '__gh_test', { value: hooks, writable: false, configurable: false });
}
