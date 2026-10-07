import type { Page } from '@playwright/test';

/** Reads every row of an object store of the app database ('guitar-hero'). */
export function readStore<T>(page: Page, store: string): Promise<T[]> {
  return page.evaluate(
    (name) =>
      new Promise<T[]>((resolve, reject) => {
        const open = indexedDB.open('guitar-hero');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result.transaction(name, 'readonly').objectStore(name).getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result as T[]);
        };
      }),
    store,
  );
}

export interface StoredAttempt {
  id: string;
  exerciseType: string;
  detectorVersion: string | null;
  processingMs: number;
  params: Record<string, unknown>;
  result: Record<string, unknown>;
}

/** Writes rows into an object store of the app database (the app must have opened it once). */
export function putRows(page: Page, store: string, rows: unknown[]): Promise<void> {
  return page.evaluate(
    ({ name, values }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('guitar-hero');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction(name, 'readwrite');
          for (const value of values) tx.objectStore(name).put(value);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    { name: store, values: rows },
  );
}

/** A complete Calibration row (SPEC §9.1) for tests that need a known RTT. */
export function seedCalibration(rttMs: number) {
  return {
    id: 'seeded-calibration',
    createdAt: Date.now(),
    inputDeviceLabel: 'MacBook Pro Microphone (fake)',
    outputDeviceLabel: 'MacBook Pro Speakers (fake)',
    sampleRate: 48000,
    trackSettings: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    noiseFloorDbfs: -70,
    tuningCents: [0, 0, 0, 0, 0, 0],
    stringTemplates: Array.from({ length: 6 }, () => ({
      harmonics: [1, 0.5, 0.3, 0.2, 0.1, 0.05, 0.03, 0.02],
      decayRatio: 0.5,
    })),
    rttMs,
    rttMethod: 'loopback',
    rttMadMs: 0.3,
    warnings: [],
  };
}
