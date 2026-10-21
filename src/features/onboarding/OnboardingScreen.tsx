import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import { audioEngine, metronome, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import { newId } from '../../domain/ids';
import { STRING_INDICES, stringNumber } from '../../domain/strings';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { MicStatusPanel } from '../mic/MicStatusPanel';
import { buildCalibration, type CalibrationDraft, calibrationWarnings } from './calibrationModel';
import {
  type NoiseResult,
  NoiseStep,
  PermissionStep,
  type RttOutcome,
  RttStep,
  type StringTemplate,
  TemplateStep,
  type TuningResult,
  TuningStep,
} from './steps';

const STEPS = ['permission', 'noise', 'tuning', 'templates', 'rtt', 'summary'] as const;
type StepId = (typeof STEPS)[number];

function Summary({
  draft,
  onSave,
}: {
  draft: Omit<CalibrationDraft, 'id' | 'createdAt'>;
  onSave: () => void;
}) {
  const warnings = calibrationWarnings(draft);
  return (
    <div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="text-muted">{ko.onboarding.summary.noise}</dt>
        <dd data-testid="summary-noise">{ko.common.dbfs(draft.noise.noiseDbfs)}</dd>
        <dt className="text-muted">{ko.onboarding.summary.tuning}</dt>
        <dd>
          <ul className="flex flex-wrap gap-x-3">
            {STRING_INDICES.map((i) => (
              <li key={i}>
                {stringNumber(i)}: {ko.common.cents(draft.tuningCents[i] ?? 0)}
              </li>
            ))}
          </ul>
        </dd>
        <dt className="text-muted">{ko.onboarding.summary.rtt}</dt>
        <dd data-testid="summary-rtt">
          {ko.common.ms(draft.rtt.rttMs)} ({ko.onboarding.summary.methods[draft.rtt.method]})
        </dd>
        <dt className="text-muted">{ko.onboarding.summary.warnings}</dt>
        <dd>
          {warnings.length === 0 ? (
            ko.onboarding.summary.none
          ) : (
            <ul className="text-retry">
              {warnings.map((w) => (
                <li key={w}>{ko.onboarding.warnings[w]}</li>
              ))}
            </ul>
          )}
        </dd>
      </dl>
      <div className="mt-6" data-primary-action>
        <Button large onClick={onSave}>
          {ko.onboarding.summary.save}
        </Button>
      </div>
    </div>
  );
}

/** Onboarding / calibration wizard (SPEC §9.1): first run, and again from Settings > diagnostics. */
export function OnboardingScreen() {
  const navigate = useNavigate();
  const status = useEngineStatus();
  const updateSettings = useSettingsStore((s) => s.update);
  const [step, setStep] = useState<StepId>('permission');
  const [noise, setNoise] = useState<NoiseResult | null>(null);
  const [tuning, setTuning] = useState<TuningResult | null>(null);
  const [templates, setTemplates] = useState<(StringTemplate | null)[] | null>(null);
  const [rtt, setRtt] = useState<RttOutcome | null>(null);
  const [outputLabel, setOutputLabel] = useState('');
  useMicReleasedOnExit();
  useEffect(() => () => metronome.stop(), []);

  useEffect(() => {
    if (step === 'summary') void audioEngine.deviceLabels().then((l) => setOutputLabel(l.output));
  }, [step]);

  const withoutMic = async () => {
    await updateSettings({ micDisabled: true, micOnboardingDone: true });
    navigate('/');
  };

  const diagnostics = audioEngine.diagnostics;
  const draft =
    diagnostics && noise && tuning && templates && rtt
      ? {
          diagnostics,
          outputDeviceLabel: outputLabel,
          noise,
          tuningCents: tuning.cents,
          tuningSkipped: tuning.skipped,
          firstReadings: tuning.firstReadings,
          templates,
          rtt: { rttMs: rtt.rttMs, madMs: rtt.madMs, method: rtt.method },
        }
      : null;

  const save = async () => {
    if (!draft) return;
    const calibration = buildCalibration({ ...draft, id: newId(), createdAt: Date.now() });
    await repo.saveCalibration(calibration);
    await updateSettings({ micOnboardingDone: true, micDisabled: false });
    navigate('/');
  };

  const index = STEPS.indexOf(step);
  const midStepError = step !== 'permission' && (status.kind === 'error' || status.kind === 'interrupted');
  return (
    <Screen title={ko.onboarding.title}>
      {step === 'permission' && <p className="mb-5 text-lg text-muted">{ko.onboarding.intro}</p>}
      {/* Where the setup is: done steps filled, the current one filled and taller (like the session runner). */}
      <div aria-hidden="true" className="mb-3 flex max-w-md items-center gap-1.5">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`flex-1 rounded-full ${i < index ? 'h-1.5 bg-accent' : i === index ? 'h-3 bg-accent' : 'h-1.5 bg-surface-2'}`}
          />
        ))}
      </div>
      <p className="mb-4 text-lg font-semibold" data-testid="onboarding-progress">
        {ko.onboarding.stepOf(index + 1, STEPS.length, ko.onboarding.stepNames[step])}
      </p>
      {midStepError && (
        <MicStatusPanel
          status={status}
          onRetry={() => void audioEngine.startMic()}
          onWithoutMic={() => void withoutMic()}
        />
      )}
      <div data-testid="onboarding-step" data-step={step}>
        {step === 'permission' && (
          <PermissionStep
            onNext={() => setStep('noise')}
            onWithoutMic={() => void withoutMic()}
            onLater={() => navigate('/')}
          />
        )}
        {step === 'noise' && (
          <NoiseStep
            onDone={(r) => {
              setNoise(r);
              setStep('tuning');
            }}
          />
        )}
        {step === 'tuning' && (
          <TuningStep
            onDone={(r) => {
              setTuning(r);
              setStep('templates');
            }}
          />
        )}
        {step === 'templates' && tuning && (
          <TemplateStep
            tuningCents={tuning.cents}
            onDone={(t) => {
              setTemplates(t);
              setStep('rtt');
            }}
          />
        )}
        {step === 'rtt' && (
          <RttStep
            onDone={(r) => {
              setRtt(r);
              setStep('summary');
            }}
          />
        )}
        {step === 'summary' && draft && <Summary draft={draft} onSave={() => void save()} />}
      </div>
    </Screen>
  );
}
