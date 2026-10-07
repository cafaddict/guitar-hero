/**
 * Minimal worker pool for the benchmark (workers register the tsx loader in worker-boot.mjs).
 */
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { BenchCase } from './cases';
import type { Outcome } from './evaluate';

export async function runInPool(
  cases: readonly BenchCase[],
  onProgress: (done: number, total: number) => void,
  batchSize = 8,
): Promise<Outcome[]> {
  const threads = Math.max(1, Math.min(availableParallelism() - 1, 11));
  const batches: BenchCase[][] = [];
  for (let i = 0; i < cases.length; i += batchSize) batches.push(cases.slice(i, i + batchSize));
  const results: Outcome[][] = new Array(batches.length);
  let next = 0;
  let done = 0;
  const workerUrl = new URL('./worker-boot.mjs', import.meta.url);
  await Promise.all(
    Array.from(
      { length: Math.min(threads, batches.length) },
      () =>
        new Promise<void>((resolve, reject) => {
          const worker = new Worker(workerUrl);
          const feed = () => {
            if (next >= batches.length) {
              void worker.terminate().then(() => resolve());
              return;
            }
            const batchId = next++;
            worker.postMessage({ batch: batches[batchId], batchId });
          };
          worker.on('message', (msg: { batchId: number; outcomes: Outcome[] }) => {
            results[msg.batchId] = msg.outcomes;
            done += msg.outcomes.length;
            onProgress(done, cases.length);
            feed();
          });
          worker.on('error', reject);
          feed();
        }),
    ),
  );
  return results.flat();
}
