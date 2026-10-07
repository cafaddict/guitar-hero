import { audioEngine, metronome } from './services';

/**
 * Read-only hooks for Playwright. Installed only in the e2e build (`__GH_E2E__`), removed from
 * production bundles by dead-code elimination (checked by E2E-14). Frozen getters only: tests observe,
 * they never drive the app through these.
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
    get engineStatus(): string {
      return audioEngine.currentStatus.kind;
    },
    get captureReady(): boolean {
      return audioEngine.captureReady;
    },
    get sampleRate(): number | null {
      return audioEngine.context?.sampleRate ?? null;
    },
    get captureGapFrames(): number {
      return audioEngine.captureGaps.frames;
    },
    get gridStartTime(): number | null {
      return metronome.gridStartTime;
    },
  });
  Object.defineProperty(window, '__gh_test', { value: hooks, writable: false, configurable: false });
}
