import { useCallback, useEffect, useRef, useState } from 'react';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { BEGINNER_CHORD_CLASSES } from '../../content/voicings';
import { newId } from '../../domain/ids';
import { dayKey } from '../../domain/records';
import { contentContextFor } from '../../exercises/contentContext';
import { exerciseDefinition } from '../../exercises/registry';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Screen } from '../../ui/Screen';
import type { StoredState } from '../home/homeModel';
import { EXAM_ITEMS } from '../home/homeModel';
import { EXAM_PATTERN, evaluateExamItem, exam5Songs, examPairs } from './examModel';

type ExamItem = (typeof EXAM_ITEMS)[number];
interface Step {
  type: string;
  params: unknown;
}

function stepsFor(item: ExamItem, seed: number): Step[] {
  switch (item) {
    case '1':
      return [{ type: 'E0', params: {} }];
    case '2':
      return [
        {
          type: 'Q2',
          params: { count: BEGINNER_CHORD_CLASSES.length, chordClasses: [...BEGINNER_CHORD_CLASSES], seed },
        },
      ];
    case '3':
      return examPairs(seed).map(([from, to]) => ({
        type: 'E2',
        params: { from, to, durationMs: 60_000, countMode: 'auto' },
      }));
    case '4':
      return [false, true].map((cuesHidden) => ({
        type: 'E5',
        params: {
          patternId: EXAM_PATTERN.patternId,
          bpm: EXAM_PATTERN.bpm,
          bars: EXAM_PATTERN.bars,
          mode: 'single',
          chords: ['C'],
          cuesHidden,
          previousLow: false,
        },
      }));
    case '5':
      return [];
  }
}

/** One exam item: its exercises in sequence, then the verdict (recorded as an EXAM attempt). */
function ExamRun({
  item,
  state,
  onDone,
}: {
  item: ExamItem;
  state: StoredState;
  onDone: (passed: boolean) => void;
}) {
  const [seed] = useState(() => Date.now() % 2 ** 31);
  const steps = stepsFor(item, seed);
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<unknown[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const recordedRef = useRef(false);

  const record = useCallback(
    async (all: unknown[]) => {
      // One EXAM attempt per run (React StrictMode runs the item-5 effect twice in development).
      if (recordedRef.current) return;
      recordedRef.current = true;
      const now = Date.now();
      const { passed, detail } = evaluateExamItem(item, all, {
        skills: state.skills,
        gVoicing: state.progression.gVoicing,
      });
      await repo.recordAttempt({
        id: newId(),
        sessionId: null,
        exerciseType: 'EXAM',
        exerciseVersion: 1,
        startedAt: now,
        endedAt: now,
        params: { item },
        result: { item, passed, detail },
        detectorVersion: null,
        processingMs: 0,
        reviewOf: null,
      });
      if (passed) {
        const progression = await repo.progression(now);
        await repo.saveProgression({ ...progression, exam: { ...progression.exam, [item]: now } });
      }
      setVerdict(passed);
      onDone(passed);
    },
    [item, state, onDone],
  );

  useEffect(() => {
    if (steps.length === 0 && verdict === null) void record([]);
  }, [steps.length, verdict, record]);

  if (verdict !== null)
    return (
      <p className={verdict ? 'text-ok' : 'text-retry'}>
        {verdict ? ko.curriculum.examPassedAt(dayKey(Date.now())) : ko.curriculum.examNotYet}
      </p>
    );
  const step = steps[index];
  const definition = step ? exerciseDefinition(step.type) : undefined;
  if (!step || !definition) return null;
  const content = contentContextFor(state.progression);
  return (
    <ExerciseHost
      key={`${item}-${index}`}
      definition={definition}
      params={definition.parseParams({
        ...(definition.defaultParams(content) as object),
        ...(step.params as object),
      })}
      onFinished={(attempt) => {
        const next = [...results, attempt?.result ?? null];
        setResults(next);
        if (attempt === null || index + 1 >= steps.length) void record(next);
        else setIndex(index + 1);
      }}
    />
  );
}

/** Graduation exam (SPEC §7.6): five items, each passable on its own; passes are kept. */
export function ExamScreen() {
  const [state, setState] = useState<StoredState | null>(null);
  const [active, setActive] = useState<ExamItem | null>(null);
  const reload = useCallback(() => {
    void loadStoredState(Date.now()).then(setState);
  }, []);
  useEffect(reload, [reload]);
  if (!state) return <Screen title={ko.curriculum.exam}>{null}</Screen>;
  return (
    <Screen title={ko.curriculum.exam}>
      <p className="text-muted">{ko.curriculum.examIntro}</p>
      <ol className="mt-5 space-y-4">
        {EXAM_ITEMS.map((item) => {
          const passedAt = state.progression.exam[item];
          return (
            <Card
              as="li"
              key={item}
              className="flex gap-4"
              data-testid={`exam-item-${item}`}
              data-passed={passedAt !== undefined}
            >
              <span
                aria-hidden="true"
                className={`grid size-9 shrink-0 place-items-center rounded-full font-bold tabular-nums ${
                  passedAt !== undefined ? 'bg-ok text-bg' : 'bg-surface-2 text-muted'
                }`}
              >
                {item}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  <span className="sr-only">{item}. </span>
                  {ko.curriculum.examItems[item]}
                </p>
                {passedAt !== undefined && (
                  <Badge tone="ok" className="mt-2">
                    ✓ {ko.curriculum.examPassedAt(dayKey(passedAt))}
                  </Badge>
                )}
                {item === '5' && (
                  <p className="mt-1 text-sm text-muted">
                    {ko.curriculum.examSongs(exam5Songs(state.skills))}
                  </p>
                )}
                {active === item ? (
                  <div className="mt-3">
                    <ExamRun item={item} state={state} onDone={reload} />
                  </div>
                ) : (
                  <Button className="mt-3" variant="secondary" onClick={() => setActive(item)}>
                    {item === '5' ? ko.curriculum.examCheck : ko.curriculum.examStart}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </ol>
    </Screen>
  );
}
