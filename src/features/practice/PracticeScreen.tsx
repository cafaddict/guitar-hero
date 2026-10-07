import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { repo } from '../../app/services';
import { contentContextFor } from '../../exercises/contentContext';
import { exerciseDefinition } from '../../exercises/registry';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { paramsFromQuery } from './practiceParams';

/** Standalone exercise (/practice/:type?param=value…): library "E1 시작", tests, and quick practice. */
export function PracticeScreen() {
  const { type = '' } = useParams();
  const [query] = useSearchParams();
  const definition = exerciseDefinition(type);
  const [params, setParams] = useState<unknown>(null);
  const [error, setError] = useState(false);
  const [run, setRun] = useState(0);
  const queryKey = query.toString();

  useEffect(() => {
    setParams(null);
    setError(false);
    if (!definition) return;
    void repo.progression(Date.now()).then((progression) => {
      try {
        const defaults = definition.defaultParams(contentContextFor(progression));
        setParams(definition.parseParams(paramsFromQuery(defaults, new URLSearchParams(queryKey))));
      } catch {
        setError(true);
      }
    });
  }, [definition, queryKey]);

  const title = useMemo(
    () => (definition ? ko.exercises.titles[definition.titleKey] : ko.exercises.common.unknownExercise),
    [definition],
  );
  if (!definition || error) {
    return (
      <Screen title={title}>
        <p>{ko.exercises.common.unknownExercise}</p>
      </Screen>
    );
  }
  return (
    <Screen title={title}>
      {params !== null && (
        <ExerciseHost
          // A different exercise or query is a different run: never reuse the previous host state.
          key={`${type}?${queryKey}#${run}`}
          definition={definition}
          params={params}
          renderAfter={() => (
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setRun((n) => n + 1)}>{ko.exercises.common.again}</Button>
              <Link
                className="inline-flex min-h-12 items-center rounded-lg bg-surface-2 px-4 font-semibold"
                to="/"
              >
                {ko.exercises.common.home}
              </Link>
            </div>
          )}
        />
      )}
    </Screen>
  );
}
