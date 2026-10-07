/**
 * Timer worker for the metronome lookahead loop (SPEC §8.4): setInterval inside a Worker is not throttled
 * like main-thread timers in background tabs and is not delayed by rendering.
 */
type TickerMessage = { type: 'start'; intervalMs: number } | { type: 'stop' };

const scope = self as unknown as {
  postMessage(message: 'tick'): void;
  onmessage: ((event: MessageEvent<TickerMessage>) => void) | null;
};

let handle: ReturnType<typeof setInterval> | null = null;

scope.onmessage = (event) => {
  if (handle !== null) clearInterval(handle);
  handle = null;
  if (event.data.type === 'start')
    handle = setInterval(() => scope.postMessage('tick'), event.data.intervalMs);
};
