/**
 * Where ← / PageUp (the left pedal) goes during a run (D-096): the run's own step back while it has one, else —
 * in a session — the previous item. Before anything was played that is a plain move; once the run is under way
 * it first asks, because going back ends the run. Standalone there is no previous item: the runner keeps the key.
 */
export type PrevRoute = 'runner' | 'previous' | 'confirmPrevious';

export function prevRoute(view: {
  /** The runner can undo its last step (`ExerciseRunner.canStepBack`). */
  canStepBack: boolean;
  /** Hosted by the session runner past its first item (a previous item exists). */
  inSession: boolean;
  /** Nothing played yet (phase ready / armed). */
  waiting: boolean;
}): PrevRoute {
  if (view.canStepBack || !view.inSession) return 'runner';
  return view.waiting ? 'previous' : 'confirmPrevious';
}
