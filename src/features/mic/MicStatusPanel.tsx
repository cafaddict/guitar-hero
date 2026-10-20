import { audioEngine } from '../../app/services';
import type { CaptureDiagnostics } from '../../audio/devices';
import type { EngineStatus } from '../../audio/engine';
import { ko } from '../../i18n/ko';
import { Button } from '../../ui/Button';

/** Recovery UI for microphone errors and OS interruptions (SPEC §8.1). */
export function MicStatusPanel({
  status,
  onRetry,
  onWithoutMic,
}: {
  status: EngineStatus;
  onRetry: () => void;
  onWithoutMic?: () => void;
}) {
  if (status.kind === 'interrupted') {
    return (
      <div role="alert" className="card rounded-2xl border border-border bg-surface p-4">
        <p>{ko.mic.interrupted}</p>
        <Button className="mt-3" onClick={() => void audioEngine.resumeAfterInterruption()}>
          {ko.mic.resume}
        </Button>
      </div>
    );
  }
  if (status.kind !== 'error') return null;
  return (
    <div
      role="alert"
      className="card rounded-2xl border border-border bg-surface p-4"
      data-testid="mic-error"
      data-code={status.code}
    >
      <p>{ko.mic.errors[status.code]}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={onRetry}>{ko.common.retry}</Button>
        {onWithoutMic && (
          <Button variant="secondary" onClick={onWithoutMic}>
            {ko.common.withoutMic}
          </Button>
        )}
      </div>
      {onWithoutMic && <p className="mt-2 text-sm text-muted">{ko.mic.noWorkaround}</p>}
    </div>
  );
}

/** Warnings derived from getSettings: Bluetooth input, processing the browser left on. */
export function CaptureWarnings({ diagnostics }: { diagnostics: CaptureDiagnostics | null }) {
  if (!diagnostics) return null;
  const names = diagnostics.processingOn.map((k) => ko.mic.processingNames[k]).join(', ');
  return (
    <ul className="mt-2 space-y-1 text-retry">
      {diagnostics.bluetooth && <li>{ko.mic.bluetoothInput}</li>}
      {diagnostics.processingOn.length > 0 && <li>{ko.mic.processingOn(names)}</li>}
    </ul>
  );
}
