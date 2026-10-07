import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { repo } from '../../app/services';
import { loadStoredState } from '../../app/storedState';
import { simulatedRate } from '../../app/testRate';
import type { RoutineItem } from '../../content/schemas';
import { newId } from '../../domain/ids';
import type { SelfReport } from '../../domain/records';
import { generateRoutine } from '../../domain/routine';
import { contentContextFor } from '../../exercises/contentContext';
import { exerciseDefinition } from '../../exercises/registry';
import type { ContentContext } from '../../exercises/types';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { routineInputFrom } from '../home/homeModel';
import { itemTitle } from './itemTitle';
import { pluginParamsFor } from './routineParams';
import {
  acknowledgeBreak,
  breakDue,
  completeItem,
  isFinished,
  itemRemainingSec,
  pause,
  previousItem,
  resume,
  type SessionState,
  skipItem,
  startSession,
} from './sessionModel';

interface Loaded {
  items: RoutineItem[];
  stage: number;
  content: ContentContext;
  rest: boolean;
}

/** Simulated ms (E2E builds may compress time; production rate is 1). */
function useClock(): () => number {
  return useMemo(() => {
    const rate = simulatedRate();
    return () => performance.now() * rate;
  }, []);
}

function RestItem({ item, now, onDone }: { item: RoutineItem; now: () => number; onDone: () => void }) {
  const [endsAt] = useState(() => now() + item.durationSec * 1000);
  const [left, setLeft] = useState(item.durationSec);
  useEffect(() => {
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - now()) / 1000));
      setLeft(remaining);
      if (remaining === 0) onDone();
    }, 200);
    return () => clearInterval(id);
  }, [endsAt, now, onDone]);
  return (
    <section className="rounded-lg bg-surface p-6 text-center" data-testid="rest-item">
      <p className="text-3xl font-bold">{ko.session.rest(left)}</p>
      <Button autoFocus className="mt-4" onClick={onDone}>
        {ko.session.restSkip}
      </Button>
    </section>
  );
}

function SelfReportForm({ onSave }: { onSave: (report: SelfReport) => void }) {
  const [pain, setPain] = useState(0);
  const [difficulty, setDifficulty] = useState(3);
  const [flags, setFlags] = useState<SelfReport['dangerFlags'][number][]>([]);
  const [note, setNote] = useState('');
  const toggle = (flag: SelfReport['dangerFlags'][number]) =>
    setFlags((f) => (f.includes(flag) ? f.filter((x) => x !== flag) : [...f, flag]));
  return (
    <section className="flex flex-col gap-4 rounded-lg bg-surface p-4" data-testid="self-report">
      <h2 className="text-xl font-bold">{ko.session.reportTitle}</h2>
      <label className="flex flex-col gap-1">
        <span>{ko.session.pain(pain)}</span>
        <input
          type="range"
          min={0}
          max={10}
          value={pain}
          onChange={(e) => setPain(Number(e.target.value))}
          data-testid="report-pain"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span>{ko.session.difficulty(difficulty)}</span>
        <input
          type="range"
          min={1}
          max={5}
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
          data-testid="report-difficulty"
        />
      </label>
      <fieldset className="flex flex-wrap gap-3">
        {(['sharp', 'numbness', 'joint'] as const).map((flag) => (
          <label key={flag} className="flex min-h-12 items-center gap-2">
            <input
              type="checkbox"
              className="h-6 w-6"
              checked={flags.includes(flag)}
              onChange={() => toggle(flag)}
            />
            {ko.session.danger[flag]}
          </label>
        ))}
      </fieldset>
      <p className="text-sm text-muted">{ko.safety.notMedicalAdvice}</p>
      <label className="flex flex-col gap-1">
        <span>{ko.session.note}</span>
        <textarea
          className="min-h-20 rounded-lg bg-surface-2 p-2 text-fg"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <Button
        large
        onClick={() => onSave({ pain, difficulty, dangerFlags: flags, note })}
        data-testid="report-save"
      >
        {ko.session.save}
      </Button>
    </section>
  );
}

