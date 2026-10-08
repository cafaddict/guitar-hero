/**
 * Hosts one exercise run: microphone start (inside the tap, iOS), context assembly, the requestAnimationFrame
 * tick, keyboard/pedal commands (Esc asks first), Wake Lock, and saving the Attempt when the runner is done.
 * Used standalone (/practice/:type) and by the session runner.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import { actionForKey, isEditableTarget, isNativeActivation } from '../../app/keys';
import { audioEngine, captureReady, metronome, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { simulatedRate } from '../../app/testRate';
import { wakeLock } from '../../audio/wakeLock';
import { newId } from '../../domain/ids';
import type { Attempt } from '../../domain/records';
import { personalOffset } from '../../dsp/timing';
import { MicStatusPanel } from '../../features/mic/MicStatusPanel';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { createExerciseMic, createExerciseOutput } from '../audioAdapter';
import { contentContextFor } from '../contentContext';
import type { ExerciseDefinition } from '../registry';
import type { ExerciseContext, ExerciseRunner } from '../types';
import { useRunnerSnapshot } from './hooks';

export interface ExerciseHostProps {
  definition: ExerciseDefinition;
  params: unknown;
  sessionId?: string | null;
  reviewOf?: string | null;
  /** Routine item key stored on the attempt (last-appearance tracking, SPEC v1.1 §7.3). */
  routineKey?: string | null;
  /** Called when the run ended: the stored Attempt, or null when there was nothing to record. */
  onFinished?: (attempt: Attempt | null) => void;
  /** Extra actions under the summary (e.g. "again" / "home" in standalone mode). */
  renderAfter?: (attempt: Attempt | null) => React.ReactNode;
  /** Focus the start button (session runner: keyboard-only flow). */
  autoFocusStart?: boolean;
  /** True from the start tap until the run ended (the session runner locks its navigation meanwhile). */
  onActiveChange?: (active: boolean) => void;
}

interface Running {
  runner: ExerciseRunner<unknown, unknown>;
  ctx: ExerciseContext;
  startedAt: number;
  /** Params of this run (after history adjustments) — stored in the Attempt. */
  params: unknown;
}

/**
 * Stable personal lead/lag from the latest timing runs of this exercise (≥ 3 runs, SPEC §10.8): the mean strum
 * offset (E5) or the beat-1 delay (E6).
 */
function personalOffsetFrom(recent: readonly Attempt[]): number | null {
  const offsets = recent
    .map((a) => {
      if (typeof a.result !== 'object' || a.result === null) return undefined;
      const r = a.result as { meanOffsetMs?: unknown; beat1DelayMsMean?: unknown };
      return r.meanOffsetMs ?? r.beat1DelayMsMean;
    })
    .filter((x): x is number => typeof x === 'number');
  return personalOffset(offsets);
}

