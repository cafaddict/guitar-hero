import { useCallback, useEffect, useRef, useState } from 'react';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { BEGINNER_CHORD_CLASSES } from '../../content/voicings';
import { newId } from '../../domain/ids';
import { type Attempt, dayKey } from '../../domain/records';
import { contentContextFor } from '../../exercises/contentContext';
import { exerciseDefinition } from '../../exercises/registry';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/icons';
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
          // The exam's tempo is fixed (D-098).
          tempoLocked: true,
        },
      }));
    case '5':
      return [];
  }
}

/**
 * One exam item: its exercises in sequence, then the verdict (recorded as an EXAM attempt). Each step's result is
 * shown before the next step, and the next step's start screen can look back at the steps done (D-097). A step is
 * never redone on its own: that would turn "5 random pairs" into best-of-N per pair; the whole item is retaken.
 */
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
  /** The stored attempt of each step done (null: stopped before anything was recorded). */
  const [attempts, setAttempts] = useState<(Attempt | null)[]>([]);
  const [verdict, setVerdict] = useState<boolean | null>(null);
  /** No run of the current step is starting or in progress. */
  const [stepIdle, setStepIdle] = useState(true);
  /** The earlier step whose result is shown instead of the current step's start screen. */
  const [viewing, setViewing] = useState<number | null>(null);
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
  const viewed = viewing === null ? null : attempts[viewing];
  const viewedDefinition = viewing === null ? undefined : exerciseDefinition(steps[viewing]?.type ?? '');
  if (viewing !== null && viewed && viewedDefinition)
    return (
      <section data-testid="exam-step-result" data-step={viewing + 1}>
        <Card>
          <p className="mb-4 font-semibold text-muted">{ko.curriculum.examStepResult(viewing + 1)}</p>
          {viewedDefinition.renderSummary({ result: viewed.result, params: viewed.params })}
        </Card>
        <div className="mt-5 flex flex-wrap gap-3">
          <div data-primary-action>
            <Button large autoFocus onClick={() => setViewing(null)} data-testid="exam-back-to-step">
              {ko.curriculum.examBackToStep}
            </Button>
          </div>
          {viewing > 0 && (
            <Button large variant="secondary" onClick={() => setViewing(viewing - 1)}>
              {ko.curriculum.examPrevResult}
            </Button>
          )}
        </div>
      </section>
    );
  const step = steps[index];
  const definition = step ? exerciseDefinition(step.type) : undefined;
  if (!step || !definition) return null;
  const content = contentContextFor(state.progression);
  const last = index + 1 >= steps.length;
  return (
    <>
      <ExerciseHost
        key={`${item}-${index}`}
        definition={definition}
        params={definition.parseParams({
          ...(definition.defaultParams(content) as object),
          ...(step.params as object),
        })}
        onActiveChange={(active) => setStepIdle(!active)}
        onFinished={(attempt) => {
          const next = [...attempts, attempt];
          setAttempts(next);
          // Stopped, or the last step: the verdict now. Otherwise the result shows until "다음 단계".
          if (attempt === null || last) void record(next.map((a) => a?.result ?? null));
        }}
        renderAfter={(attempt) =>
          attempt !== null &&
          !last && (
            <div className="mt-5" data-primary-action>
              <Button large autoFocus onClick={() => setIndex(index + 1)} data-testid="exam-next-step">
                {ko.curriculum.examNextStep(index + 2, steps.length)}
              </Button>
            </div>
          )
        }
      />
      {/* On the next step's start screen (not run yet): its host can unmount, nothing is lost. */}
      {index > 0 && stepIdle && attempts.length === index && (
        <div className="mt-4">
          <Button variant="secondary" onClick={() => setViewing(index - 1)} data-testid="exam-prev-result">
            {ko.curriculum.examPrevResult}
          </Button>
        </div>
      )}
    </>
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
  if (!state) return <Screen title={ko.curriculum.exam} busy />;
  return (
    <Screen title={ko.curriculum.exam}>
      <p className="text-lg text-muted">{ko.curriculum.examIntro}</p>
      <ol className="mt-5 space-y-4">
        {EXAM_ITEMS.map((item) => {
          const passedAt = state.progression.exam[item];
          return (
            <Card
              as="li"
              key={item}
              className="flex flex-col gap-4"
              data-testid={`exam-item-${item}`}
              data-passed={passedAt !== undefined}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <span
                  aria-hidden="true"
                  className={`grid size-10 shrink-0 place-items-center rounded-full text-lg font-bold tabular-nums ${
                    passedAt !== undefined ? 'bg-ok text-bg' : 'bg-surface-2 text-muted'
                  }`}
                >
                  {passedAt !== undefined ? <Icon name="check" size={20} /> : item}
                </span>
                <div className="min-w-0 flex-1 basis-60">
                  <p className="text-lg font-semibold">
                    <span className="sr-only">{item}. </span>
                    {ko.curriculum.examItems[item]}
                  </p>
                  {passedAt !== undefined && (
                    <Badge tone="ok" className="mt-2">
                      ✓ {ko.curriculum.examPassedAt(dayKey(passedAt))}
                    </Badge>
                  )}
                  {item === '5' && (
                    <p className="mt-1 text-muted">{ko.curriculum.examSongs(exam5Songs(state.skills))}</p>
                  )}
                </div>
                {active !== item && (
                  <Button variant="secondary" onClick={() => setActive(item)}>
                    {item === '5' ? ko.curriculum.examCheck : ko.curriculum.examStart}
                  </Button>
                )}
              </div>
              {active === item && <ExamRun item={item} state={state} onDone={reload} />}
            </Card>
          );
        })}
      </ol>
    </Screen>
  );
}
