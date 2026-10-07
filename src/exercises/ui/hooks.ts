import { useEffect, useState } from 'react';
import type { ExerciseRunner, RunnerSnapshot } from '../types';

/** Current runner snapshot (re-rendered on every publish). */
export function useRunnerSnapshot<R, V>(runner: ExerciseRunner<R, V>): RunnerSnapshot<V> {
  const [snapshot, setSnapshot] = useState(() => runner.snapshot());
  useEffect(() => runner.subscribe(setSnapshot), [runner]);
  return snapshot;
}
