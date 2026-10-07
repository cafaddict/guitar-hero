/**
 * Real browser bindings for AudioEngine. Kept apart from engine.ts so unit tests never import Vite-specific
 * module URLs. The worklet is bundled as a separate TS entry (`?worker&url`, D-014).
 */

import type { EnginePlatform } from './engine';
import captureProcessorUrl from './worklet/capture-processor.ts?worker&url';

export function browserPlatform(): EnginePlatform {
  return {
    createContext: () => new AudioContext({ latencyHint: 'interactive' }),
    getUserMedia: (constraints) => {
      if (!navigator.mediaDevices?.getUserMedia)
        return Promise.reject(new TypeError('getUserMedia unavailable'));
      return navigator.mediaDevices.getUserMedia(constraints);
    },
    enumerateDevices: () => navigator.mediaDevices?.enumerateDevices() ?? Promise.resolve([]),
    loadCaptureModule: (ctx) => ctx.audioWorklet.addModule(captureProcessorUrl),
    createCaptureNode: (ctx) =>
      new AudioWorkletNode(ctx, 'gh-capture', { numberOfInputs: 1, numberOfOutputs: 0 }),
    createDspWorker: () => new Worker(new URL('./worker/dsp-worker.ts', import.meta.url), { type: 'module' }),
    navigator,
    now: () => Date.now(),
  };
}
