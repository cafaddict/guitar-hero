/**
 * Calibration wizard steps (SPEC §9.1). Each step owns its microphone job and reports its result upward;
 * the rules themselves live in calibrationModel.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { useEngineStatus } from '../../app/audioHooks';
import { audioEngine, captureReady, metronome } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { isBluetoothLabel } from '../../audio/devices';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import type { TemplateResult } from '../../audio/worker/protocol';
import { STRING_COUNT, STRING_INDICES, stringNumber } from '../../domain/strings';
import { centsBetween, midiName, STANDARD_TUNING } from '../../domain/theory';
import { DEFAULT_RTT_PARAMS, type RttResult, rttProbe, tapRttStats } from '../../dsp/rtt';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { CentsNeedle } from '../../ui/CentsNeedle';
import { EnvironmentGuide } from '../../ui/EnvironmentGuide';
import { Field, Select } from '../../ui/Field';
import { TuningDirection } from '../../ui/TuningDirection';
import { CaptureWarnings, MicStatusPanel } from '../mic/MicStatusPanel';
import {
  aggregateTemplate,
  decideLoopback,
  judgeTuning,
  type LoopbackMeasurement,
  NOISE_CHECK_S,
  NOISE_WARN_DBFS,
  openStringHz,
  TEMPLATE_PLUCKS,
  type TemplateSample,
  TUNING_PASS_CENTS,
  type TuningVerdict,
} from './calibrationModel';

export interface NoiseResult {
  noiseDbfs: number;
  thirdOctaveDb: number[];
}

export interface TuningResult {
  cents: (number | null)[];
  firstReadings: { measuredHz: number; expectedHz: number }[];
  /** Strings skipped with "다른 튜너로 이미 맞췄어요" (δ = 0, SPEC v1.1 §9.3). */
  skipped: boolean[];
}

export type StringTemplate = { harmonics: number[]; decayRatio: number };

export interface RttOutcome {
  rttMs: number;
  madMs: number;
  method: 'loopback' | 'tap';
  agreeing?: [number, number];
}

const noteOf = (idx: number) => midiName(STANDARD_TUNING.openMidi[idx]!);
const ADVANCE_DELAY_MS = 600;
const PROBE_GAIN = 0.8;

// --- 1. permission & device -----------------------------------------------------------------