function useAnimationTick(runner: ExerciseRunner<unknown, unknown> | null): void {
  useEffect(() => {
    if (!runner) return;
    let frame = 0;
    const loop = () => {
      runner.tick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [runner]);
}

function RunningExercise({
  definition,
  params,
  running,
  onDone,
}: {
  definition: ExerciseDefinition;
  params: unknown;
  running: Running;
  onDone: () => void;
}) {
  const { runner, ctx } = running;
  const snapshot = useRunnerSnapshot(runner);
  const settings = useSettingsStore((s) => s.settings);
  const [confirmAbort, setConfirmAbort] = useState(false);
  useAnimationTick(runner);

  useEffect(() => {
    if (snapshot.phase === 'done') onDone();
  }, [snapshot.phase, onDone]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const action = actionForKey(event, settings?.customKeys ?? {});
      if (confirmAbort) {
        event.preventDefault();
        if (action === 'abort' || action === 'next') runner.command('abort');
        setConfirmAbort(false);
        return;
      }
      if (!action) return;
      event.preventDefault();
      if (action === 'abort') setConfirmAbort(true);
      else runner.command(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runner, confirmAbort, settings?.customKeys]);

  return (
    <div>
      {definition.renderView({ runner, params, ctx })}
      {!ctx.audio && definition.usesMicrophone && (
        <p className="mt-2 text-sm text-muted">{ko.exercises.common.noMic}</p>
      )}
      {confirmAbort && (
        <div role="alertdialog" aria-label={ko.keys.confirmAbort} className="mt-4 rounded-lg bg-surface p-4">
          <p>{ko.keys.confirmAbort}</p>
          <div className="mt-2 flex gap-2">
            <Button onClick={() => runner.command('abort')}>{ko.keys.abortYes}</Button>
            <Button variant="secondary" onClick={() => setConfirmAbort(false)}>
              {ko.keys.abortNo}
            </Button>
          </div>
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => runner.command('abort')} data-testid="exercise-finish">
          {ko.exercises.common.finish}
        </Button>
        <p className="text-xs text-muted">{ko.keys.hint}</p>
      </div>
    </div>
  );
}

type Outcome =
  | { kind: 'saved'; attempt: Attempt }
  | { kind: 'nothing' }
  | { kind: 'saveFailed'; attempt: Attempt };

export function ExerciseHost({
  definition,
  params,
  sessionId = null,
  reviewOf = null,
  routineKey = null,
  onFinished,
  renderAfter,
  autoFocusStart = false,
  onActiveChange,
}: ExerciseHostProps) {
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const status = useEngineStatus();
  const [running, setRunning] = useState<Running | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [micFailed, setMicFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  useMicReleasedOnExit();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const active = starting || (running !== null && outcome === null);
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  useEffect(() => {
    onActiveChangeRef.current?.(active);
    return () => onActiveChangeRef.current?.(false);
  }, [active]);

  useEffect(
    () => () => {
      metronome.stop();
      void wakeLock().disable();
    },
    [],
  );

  useEffect(
    () => () => {
      running?.runner.dispose();
    },
    [running],
  );

  const wantsMic = definition.usesMicrophone && !(settings?.micDisabled ?? false);

  const begin = async (withMic: boolean) => {
    // One start per host: a double tap must not create two runners sharing the engine and metronome.
    if (startingRef.current) return;
    startingRef.current = true;
    setStarting(true);
    // The first audio call happens synchronously inside the tap (iOS gesture rule).
    let micOk = false;
    if (withMic) micOk = await audioEngine.startMic({ deviceId: settings?.preferredInputDeviceId ?? null });
    else await audioEngine.ensureContext();
    if (withMic && !micOk) {
      setMicFailed(true);
      startingRef.current = false;
      setStarting(false);
      return;
    }
    if (micOk) await captureReady();
    const labels = micOk ? await audioEngine.deviceLabels() : null;
    const calibration = await repo.latestCalibration(labels?.input, labels?.output);
    const progression = await repo.progression(Date.now());
    const recent = await repo.recentAttempts(definition.type, 5);
    const rate = simulatedRate();
    const current = settings ?? (await repo.settings());
    const ctx: ExerciseContext = {
      audio: micOk ? createExerciseMic(audioEngine) : null,
      output: createExerciseOutput(audioEngine, metronome),
      clock: { now: () => performance.now() * rate },
      content: contentContextFor(progression),
      calibration,
      settings: {
        strictness: current.strictness,
        xStringCheck: current.xStringCheck,
        leftHanded: current.leftHanded,
        visualOnlyMetronome: current.visualOnlyMetronome,
      },
      personalOffsetMs: personalOffsetFrom(recent),
    };
    const runParams = definition.withHistory(
      params,
      recent.map((a) => a.result),
    );
    // Left while the microphone was starting: no orphan runner (it would hold the engine and metronome).
    if (!mountedRef.current) return;
    const runner = definition.createRunner(ctx, runParams);
    void wakeLock().enable();
    setRunning({ runner, ctx, startedAt: Date.now(), params: runParams });
    setStarting(false);
    runner.start();
  };

  // Not started yet: Space or next (Enter on the page, PageDown, →, a learned pedal) starts the run (§12.3).
  const idle = running === null && outcome === null && !starting && !micFailed;
  useEffect(() => {
    if (!idle) return;
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || isNativeActivation(event)) return;
      const action = actionForKey(event, settings?.customKeys ?? {});
      if (action !== 'toggle' && action !== 'next') return;
      event.preventDefault();
      void begin(wantsMic);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const withoutMic = async () => {
    await updateSettings({ micDisabled: true });
    setMicFailed(false);
    await begin(false);
  };

  const save = useCallback(
    (attempt: Attempt) => {
      repo
        .recordAttempt(attempt)
        .then(() => {
          setOutcome({ kind: 'saved', attempt });
          onFinished?.(attempt);
        })
        .catch(() => setOutcome({ kind: 'saveFailed', attempt }));
    },
    [onFinished],
  );

  const onDone = useCallback(() => {
    if (!running || finishedRef.current) return;
    finishedRef.current = true;
    const { runner, startedAt } = running;
    audioEngine.setJob(null);
    metronome.stop();
    void wakeLock().disable();
    // Aborted before anything happened, or never scored: no Attempt (nothing to turn into metrics).
    if (!runner.hasResult()) {
      setOutcome({ kind: 'nothing' });
      onFinished?.(null);
      return;
    }
    const result = definition.resultSchema.parse(runner.finish());
    const stats = runner.dspStats();
    save({
      id: newId(),
      sessionId,
      exerciseType: definition.type,
      exerciseVersion: definition.version,
      startedAt,
      endedAt: Date.now(),
      params: running.params,
      result,
      detectorVersion: stats.events > 0 ? stats.detectorVersion : null,
      processingMs: stats.meanProcessingMs,
      reviewOf,
      ...(routineKey ? { routineKey } : {}),
    });
  }, [running, definition, sessionId, reviewOf, routineKey, onFinished, save]);

  if (outcome?.kind === 'saved') {
    return (
      <section aria-live="polite" data-testid="exercise-summary">
        <p className="mb-2 text-ok">{ko.exercises.common.saved}</p>
        {definition.renderSummary({ result: outcome.attempt.result, params: outcome.attempt.params })}
        {renderAfter?.(outcome.attempt)}
      </section>
    );
  }
  if (outcome?.kind === 'nothing') {
    return (
      <section aria-live="polite" data-testid="exercise-nothing">
        <p>{ko.exercises.common.nothingToSave}</p>
        {renderAfter?.(null)}
      </section>
    );
  }
  if (outcome?.kind === 'saveFailed') {
    const attempt = outcome.attempt;
    return (
      <section role="alert">
        <p className="text-fail">{ko.exercises.common.saveFailed}</p>
        <Button className="mt-2" onClick={() => save(attempt)}>
          {ko.common.retry}
        </Button>
      </section>
    );
  }
  if (running)
    return (
      <RunningExercise definition={definition} params={running.params} running={running} onDone={onDone} />
    );
  return (
    <section>
      {micFailed && (
        <MicStatusPanel
          status={status}
          onRetry={() => void begin(true)}
          onWithoutMic={() => void withoutMic()}
        />
      )}
      {!micFailed && (
        <div className="flex flex-wrap gap-2">
          {wantsMic ? (
            <>
              <Button
                large
                disabled={starting}
                autoFocus={autoFocusStart}
                onClick={() => void begin(true)}
                data-testid="exercise-start"
              >
                {ko.exercises.common.startWithMic}
              </Button>
              <Button large variant="secondary" disabled={starting} onClick={() => void begin(false)}>
                {ko.common.withoutMic}
              </Button>
            </>
          ) : (
            <Button
              large
              disabled={starting}
              autoFocus={autoFocusStart}
              onClick={() => void begin(false)}
              data-testid="exercise-start"
            >
              {ko.exercises.common.start}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
