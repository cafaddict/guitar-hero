/**
 * worker_threads entry: evaluates a batch of cases and posts the outcomes back.
 */
import { parentPort } from 'node:worker_threads';
import type { BenchCase } from './cases';
import { evaluateCase } from './evaluate';
import { loadThresholds } from './thresholds';

const thresholds = loadThresholds();

parentPort?.on('message', (message: { batch: BenchCase[]; batchId: number }) => {
  const outcomes = message.batch.map((c) => evaluateCase(c, thresholds));
  parentPort?.postMessage({ batchId: message.batchId, outcomes });
});
