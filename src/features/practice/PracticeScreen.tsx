import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { repo } from '../../app/services';
import { hammerMinutesOn } from '../../app/storedState';
import { dayKey } from '../../domain/records';
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
    const now = Date.now();
    // E11's daily cap also holds outside the routine (SPEC v1.1 §11.16 "단독 실행도 막는다").
    const hammerMinutes =
      definition.type === 'E11'
        ? repo.attempts().then((a) => hammerMinutesOn(a, dayKey(now)))
        : Promise.resolve(0);
    void Promise.all([repo.progression(now), hammerMinutes]).then(([progression, minutesToday]) => {
      try {
        const defaults = definition.defaultParams(contentContextFor(progression)) as Record<string, unknown>;
        const withCap = definition.type === 'E11' ? { ...defaults, minutesToday } : defaults;
        setParams(definition.parseParams(paramsFromQuery(withCap, new URLSearchParams(queryKey))));
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
