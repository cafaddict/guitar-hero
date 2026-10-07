/**
 * App-wide singletons: the IndexedDB repository, the audio engine and the metronome runtime.
 * Capture diagnostics (getSettings) are persisted every time the microphone starts (SPEC §8.1).
 */
import { audioEngine } from '../audio/appEngine';
import { MetronomeRuntime } from '../audio/metronomeRuntime';
import { GuitarDb } from '../data/db';
import { Repository } from '../data/repo';

export const repo = new Repository(new GuitarDb());
export const metronome = new MetronomeRuntime(audioEngine);
export { audioEngine };

export const CAPTURE_DIAGNOSTICS_KEY = 'captureDiagnostics';

audioEngine.status.on((status) => {
  const diagnostics = audioEngine.diagnostics;
  if (status.kind === 'running' && diagnostics) void repo.setMeta(CAPTURE_DIAGNOSTICS_KEY, diagnostics);
});

/** Resolves once the capture worklet has processed its first block (sample ↔ time mapping known). */
export async function captureReady(timeoutMs = 3000): Promise<void> {
  const started = performance.now();
  while (!audioEngine.captureReady) {
    if (performance.now() - started > timeoutMs) throw new Error('capture did not start');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
