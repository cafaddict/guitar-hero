import { useEffect, useState } from 'react';
import { useEngineStatus, useMicReleasedOnExit } from '../../app/audioHooks';
import { audioEngine, CAPTURE_DIAGNOSTICS_KEY, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import type { CaptureDiagnostics } from '../../audio/devices';
import type { Calibration } from '../../domain/records';
import { DETECTOR_VERSION } from '../../dsp/version';
import { ko } from '../../i18n/ko';
import { Button, ButtonLink } from '../../ui/Button';
import { Card, CardHeader } from '../../ui/Card';
import { EnvironmentGuide } from '../../ui/EnvironmentGuide';
import { Field, Select } from '../../ui/Field';
import { LevelMeter } from '../../ui/LevelMeter';
import { Screen } from '../../ui/Screen';
import { CaptureWarnings, MicStatusPanel } from '../mic/MicStatusPanel';

const readLevel = () => audioEngine.latestLevel;
const formatLevel = (db: number | null) =>
  `${ko.diagnostics.level}: ${db === null ? '—' : ko.common.dbfs(db)}`;

const SETTING_KEYS = [
  'echoCancellation',
  'noiseSuppression',
  'autoGainControl',
  'sampleRate',
  'channelCount',
  'deviceId',
] as const;

function formatSetting(value: boolean | number | string | null): string {
  if (value === null) return ko.common.unknown;
  if (typeof value === 'boolean') return value ? ko.common.on : ko.common.off;
  return String(value);
}

/** Settings > diagnostics (SPEC §8.1): live level, getSettings, devices, latest calibration. */
export function DiagnosticsScreen() {
  const status = useEngineStatus();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [stored, setStored] = useState<CaptureDiagnostics | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const running = status.kind === 'running';
  useMicReleasedOnExit();

  useEffect(() => {
    void repo.getMeta<CaptureDiagnostics>(CAPTURE_DIAGNOSTICS_KEY).then((d) => setStored(d ?? null));
    void repo.latestCalibration().then((c) => setCalibration(c ?? null));
  }, []);

  useEffect(() => {
    if (running) void audioEngine.inputDevices().then(setDevices);
  }, [running]);

  const start = async (deviceId?: string | null) => {
    await audioEngine.startMic({
      deviceId: deviceId === undefined ? (settings?.preferredInputDeviceId ?? null) : deviceId,
    });
  };

  const chooseDevice = async (deviceId: string) => {
    const id = deviceId === '' ? null : deviceId;
    await updateSettings({ preferredInputDeviceId: id });
    audioEngine.stopMic();
    await start(id);
  };

  const diagnostics = audioEngine.diagnostics ?? stored;
  return (
    <Screen title={ko.diagnostics.title}>
      <div className="flex flex-col gap-5">
        <EnvironmentGuide />
        <Card as="section" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <p className="min-w-0 flex-1 text-lg">
              {ko.diagnostics.status}:{' '}
              <strong data-testid="mic-status">{ko.diagnostics.statusLabels[status.kind]}</strong>
            </p>
            <Button
              variant={running ? 'secondary' : 'primary'}
              onClick={() => (running ? audioEngine.stopMic() : void start())}
            >
              {running ? ko.diagnostics.micStop : ko.diagnostics.micStart}
            </Button>
          </div>
          <MicStatusPanel status={status} onRetry={() => void start()} />
          <div>
            <LevelMeter
              read={readLevel}
              label={ko.diagnostics.level}
              format={formatLevel}
              textTestId="level-db"
            />
            {running && (
              <p className="mt-1 text-sm text-muted" data-testid="diag-gaps">
                {ko.diagnostics.gaps(
                  audioEngine.captureGaps.count,
                  (audioEngine.captureGaps.frames / audioEngine.sampleRate) * 1000,
                )}
              </p>
            )}
          </div>
          {running && devices.length > 0 && (
            <Field label={ko.diagnostics.chooseDevice}>
              <Select
                value={settings?.preferredInputDeviceId ?? ''}
                onChange={(e) => void chooseDevice(e.target.value)}
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
        </Card>
        {diagnostics && (
          <Card as="section" data-testid="diag-settings">
            <p>
              {ko.diagnostics.device}:{' '}
              <span className="font-semibold" data-testid="diag-label">
                {diagnostics.label || ko.common.unknown}
              </span>
            </p>
            <h2 className="mt-4 text-lg font-bold">{ko.diagnostics.trackSettings}</h2>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {SETTING_KEYS.map((key) => (
                <div key={key} className="contents">
                  <dt className="text-muted">{key}</dt>
                  <dd data-testid={`diag-${key}`}>{formatSetting(diagnostics.settings[key])}</dd>
                </div>
              ))}
            </dl>
            {diagnostics.processingOn.length === 0 && diagnostics.settings.echoCancellation !== null && (
              <p className="mt-3 text-ok">{ko.diagnostics.allOff}</p>
            )}
            <CaptureWarnings diagnostics={diagnostics} />
            <p className="mt-3">
              {ko.diagnostics.sampleRate}: {ko.diagnostics.contextRate(diagnostics.contextSampleRate)},{' '}
              {ko.diagnostics.trackRate(diagnostics.settings.sampleRate)}
            </p>
            <p>
              {ko.diagnostics.latency}:{' '}
              {diagnostics.baseLatencyMs === null ? '—' : ko.common.ms(diagnostics.baseLatencyMs)} /{' '}
              {diagnostics.outputLatencyMs === null ? '—' : ko.common.ms(diagnostics.outputLatencyMs)}
            </p>
          </Card>
        )}
        <Card as="section">
          <CardHeader title={ko.diagnostics.calibration} />
          <p data-testid="diag-calibration">
            {calibration
              ? ko.diagnostics.calibrationSummary(
                  calibration.rttMs,
                  ko.onboarding.summary.methods[calibration.rttMethod],
                  calibration.noiseFloorDbfs,
                )
              : ko.diagnostics.noCalibration}
          </p>
          <p className="mt-2 text-muted" data-testid="diag-detector">
            {ko.diagnostics.detectorVersion(DETECTOR_VERSION)}
          </p>
          <ButtonLink className="mt-4" to="/onboarding">
            {ko.diagnostics.rerunOnboarding}
          </ButtonLink>
        </Card>
      </div>
    </Screen>
  );
}