/** Session runner (SPEC §12.1): today's routine item by item, then the self report. */
export function SessionScreen() {
  const navigate = useNavigate();
  const now = useClock();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sessionId] = useState(newId);
  const [state, setState] = useState<SessionState | null>(null);
  const [current, setCurrent] = useState<{ index: number; recorded: boolean } | null>(null);
  const [showBreak, setShowBreak] = useState(false);
  const [ending, setEnding] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadStoredState(Date.now());
      const plan = generateRoutine(routineInputFrom(stored, Date.now()));
      if (cancelled) return;
      const items = plan.kind === 'rest' ? [] : plan.items;
      setLoaded({
        items,
        stage: stored.progression.stage,
        content: contentContextFor(stored.progression),
        rest: plan.kind === 'rest',
      });
      if (plan.kind === 'rest') return;
      await repo.startSession({
        id: sessionId,
        startedAt: Date.now(),
        endedAt: null,
        routineId: null,
        plannedItems: items.filter((i) => i.exerciseType !== 'REST').length,
        completedItems: 0,
        selfReport: null,
        stage: stored.progression.stage,
      });
      if (!cancelled) setState(startSession(now()));
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, now]);

  // Once per second: item budget display and the 30-minute break reminder.
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setState((s) => {
        if (s && !s.paused && breakDue(s, now())) {
          setShowBreak(true);
          return acknowledgeBreak(s, now());
        }
        return s;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [now]);

  const items = loaded?.items ?? [];
  const advance = useCallback(
    (recorded: boolean) => {
      setCurrent(null);
      setState((s) => (s ? completeItem(s, items, now(), recorded) : s));
    },
    [items, now],
  );

  const finishSession = async (report: SelfReport) => {
    if (!state) return;
    await repo.finishSession(sessionId, Date.now(), state.recorded.length, report);
    navigate('/');
  };

  if (!loaded) return <Screen title={ko.session.title}>{null}</Screen>;
  if (loaded.rest) {
    return (
      <Screen title={ko.session.title}>
        <p className="text-retry">{ko.safety.restDay}</p>
      </Screen>
    );
  }
  if (!state) return <Screen title={ko.session.title}>{null}</Screen>;

  if (ending || isFinished(state, items)) {
    return (
      <Screen title={ko.session.title}>
        <SelfReportForm onSave={(report) => void finishSession(report)} />
      </Screen>
    );
  }

  const item = items[state.index]!;
  const next = items[state.index + 1];
  const budget = itemRemainingSec(state, items, now());
  const finishedCurrent = current?.index === state.index;
  const definition = item.exerciseType === 'REST' ? null : exerciseDefinition(item.exerciseType);

  return (
    <Screen title={ko.session.title}>
      <div
        className="mb-3 flex flex-wrap items-baseline justify-between gap-2"
        data-testid="session-header"
        data-index={state.index}
        data-item-type={item.exerciseType}
      >
        <h2 className="text-xl font-bold">
          {ko.session.itemOf(state.index + 1, items.length)} · {itemTitle(item)}
        </h2>
        <p className={budget === 0 ? 'text-retry' : 'text-muted'}>
          {budget === 0 ? ko.session.budgetOver : ko.session.itemBudget(budget)}
        </p>
      </div>
      {showBreak && (
        <div role="alert" className="mb-3 rounded-lg bg-surface-2 p-3">
          <p>{ko.session.breakReminder}</p>
          <Button className="mt-2" variant="secondary" onClick={() => setShowBreak(false)}>
            {ko.session.breakOk}
          </Button>
        </div>
      )}
      {state.paused ? (
        <section className="rounded-lg bg-surface p-6 text-center">
          <p className="text-2xl">{ko.session.paused}</p>
          <Button autoFocus className="mt-3" onClick={() => setState(resume(state, now()))}>
            {ko.session.resume}
          </Button>
        </section>
      ) : item.exerciseType === 'REST' ? (
        <RestItem key={item.id} item={item} now={now} onDone={() => advance(false)} />
      ) : definition ? (
        <ExerciseHost
          key={item.id}
          definition={definition}
          params={pluginParamsFor(item, definition, loaded.content)}
          sessionId={sessionId}
          reviewOf={item.block === 'review' ? (item.subjectKey ?? null) : null}
          autoFocusStart
          onFinished={(attempt) => setCurrent({ index: state.index, recorded: attempt !== null })}
          renderAfter={() => (
            <Button
              large
              autoFocus
              className="mt-4"
              onClick={() => advance(current?.recorded ?? finishedCurrent)}
              data-testid="next-item"
            >
              {ko.session.nextItem}
            </Button>
          )}
        />
      ) : (
        <Button onClick={() => setState(skipItem(state, items, now()))}>{ko.session.skip}</Button>
      )}
      <p className="mt-4 text-sm text-muted">
        {next ? ko.session.next(itemTitle(next)) : ko.session.lastItem}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-2 pt-4">
        <Button
          variant="secondary"
          disabled={state.index === 0}
          onClick={() => setState(previousItem(state, now()))}
        >
          {ko.session.previous}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setState(skipItem(state, items, now()))}
          data-testid="skip-item"
        >
          {ko.session.skip}
        </Button>
        {!state.paused && (
          <Button variant="secondary" onClick={() => setState(pause(state, now()))}>
            {ko.session.pause}
          </Button>
        )}
        <Button variant="secondary" onClick={() => setEnding(true)} data-testid="end-session">
          {ko.session.end}
        </Button>
      </div>
    </Screen>
  );
}
