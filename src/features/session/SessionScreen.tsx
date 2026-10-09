import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { actionForKey, isEditableTarget, isNativeActivation } from '../../app/keys';
import { audioEngine, metronome, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { loadStoredState } from '../../app/storedState';
import { simulatedRate } from '../../app/testRate';
import type { RoutineItem } from '../../content/schemas';
import { voicingById } from '../../content/voicings';
import { newId } from '../../domain/ids';
import { type Attempt, dayKey, type SelfReport } from '../../domain/records';
import { generateRoutine, type RoutineInput } from '../../domain/routine';
import { prepareSession } from '../../domain/sessionPrep';
import { createExerciseOutput } from '../../exercises/audioAdapter';
import { contentContextFor } from '../../exercises/contentContext';
import { exerciseDefinition } from '../../exercises/registry';
import type { ContentContext } from '../../exercises/types';
import { ExerciseHost } from '../../exercises/ui/ExerciseHost';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { ChordDiagram } from '../../ui/ChordDiagram';
import { Screen } from '../../ui/Screen';
import { routineInputFrom } from '../home/homeModel';
import { itemTitle } from './itemTitle';
import { type RunIdentity, repeatSuggestion } from './repeat';
import { pluginParamsFor } from './routineParams';
import {
  acknowledgeBreak,
  atSplitPoint,
  BLOCK_TRANSITION_MS,
  breakDue,
  completeItem,
  isFinished,
  itemRemainingSec,
  markRecorded,
  opensNewBlock,
  pause,
  practiceMs,
  previousItem,
  REPEATABLE_TYPES,
  restartItemClock,
  resume,
  resumeSplit,
  type SessionState,
  SPLIT_RESUME_KEY,
  type SplitResume,
  sessionKeyCommand,
  skipItem,
  splitHere,
  startSession,
} from './sessionModel';
import { clearSplit, closeSplit, pendingSplit, saveSplitProgress } from './splitResume';

interface Loaded {
  items: RoutineItem[];
  stage: number;
  content: ContentContext;
  rest: boolean;
  /** Last item of the first half when the session may be split here (Stage 8–11, §7.3-11), else null. */
  splitAfterIndex: number | null;
  /** What the repertoire block cycles through (§11.10 "차례로 친다"). */
  repertoire: Pick<RoutineInput, 'songs' | 'stage' | 'skills'>;
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
  /** "이어서 하기": the second half of a split session continues the same session (§7.3-11). */
  const resuming = useSearchParams()[0].get('resume') !== null;
  const [sessionId, setSessionId] = useState<string | null>(null);
  /** The kept first half this runner resumed (its record follows the second half's progress). */
  const [resumedSplit, setResumedSplit] = useState<SplitResume | null>(null);
  const [state, setState] = useState<SessionState | null>(null);
  /** Index of the item whose run has ended (its summary is showing). */
  const [endedIndex, setEndedIndex] = useState<number | null>(null);
  /** An exercise run is starting or in progress: navigation would throw it away, so it waits. */
  const [runActive, setRunActive] = useState(false);
  /** Reruns of the current item: each one is a fresh host; `params` overrides the routine's (suggested tempo). */
  /**
   * Reruns of the current item: each one is a fresh host. `params` overrides the routine's (suggested tempo, next
   * repertoire song); `identity` files the run under another subject when the song changed (§11.10).
   */
  const [rerun, setRerun] = useState<{ n: number; params: unknown; identity: RunIdentity | null }>({
    n: 0,
    params: null,
    identity: null,
  });
  const customKeys = useSettingsStore((s) => s.settings?.customKeys);
  const blockTransition = useSettingsStore((s) => s.settings?.blockTransition ?? true);
  const leftHanded = useSettingsStore((s) => s.settings?.leftHanded ?? false);
  /** The stored attempt of the current item's last run (its suggested tempo drives "이어서 한 번 더"). */
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  /** Item id whose block time ran out (signal shown once). */
  const [blockEndedFor, setBlockEndedFor] = useState<string | null>(null);
  /** Transition screen before a new block (§7.3-13): ends at this simulated time. */
  const [transitionEndsAt, setTransitionEndsAt] = useState<number | null>(null);
  const [showBreak, setShowBreak] = useState(false);
  const [ending, setEnding] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loadedAt = Date.now();
      const split = await pendingSplit(loadedAt);
      if (resuming && split) {
        const resumed = await loadStoredState(loadedAt);
        if (cancelled) return;
        setLoaded({
          items: split.items,
          stage: split.stage,
          content: contentContextFor(resumed.progression),
          rest: false,
          splitAfterIndex: null,
          repertoire: { songs: resumed.songs, stage: split.stage, skills: resumed.skills },
        });
        setSessionId(split.sessionId);
        setResumedSplit(split);
        setState(resumeSplit(split.state, now()));
        return;
      }
      // "시작" while today's first half is kept: that half ends as it is (it counts) and a new session starts.
      if (split) await closeSplit(split);
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
        splitAfterIndex: plan.kind === 'rest' ? null : plan.splitAfterIndex,
        repertoire: { songs: stored.songs, stage: stored.progression.stage, skills: stored.skills },
      });
      if (plan.kind === 'rest') return;
      const id = newId();
      setSessionId(id);
      await repo.startSession({
        id,
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
  }, [resuming, now]);

  // Once per second: item budget display and the 30-minute break reminder (decided outside the state updater).
  const stateRef = useRef<SessionState | null>(null);
  stateRef.current = state;
  useEffect(() => {
    const id = setInterval(() => {
      setTick((t) => t + 1);
      const s = stateRef.current;
      if (s && !s.paused && breakDue(s, now())) {
        setShowBreak(true);
        setState(acknowledgeBreak(s, now()));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [now]);

  const items = loaded?.items ?? [];
  const go = useCallback((step: (s: SessionState) => SessionState) => {
    setEndedIndex(null);
    setLastAttempt(null);
    setTransitionEndsAt(null);
    setRerun({ n: 0, params: null, identity: null });
    setState((s) => (s ? step(s) : s));
  }, []);
  const advance = useCallback(() => {
    go((s) => completeItem(s, items, now()));
    const index = state?.index ?? 0;
    if (blockTransition && opensNewBlock(items[index], items[index + 1]))
      setTransitionEndsAt(now() + BLOCK_TRANSITION_MS);
  }, [go, items, now, state?.index, blockTransition]);
  const endTransition = useCallback(() => {
    setTransitionEndsAt(null);
    // The block's own time starts after the transition screen (§7.3-13).
    setState((s) => (s ? restartItemClock(s, now()) : s));
  }, [now]);

  // Block end signal (§7.3-12): a short cue and a big "블록 끝" once the item's block time is used up.
  useEffect(() => {
    if (!state || state.paused || transitionEndsAt !== null) return;
    const item = items[state.index];
    if (!item || item.exerciseType === 'REST' || blockEndedFor === item.id) return;
    if (itemRemainingSec(state, items, now()) === 0) {
      setBlockEndedFor(item.id);
      createExerciseOutput(audioEngine, metronome).cue('end');
    }
  });
  useEffect(() => {
    if (transitionEndsAt === null) return;
    const id = setInterval(() => {
      if (now() >= transitionEndsAt) endTransition();
    }, 100);
    return () => clearInterval(id);
  }, [transitionEndsAt, endTransition, now]);
  /** The current item again: with the params it just ran with, or with `params` (e.g. a suggested tempo). */
  const retry = useCallback((params?: unknown, identity?: RunIdentity | null) => {
    setEndedIndex(null);
    setRerun((r) => ({
      n: r.n + 1,
      params: params === undefined ? r.params : params,
      identity: identity === undefined ? r.identity : identity,
    }));
  }, []);

  // The resumed half's progress goes back into its kept record (reload / leave → resume there, §7.3-11).
  const progressKey = state ? `${state.index}:${state.recorded.length}` : '';
  useEffect(() => {
    if (!resumedSplit || !stateRef.current || !progressKey) return;
    void saveSplitProgress(resumedSplit, stateRef.current, now());
  }, [resumedSplit, progressKey, now]);

  /** "이어서 한 번 더" at the ladder's next tempo while block time remains (§7.3-12). */
  const repeat = (() => {
    const item = state ? items[state.index] : undefined;
    if (!item || !lastAttempt || !loaded || !REPEATABLE_TYPES.has(item.exerciseType)) return undefined;
    return repeatSuggestion(item, lastAttempt, loaded.repertoire) ?? undefined;
  })();

  // Keyboard / pedal between runs (§12.3); during a run the exercise's own keys apply.
  const between = state !== null && !runActive && !ending && !isFinished(state, items);
  useEffect(() => {
    if (!between || !state) return;
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (transitionEndsAt !== null) {
        // Transition screen: Enter / Space / → start the block now, ← goes back.
        const action = actionForKey(event, customKeys ?? {});
        if (action === 'next' || action === 'toggle') {
          if (isNativeActivation(event)) return;
          event.preventDefault();
          endTransition();
        } else if (action === 'prev') {
          event.preventDefault();
          go((s) => previousItem(s, now()));
        }
        return;
      }
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
        retry(repeat?.params, repeat?.identity);
      } else if (command === 'advance') advance();
      else if (command === 'previous') go((s) => previousItem(s, now()));
      else setState(resume(state, now()));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    between,
    state,
    items,
    endedIndex,
    customKeys,
    advance,
    go,
    retry,
    now,
    transitionEndsAt,
    endTransition,
    repeat,
  ]);

  const finishSession = async (report: SelfReport) => {
    if (!state || !sessionId) return;
    await repo.finishSession(sessionId, Date.now(), state.recorded.length, report, practiceMs(state, now()));
    await clearSplit(sessionId);
    navigate('/');
  };

  /** "여기서 나눠 하기": keep the second half for later today; the session stays open until it ends (§7.3-11). */
  const splitSession = async () => {
    if (!state || !sessionId || !loaded) return;
    await repo.setMeta(
      SPLIT_RESUME_KEY,
      splitHere(sessionId, dayKey(Date.now()), loaded.stage, loaded.items, state, now()),
    );
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
  if (!state || !sessionId) return <Screen title={ko.session.title}>{null}</Screen>;

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
        data-block={item.block}
        data-count={items.length}
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
      {blockEndedFor === item.id && transitionEndsAt === null && (
        <p
          role="status"
          className="mb-3 rounded-lg bg-surface-2 p-4 text-center text-4xl font-black"
          data-testid="block-end"
        >
          {ko.session.blockEnd}
        </p>
      )}
      {transitionEndsAt !== null ? (
        <section
          className="flex flex-col items-center gap-3 rounded-lg bg-surface p-6 text-center"
          data-testid="block-transition"
        >
          <p className="text-muted">{ko.session.transitionNext(ko.home.blocks[item.block])}</p>
          <p className="text-3xl font-bold">{itemTitle(item)}</p>
          {item.exerciseType === 'E1' && typeof item.params.voicingId === 'string' && (
            <div className="w-40">
              <ChordDiagram voicing={voicingById(item.params.voicingId)} leftHanded={leftHanded} />
            </div>
          )}
          <p className="tabular-nums">
            {ko.session.transitionIn(Math.max(0, Math.ceil((transitionEndsAt - now()) / 1000)))}
          </p>
          <Button large autoFocus onClick={endTransition} data-testid="transition-start">
            {ko.session.transitionStart}
          </Button>
        </section>
      ) : state.paused ? (
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
          reviewOf={rerun.identity ? rerun.identity.reviewOf : (item.reviewOf ?? null)}
          routineKey={rerun.identity ? rerun.identity.routineKey : (item.key ?? null)}
          autoFocusStart
          onActiveChange={setRunActive}
          onFinished={(attempt) => {
            setEndedIndex(state.index);
            setLastAttempt(attempt);
            if (attempt) setState((s) => (s ? markRecorded(s, item.id) : s));
          }}
          renderAfter={(attempt) => {
            const tempo = attempt ? definition.suggestedTempoRetry(attempt.params, attempt.result) : null;
            const repeatable = REPEATABLE_TYPES.has(item.exerciseType) && budget > 0 && attempt !== null;
            const suggestion = attempt ? repeatSuggestion(item, attempt, loaded.repertoire) : null;
            return (
              <div className="mt-4 flex flex-wrap gap-2">
                {repeatable && (
                  <Button
                    large
                    onClick={() => retry(suggestion?.params, suggestion?.identity)}
                    data-testid="repeat-item"
                  >
                    {suggestion ? suggestion.label : ko.session.repeat}
                  </Button>
                )}
                <Button large variant="secondary" onClick={() => retry()} data-testid="retry-item">
                  {repeatable ? ko.session.sameTempo : tempo ? ko.session.retrySameTempo : ko.session.retry}
                </Button>
                {tempo && !repeatable && (
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
      {!runActive && atSplitPoint(state, loaded.splitAfterIndex) && (
        <div className="mt-4 rounded-lg bg-surface p-4" data-testid="split-point">
          <p>{ko.session.splitPoint}</p>
          <Button
            className="mt-2"
            variant="secondary"
            onClick={() => void splitSession()}
            data-testid="split-session"
          >
            {ko.session.splitHere}
          </Button>
        </div>
      )}
      {runActive && <p className="mt-2 text-sm text-muted">{ko.session.finishRunFirst}</p>}
    </Screen>
  );
}