export function PermissionStep({
  onNext,
  onWithoutMic,
  onLater,
}: {
  onNext: () => void;
  onWithoutMic: () => void;
  onLater: () => void;
}) {
  const status = useEngineStatus();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const running = status.kind === 'running';
  const start = (deviceId = settings?.preferredInputDeviceId ?? null) =>
    void audioEngine.startMic({ deviceId });

  useEffect(() => {
    if (running) void audioEngine.inputDevices().then(setDevices);
  }, [running]);

  const choose = async (value: string) => {
    const id = value === '' ? null : value;
    await updateSettings({ preferredInputDeviceId: id });
    audioEngine.stopMic();
    start(id);
  };

  return (
    <div>
      <p className="text-lg">{ko.onboarding.permission.explain}</p>
      {!running && status.kind !== 'error' && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-3" data-primary-action>
            <Button large onClick={() => start()} disabled={status.kind === 'starting'}>
              {ko.onboarding.permission.allow}
            </Button>
            <Button large variant="secondary" onClick={onWithoutMic}>
              {ko.common.withoutMic}
            </Button>
          </div>
          <Button variant="ghost" onClick={onLater}>
            {ko.common.later}
          </Button>
        </div>
      )}
      <MicStatusPanel status={status} onRetry={() => start()} onWithoutMic={onWithoutMic} />
      {running && (
        <div className="mt-4">
          <p className="text-ok">{ko.onboarding.permission.granted}</p>
          <p className="mt-1" data-testid="onboarding-device">
            {ko.onboarding.permission.device(audioEngine.diagnostics?.label ?? '')}
          </p>
          {devices.length > 1 && (
            <Field label={ko.diagnostics.chooseDevice} className="mt-2">
              <Select
                value={settings?.preferredInputDeviceId ?? ''}
                onChange={(e) => void choose(e.target.value)}
              >
                <option value="">{ko.diagnostics.defaultDevice}</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || d.deviceId}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <CaptureWarnings diagnostics={audioEngine.diagnostics} />
          <Button large className="mt-4" onClick={onNext}>
            {ko.common.next}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- 2. noise -------------------------------------------------------------------------------

export function NoiseStep({ onDone }: { onDone: (result: NoiseResult) => void }) {
  const [phase, setPhase] = useState<'idle' | 'measuring' | 'done'>('idle');
  const [result, setResult] = useState<NoiseResult | null>(null);
  const measure = async () => {
    setPhase('measuring');
    try {
      audioEngine.setJob(null);
      await captureReady();
      const from = (audioEngine.context?.currentTime ?? 0) + 0.05;
      const outcome = await audioEngine.analyzeRange(from, from + NOISE_CHECK_S, { kind: 'noise' });
      setResult(outcome.result as NoiseResult);
      setPhase('done');
    } catch {
      setPhase('idle');
    }
  };
  return (
    <div>
      <p>{ko.onboarding.noise.explain}</p>
      <div className="mt-3">
        <EnvironmentGuide />
      </div>
      {phase !== 'done' && (
        <Button large className="mt-4" onClick={() => void measure()} disabled={phase === 'measuring'}>
          {phase === 'measuring' ? ko.onboarding.noise.measuring : ko.onboarding.noise.measure}
        </Button>
      )}
      {phase === 'done' && result && (
        <div className="mt-4">
          <p data-testid="noise-result">{ko.onboarding.noise.result(result.noiseDbfs)}</p>
          <p className={result.noiseDbfs > NOISE_WARN_DBFS ? 'text-retry' : 'text-ok'}>
            {result.noiseDbfs > NOISE_WARN_DBFS ? ko.onboarding.noise.noisy : ko.onboarding.noise.quiet}
          </p>
          <div className="mt-4 flex gap-2">
            <Button large onClick={() => onDone(result)}>
              {ko.common.next}
            </Button>
            <Button variant="secondary" onClick={() => void measure()}>
              {ko.onboarding.noise.again}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- 3. tuning ------------------------------------------------------------------------------

function verdictText(verdict: TuningVerdict | null): string {
  if (!verdict) return '';
  switch (verdict.kind) {
    case 'pass':
      return '';
    case 'tooLow':
      return ko.onboarding.tuning.tooLow;
    case 'tooHigh':
      return ko.onboarding.tuning.tooHigh;
    case 'otherNote':
      return ko.onboarding.tuning.otherNote;
  }
}

export function TuningStep({ onDone }: { onDone: (result: TuningResult) => void }) {
  const headStyle = useSettingsStore((s) => s.settings?.headStyle ?? '3+3');
  const [idx, setIdx] = useState(0);
  const [cents, setCents] = useState<(number | null)[]>(() => Array(STRING_COUNT).fill(null));
  const [live, setLive] = useState<{ cents: number | null; verdict: TuningVerdict | null }>({
    cents: null,
    verdict: null,
  });
  const firstReadings = useRef(new Map<number, { measuredHz: number; expectedHz: number }>());
  const done = idx >= STRING_COUNT;

  useEffect(() => {
    if (done) {
      audioEngine.setTuner(false, null);
      return;
    }
    const expected = openStringHz(idx);
    audioEngine.setJob(null);
    audioEngine.setTuner(true, expected);
    let advancing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = audioEngine.tuner.on((update) => {
      if (advancing) return;
      if (update.stableF0 === null) {
        if (update.reading) setLive((l) => ({ ...l, cents: centsBetween(update.reading!.f0, expected) }));
        return;
      }
      const verdict = judgeTuning(update.stableF0, expected);
      if (verdict.kind !== 'otherNote' && !firstReadings.current.has(idx)) {
        firstReadings.current.set(idx, { measuredHz: update.stableF0, expectedHz: expected });
      }
      setLive({ cents: verdict.cents, verdict });
      if (verdict.kind !== 'pass') return;
      advancing = true;
      setCents((prev) => prev.map((c, i) => (i === idx ? verdict.cents : c)));
      timer = setTimeout(() => {
        setLive({ cents: null, verdict: null });
        setIdx((i) => i + 1);
      }, ADVANCE_DELAY_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
      audioEngine.setTuner(false, null);
    };
  }, [idx, done]);

  return (
    <div>
      <p>{ko.onboarding.tuning.explain}</p>
      <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STRING_INDICES.map((i) => (
          <li
            key={i}
            className={`rounded-lg p-2 text-center ${cents[i] !== null ? 'bg-ok/20' : i === idx ? 'bg-accent/20' : 'bg-surface-2'}`}
            data-testid={`tuning-string-${stringNumber(i)}`}
            data-passed={cents[i] !== null}
          >
            <span className="block font-semibold">{ko.common.stringLabel(stringNumber(i), noteOf(i))}</span>
            <span className="text-sm">{cents[i] === null ? '—' : ko.common.cents(cents[i]!)}</span>
          </li>
        ))}
      </ol>
      {!done ? (
        <section className="mt-4 card rounded-2xl border border-border bg-surface p-4" aria-live="polite">
          <p className="text-xl font-bold" data-testid="tuning-target" data-string={stringNumber(idx)}>
            {ko.onboarding.tuning.target(stringNumber(idx), noteOf(idx))}
          </p>
          <div className="mt-3">
            <CentsNeedle
              cents={live.cents}
              passCents={TUNING_PASS_CENTS}
              label={ko.onboarding.stepNames.tuning}
            />
          </div>
          <div className="mt-2">
            <TuningDirection cents={live.cents} stringIdx={idx} head={headStyle} />
          </div>
          <p className="mt-2 text-retry">{verdictText(live.verdict)}</p>
          {live.verdict?.kind === 'pass' && (
            <p className="mt-2 text-ok">
              {ko.onboarding.tuning.passed(stringNumber(idx), live.verdict.cents)}
            </p>
          )}
          <Button
            className="mt-3"
            variant="secondary"
            onClick={() =>
              onDone({
                cents: cents.map((c) => c ?? 0),
                skipped: cents.map((c) => c === null),
                firstReadings: [...firstReadings.current.values()],
              })
            }
            data-testid="tuning-skip"
          >
            {ko.tuningGuide.skip}
          </Button>
        </section>
      ) : (
        <div className="mt-4">
          <p className="text-ok" data-testid="tuning-done">
            {ko.onboarding.tuning.done}
          </p>
          <Button
            large
            className="mt-3"
            onClick={() =>
              onDone({
                cents,
                skipped: cents.map(() => false),
                firstReadings: [...firstReadings.current.values()],
              })
            }
          >
            {ko.common.next}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- 4. string templates --------------------------------------------------------------------

export function TemplateStep({
  tuningCents,
  onDone,
}: {
  tuningCents: readonly (number | null)[];
  onDone: (templates: (StringTemplate | null)[]) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [count, setCount] = useState(0);
  const [retry, setRetry] = useState(false);
  const [templates, setTemplates] = useState<(StringTemplate | null)[]>(() => Array(STRING_COUNT).fill(null));
  const done = idx >= STRING_COUNT;

  useEffect(() => {
    if (done) {
      audioEngine.setJob(null);
      return;
    }
    audioEngine.setTuner(false, null);
    audioEngine.setJob({ kind: 'template', expectedF0: openStringHz(idx, tuningCents[idx] ?? 0) });
    const samples: TemplateSample[] = [];
    let advancing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = audioEngine.onset.on((onset) => {
      if (advancing || onset.jobKind !== 'template') return;
      const result = onset.result as TemplateResult;
      if (result.pluck.status !== 'OK') {
        setRetry(true);
        return;
      }
      setRetry(false);
      samples.push({ harmonics: result.harmonics, decayRatio: result.pluck.decayRatio });
      setCount(samples.length);
      if (samples.length < TEMPLATE_PLUCKS) return;
      const template = aggregateTemplate(samples);
      if (!template) {
        samples.length = 0;
        setCount(0);
        setRetry(true);
        return;
      }
      advancing = true;
      setTemplates((prev) => prev.map((t, i) => (i === idx ? template : t)));
      timer = setTimeout(() => {
        setCount(0);
        setIdx((i) => i + 1);
      }, ADVANCE_DELAY_MS);
    });
    return () => {
      off();
      clearTimeout(timer);
      audioEngine.setJob(null);
    };
  }, [idx, done, tuningCents]);

  return (
    <div>
      <p>{ko.onboarding.templates.explain}</p>
      <ol className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STRING_INDICES.map((i) => (
          <li
            key={i}
            className={`rounded-lg p-2 text-center ${templates[i] ? 'bg-ok/20' : i === idx ? 'bg-accent/20' : 'bg-surface-2'}`}
            data-testid={`template-string-${stringNumber(i)}`}
            data-done={templates[i] !== null}
          >
            {ko.common.stringLabel(stringNumber(i), noteOf(i))}
          </li>
        ))}
      </ol>
      {!done ? (
        <section className="mt-4 card rounded-2xl border border-border bg-surface p-4" aria-live="polite">
          <p className="text-xl font-bold" data-testid="template-target" data-string={stringNumber(idx)}>
            {ko.onboarding.templates.target(stringNumber(idx), noteOf(idx))}
          </p>
          <p className="mt-2 text-3xl font-bold tabular-nums" data-testid="template-count">
            {ko.onboarding.templates.count(count, TEMPLATE_PLUCKS)}
          </p>
          {retry && <p className="mt-2 text-retry">{ko.onboarding.templates.retry}</p>}
        </section>
      ) : (
        <div className="mt-4">
          <p className="text-ok" data-testid="templates-done">
            {ko.onboarding.templates.done}
          </p>
          <Button large className="mt-3" onClick={() => onDone(templates)}>
            {ko.common.next}
          </Button>
        </div>
      )}
    </div>
  );
}

// --- 5. round-trip latency ------------------------------------------------------------------

/** One loopback run: 8 probe bursts through the speaker, matched-filtered in the recording (SPEC §10.8). */
async function measureLoopbackOnce(): Promise<LoopbackMeasurement> {
  try {
    await captureReady();
    const ctx = await audioEngine.ensureContext();
    const probe = rttProbe(ctx.sampleRate).map((x) => x * PROBE_GAIN);
    const t0 = ctx.currentTime + 0.3;
    const times = DEFAULT_RTT_PARAMS.offsetsS.map((o) => t0 + o);
    for (const t of times) audioEngine.scheduleSamples(probe, t);
    const lastOffset = DEFAULT_RTT_PARAMS.offsetsS.at(-1) ?? 0;
    const outcome = await audioEngine.analyzeRange(
      t0 - 0.05,
      t0 + lastOffset + DEFAULT_RTT_PARAMS.maxRttMs / 1000 + 0.05,
      {
        kind: 'rtt',
        scheduledSamples: times.map((t) => audioEngine.timeToSample(t)),
      },
    );
    const result = outcome.result as RttResult;
    return result.ok
      ? { ok: true, rttMs: result.rttMs, madMs: result.madMs }
      : { ok: false, reason: result.reason };
  } catch {
    return { ok: false, reason: 'ERROR' };
  }
}

/** Tap fallback: 4 count-in clicks, then 8 clicks at 80 BPM to strum along with. */
async function measureTapOnce(): Promise<{ rttMs: number; madMs: number } | null> {
  audioEngine.setJob({ kind: 'onsets' });
  const clicks: number[] = [];
  const strums: number[] = [];
  const offClick = metronome.click.on((c) => {
    if (!c.countIn) clicks.push(c.time);
  });
  const offOnset = audioEngine.onset.on((o) => strums.push(o.time));
  try {
    await new Promise<void>((resolve) => {
      const offEnd = metronome.end.on(() => {
        offEnd();
        resolve();
      });
      void metronome.start({
        ...DEFAULT_METRONOME_CONFIG,
        bpm: 80,
        countInBars: 1,
        stopAfterBars: 2,
        visualOnly: false,
        mutedBars: null,
      });
    });
    // Judged onsets reach the main thread ~0.4 s after the strum (segment end).
    await new Promise((resolve) => setTimeout(resolve, 800));
  } finally {
    offClick();
    offOnset();
    audioEngine.setJob(null);
  }
  const stats = tapRttStats(clicks, strums);
  return stats ? { rttMs: stats.rttMs, madMs: stats.madMs } : null;
}

type RttPhase = 'ready' | 'measuring' | 'tapReady' | 'tapRunning' | 'tapFailed' | 'done';

export function RttStep({ onDone }: { onDone: (result: RttOutcome) => void }) {
  const [phase, setPhase] = useState<RttPhase>('ready');
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<LoopbackMeasurement[]>([]);
  const [runs, setRuns] = useState(0);
  const [result, setResult] = useState<RttOutcome | null>(null);
  const [bluetoothOutput, setBluetoothOutput] = useState(false);

  useEffect(() => {
    void audioEngine.deviceLabels().then((labels) => {
      if (isBluetoothLabel(labels.output)) {
        setBluetoothOutput(true);
        setPhase('tapReady');
      }
    });
    return () => metronome.stop();
  }, []);

  const runLoopback = async () => {
    setPhase('measuring');
    audioEngine.setJob(null);
    audioEngine.setTuner(false, null);
    const measurements: LoopbackMeasurement[] = [];
    for (;;) {
      setAttempt(measurements.length + 1);
      const measurement = await measureLoopbackOnce();
      measurements.push(measurement);
      setHistory((all) => [...all, measurement]);
      const decision = decideLoopback(measurements);
      if (decision.kind === 'done') {
        setResult({
          rttMs: decision.rttMs,
          madMs: decision.madMs,
          method: 'loopback',
          agreeing: decision.agreeing,
        });
        setRuns((n) => n + 1);
        setPhase('done');
        return;
      }
      if (decision.kind === 'fallback') {
        setPhase('tapReady');
        return;
      }
    }
  };

  const runTap = async () => {
    setPhase('tapRunning');
    const tap = await measureTapOnce();
    if (!tap) {
      setPhase('tapFailed');
      return;
    }
    setResult({ ...tap, method: 'tap' });
    setRuns((n) => n + 1);
    setPhase('done');
  };

  return (
    <div>
      {phase === 'ready' && (
        <>
          <p>{ko.onboarding.rtt.explain}</p>
          <Button large className="mt-4" onClick={() => void runLoopback()}>
            {ko.onboarding.rtt.measure}
          </Button>
        </>
      )}
      {phase === 'measuring' && <p aria-live="polite">{ko.onboarding.rtt.measuring(attempt)}</p>}
      {(phase === 'tapReady' || phase === 'tapFailed') && (
        <>
          <p className="text-retry">
            {phase === 'tapFailed'
              ? ko.onboarding.rtt.tapFailed
              : bluetoothOutput
                ? ko.onboarding.rtt.bluetooth
                : ko.onboarding.rtt.failed}
          </p>
          <p className="mt-2">{ko.onboarding.rtt.tapExplain}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button large onClick={() => void runTap()}>
              {ko.onboarding.rtt.tapStart}
            </Button>
            <Button variant="secondary" onClick={() => void runLoopback()}>
              {ko.onboarding.rtt.tryLoopback}
            </Button>
          </div>
        </>
      )}
      {phase === 'tapRunning' && <p aria-live="polite">{ko.onboarding.rtt.tapRunning}</p>}
      {phase === 'done' && result && (
        <div className="mt-2">
          <p
            className="text-xl font-bold"
            data-testid="rtt-result"
            data-rtt-ms={result.rttMs}
            data-method={result.method}
            data-run={runs}
          >
            {ko.onboarding.rtt.result(result.rttMs)}
          </p>
          {result.agreeing && (
            <p data-testid="rtt-agreeing" data-values={result.agreeing.join(',')}>
              {ko.onboarding.rtt.agreeing(result.agreeing[0], result.agreeing[1])}
            </p>
          )}
          {/* Every loopback attempt of every run, in order ('x' = failed); read by E2E-01. */}
          <p
            hidden
            data-testid="rtt-history"
            data-values={history.map((m) => (m.ok ? m.rttMs : 'x')).join(',')}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button large onClick={() => onDone(result)}>
              {ko.common.next}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void (result.method === 'tap' ? runTap() : runLoopback())}
            >
              {ko.onboarding.rtt.again}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
