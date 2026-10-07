/**
 * Lookahead timer source (SPEC §8.4). Preferred: a Worker setInterval every 25 ms with a 0.1 s lookahead.
 * Fallback (no Worker): main-thread setInterval, which can stall, so it uses 0.2 s / 0.25 s instead.
 */

export interface Ticker {
  readonly intervalMs: number;
  readonly lookaheadS: number;
  start(onTick: () => void): void;
  stop(): void;
}

class WorkerTicker implements Ticker {
  readonly intervalMs = 25;
  readonly lookaheadS = 0.1;
  private worker: Worker | null = null;

  start(onTick: () => void): void {
    this.stop();
    this.worker = new Worker(new URL('./ticker-worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = () => onTick();
    this.worker.postMessage({ type: 'start', intervalMs: this.intervalMs });
  }

  stop(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}

class MainThreadTicker implements Ticker {
  readonly intervalMs = 200;
  readonly lookaheadS = 0.25;
  private handle: ReturnType<typeof setInterval> | null = null;

  start(onTick: () => void): void {
    this.stop();
    this.handle = setInterval(onTick, this.intervalMs);
  }

  stop(): void {
    if (this.handle !== null) clearInterval(this.handle);
    this.handle = null;
  }
}

export function createTicker(): Ticker {
  return typeof Worker === 'undefined' ? new MainThreadTicker() : new WorkerTicker();
}
