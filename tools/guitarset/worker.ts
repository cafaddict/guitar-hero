/**
 * worker_threads entry for the GuitarSet benchmark.
 */
import { parentPort } from 'node:worker_threads';
import { type ClipTask, evaluateClip } from './evaluate';

parentPort?.on('message', (message: { task: ClipTask; taskId: number }) => {
  try {
    parentPort?.postMessage({ taskId: message.taskId, outcome: evaluateClip(message.task) });
  } catch (error) {
    parentPort?.postMessage({ taskId: message.taskId, error: `${message.task.info.id}: ${String(error)}` });
  }
});
