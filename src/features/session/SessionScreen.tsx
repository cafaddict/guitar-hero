import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { actionForKey, isEditableTarget, isNativeActivation } from '../../app/keys';
import { repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { loadStoredState } from '../../app/storedState';
import { simulatedRate } from '../../app/testRate';
import type { RoutineItem } from '../../content/schemas';
import { newId } from '../../domain/ids';
import type { SelfReport } from '../../domain/records';
import { generateRoutine } from '../../domain/routine';
import { prepareSession } from '../../domain/sessionPrep';
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
  markRecorded,
  pause,
  practiceMs,
  previousItem,
  resume,
  type SessionState,
  sessionKeyCommand,
  skipItem,
  startSession,
} from './sessionModel';

interface Loaded {
  items: RoutineItem[];
  stage: number;
  content: ContentContext;
  rest: boolean;
}

/**
 * A focused button is clicked by the keyup of Space. When Space was used as a session command on keydown, that
 * keyup must not also click whatever button holds the focus.
 */
function swallowNextSpaceKeyup(): void {
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    window.removeEventListener('keyup', onKeyUp, true);
  };
  window.addEventListener('keyup', onKeyUp, true);
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
        <legend className="mb-1 w-full">{ko.session.dangerLegend}</legend>
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
  /** Index of the item whose run has ended (its summary is showing). */
  const [endedIndex, setEndedIndex] = useState<number | null>(null);
  /** An exercise run is starting or in progress: navigation would throw it away, so it waits. */
  const [runActive, setRunActive] = useState(false);
  /** Reruns of the current item: each one is a fresh host; `params` overrides the routine's (suggested tempo). */
  const [rerun, setRerun] = useState<{ n: number; params: unknown }>({ n: 0, params: null });
  const customKeys = useSettingsStore((s) => s.settings?.customKeys);
  const [showBreak, setShowBreak] = useState(false);
  const [ending, setEnding] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loadedAt = Date.now();
      const stored = await loadStoredState(loadedAt);
      // Session start (SPEC v1.1 §7.4): expire prescriptions, detect stagnation, then plan the routine.
      const prep = prepareSession({
        progression: stored.progression,
        skills: stored.skills,
        recentSamples: stored.recentSamples,
        sessionNumber: stored.history.sessionNumber,
        now: loadedAt,
      });
      if (prep.added.length > 0 || prep.expired.length > 0) await repo.saveProgression(prep.progression);
      const plan = generateRoutine(routineInputFrom({ ...stored, progression: prep.progression }, loadedAt));
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
  const go = useCallback((step: (s: SessionState) => SessionState) => {
    setEndedIndex(null);
    setRerun({ n: 0, params: null });
    setState((s) => (s ? step(s) : s));
  }, []);
  const advance = useCallback(() => go((s) => completeItem(s, items, now())), [go, items, now]);
  /** The current item again: with the params it just ran with, or with `params` (e.g. a suggested tempo). */
  const retry = useCallback((params?: unknown) => {
    setEndedIndex(null);
    setRerun((r) => ({ n: r.n + 1, params: params === undefined ? r.params : params }));
  }, []);

  // Keyboard / pedal between runs (§12.3); during a run the exercise's own keys apply.
  const between = state !== null && !runActive && !ending && !isFinished(state, items);
  useEffect(() => {
    if (!between || !state) return;
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const command = sessionKeyCommand(actionForKey(event, customKeys ?? {}), {
        paused: state.paused,
        isRest: items[state.index]?.exerciseType === 'REST',
        runEnded: endedIndex === state.index,
        first: state.index === 0,
      });
      if (!command) return;
      // After a run Space means "again" even with the focus on the next-item button; Enter on a focused button
      // keeps that button's own action.
      if (command !== 'retry' && isNativeActivation(event)) return;
      event.preventDefault();
      if (command === 'retry') {
        if (event.key === ' ') swallowNextSpaceKeyup();
        retry();
      } else if (command === 'advance') advance();
      else if (command === 'previous') go((s) => previousItem(s, now()));
      else setState(resume(state, now()));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [between, state, items, endedIndex, customKeys, advance, go, retry, now]);

  const finishSession = async (report: SelfReport) => {
    if (!state) return;
    await repo.finishSession(sessionId, Date.now(), state.recorded.length, report, practiceMs(state, now()));
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
        <RestItem key={item.id} item={item} now={now} onDone={advance} />
      ) : definition ? (
        <ExerciseHost
          key={`${item.id}#${rerun.n}`}
          definition={definition}
          params={rerun.params ?? pluginParamsFor(item, definition, loaded.content)}
          sessionId={sessionId}
          reviewOf={item.reviewOf ?? null}
          routineKey={item.key ?? null}
          autoFocusStart
          onActiveChange={setRunActive}
          onFinished={(attempt) => {
            setEndedIndex(state.index);
            if (attempt) setState((s) => (s ? markRecorded(s, item.id) : s));
          }}
          renderAfter={(attempt) => {
            const tempo = attempt ? definition.suggestedTempoRetry(attempt.params, attempt.result) : null;
            return (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button large variant="secondary" onClick={() => retry()} data-testid="retry-item">
                  {tempo ? ko.session.retrySameTempo : ko.session.retry}
                </Button>
                {tempo && (
                  <Button
                    large
                    variant="secondary"
                    onClick={() => retry(tempo.params)}
                    data-testid="retry-tempo"
                  >
                    {ko.session.retryAtBpm(tempo.bpm)}
                  </Button>
                )}
                <Button large autoFocus onClick={advance} data-testid="next-item">
                  {ko.session.nextItem}
                </Button>
              </div>
            );
          }}
        />
      ) : (
        <Button onClick={() => go((s) => skipItem(s, items, now()))}>{ko.session.skip}</Button>
      )}
      <p className="mt-4 text-sm text-muted">
        {next ? ko.session.next(itemTitle(next)) : ko.session.lastItem}
      </p>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-surface-2 pt-4">
        <Button
          variant="secondary"
          disabled={runActive || state.index === 0}
          onClick={() => go((s) => previousItem(s, now()))}
        >
          {ko.session.previous}
        </Button>
        <Button
          variant="secondary"
          disabled={runActive}
          onClick={() => go((s) => skipItem(s, items, now()))}
          data-testid="skip-item"
        >
          {ko.session.skip}
        </Button>
        {!state.paused && (
          <Button variant="secondary" disabled={runActive} onClick={() => setState(pause(state, now()))}>
            {ko.session.pause}
          </Button>
        )}
        <Button
          variant="secondary"
          disabled={runActive}
          onClick={() => setEnding(true)}
          data-testid="end-session"
        >
          {ko.session.end}
        </Button>
      </div>
      {runActive && <p className="mt-2 text-sm text-muted">{ko.session.finishRunFirst}</p>}
    </Screen>
  );
}
