import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useEngineStatus, useInputLevel, useMicReleasedOnExit } from '../../app/audioHooks';
import { audioEngine, CAPTURE_DIAGNOSTICS_KEY, repo } from '../../app/services';
import { useSettingsStore } from '../../app/settingsStore';
import type { CaptureDiagnostics } from '../../audio/devices';
import type { Calibration } from '../../domain/records';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';
import { LevelMeter } from '../../ui/LevelMeter';
import { Screen } from '../../ui/Screen';
import { CaptureWarnings, MicStatusPanel } from '../mic/MicStatusPanel';

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
  const level = useInputLevel();
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
  const levelDb = level ? 20 * Math.log10(Math.max(level.rms, 1e-9)) : null;
  return (
    <Screen title={ko.diagnostics.title}>
      <p>
        {ko.diagnostics.status}:{' '}
        <strong data-testid="mic-status">{ko.diagnostics.statusLabels[status.kind]}</strong>
      </p>
      <Button className="mt-3" onClick={() => (running ? audioEngine.stopMic() : void start())}>
        {running ? ko.diagnostics.micStop : ko.diagnostics.micStart}
      </Button>
      <MicStatusPanel status={status} onRetry={() => void start()} />
      <div className="mt-4">
        <p data-testid="level-db">
          {ko.diagnostics.level}: {levelDb === null ? '—' : ko.common.dbfs(levelDb)}
        </p>
        <LevelMeter rms={level?.rms ?? null} clipped={level?.clipped ?? false} label={ko.diagnostics.level} />
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
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-sm text-muted">{ko.diagnostics.chooseDevice}</span>
          <select
            className="min-h-12 rounded-lg bg-surface-2 px-3 text-fg"
            value={settings?.preferredInputDeviceId ?? ''}
            onChange={(e) => void chooseDevice(e.target.value)}
          >
            <option value="">{ko.diagnostics.defaultDevice}</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || d.deviceId}
              </option>
            ))}
          </select>
        </label>
      )}
      {diagnostics && (
        <section className="mt-4 rounded-lg bg-surface p-4" data-testid="diag-settings">
          <p>
            {ko.diagnostics.device}:{' '}
            <span data-testid="diag-label">{diagnostics.label || ko.common.unknown}</span>
          </p>
          <h2 className="mt-3 font-semibold">{ko.diagnostics.trackSettings}</h2>
          <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {SETTING_KEYS.map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted">{key}</dt>
                <dd data-testid={`diag-${key}`}>{formatSetting(diagnostics.settings[key])}</dd>
              </div>
            ))}
          </dl>
          {diagnostics.processingOn.length === 0 && diagnostics.settings.echoCancellation !== null && (
            <p className="mt-2 text-ok">{ko.diagnostics.allOff}</p>
          )}
          <CaptureWarnings diagnostics={diagnostics} />
          <p className="mt-3 text-sm">
            {ko.diagnostics.sampleRate}: {ko.diagnostics.contextRate(diagnostics.contextSampleRate)},{' '}
            {ko.diagnostics.trackRate(diagnostics.settings.sampleRate)}
          </p>
          <p className="text-sm">
            {ko.diagnostics.latency}:{' '}
            {diagnostics.baseLatencyMs === null ? '—' : ko.common.ms(diagnostics.baseLatencyMs)} /{' '}
            {diagnostics.outputLatencyMs === null ? '—' : ko.common.ms(diagnostics.outputLatencyMs)}
          </p>
        </section>
      )}
      <section className="mt-4 rounded-lg bg-surface p-4">
        <h2 className="font-semibold">{ko.diagnostics.calibration}</h2>
        <p className="mt-1" data-testid="diag-calibration">
          {calibration
            ? ko.diagnostics.calibrationSummary(
                calibration.rttMs,
                ko.onboarding.summary.methods[calibration.rttMethod],
                calibration.noiseFloorDbfs,
              )
            : ko.diagnostics.noCalibration}
        </p>
        <Link
          className="mt-3 inline-flex min-h-12 items-center rounded-lg bg-surface-2 px-4 font-semibold"
          to="/onboarding"
        >
          {ko.diagnostics.rerunOnboarding}
        </Link>
      </section>
    </Screen>
  );
}
