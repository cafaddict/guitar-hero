/**
 * Capture-device helpers (SPEC §8.1): constraints, error classification, getSettings diagnostics and
 * device warnings. Pure functions over plain data so they are unit-testable without a browser.
 */

export type MicErrorCode =
  | 'PERMISSION_DENIED'
  | 'NO_DEVICE'
  | 'DEVICE_BUSY'
  | 'DEVICE_LOST'
  | 'UNSUPPORTED'
  | 'UNKNOWN';

/** SPEC §8.1: every browser-side processing stage off, mono preferred, sample rate left to the device. */
export function captureConstraints(preferredDeviceId: string | null): MediaStreamConstraints {
  const audio: MediaTrackConstraints = {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: { ideal: 1 },
  };
  if (preferredDeviceId) audio.deviceId = { exact: preferredDeviceId };
  return { audio };
}

/** Maps getUserMedia / AudioContext failures to the recovery screens the UI knows. */
export function classifyMicError(error: unknown): MicErrorCode {
  const name =
    error instanceof Error || (typeof error === 'object' && error !== null && 'name' in error)
      ? String((error as { name: unknown }).name)
      : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'PERMISSION_DENIED';
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return 'NO_DEVICE';
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return 'DEVICE_BUSY';
    case 'TypeError':
      return 'UNSUPPORTED';
    default:
      return 'UNKNOWN';
  }
}

const BLUETOOTH_PATTERN = /airpods|bluetooth|\bbt\b|buds|hands-?free|headset|beats|\bjbl\b|wh-1000|bose/i;

/** Bluetooth inputs add latency and narrow-band codecs; the built-in mic is recommended (SPEC §8.1). */
export function isBluetoothLabel(label: string): boolean {
  return BLUETOOTH_PATTERN.test(label);
}

export interface CaptureDiagnostics {
  /** Constraints the app requested. */
  requested: MediaStreamConstraints;
  /** track.getSettings() subset (JSON-serializable). */
  settings: {
    echoCancellation: boolean | null;
    noiseSuppression: boolean | null;
    autoGainControl: boolean | null;
    sampleRate: number | null;
    channelCount: number | null;
    deviceId: string | null;
  };
  label: string;
  contextSampleRate: number;
  baseLatencyMs: number | null;
  outputLatencyMs: number | null;
  /** Processing stages the browser left on despite the constraints. */
  processingOn: ('echoCancellation' | 'noiseSuppression' | 'autoGainControl')[];
  bluetooth: boolean;
  capturedAt: number;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function buildDiagnostics(input: {
  requested: MediaStreamConstraints;
  trackSettings: Record<string, unknown>;
  label: string;
  contextSampleRate: number;
  baseLatencyS: number | undefined;
  outputLatencyS: number | undefined;
  now: number;
}): CaptureDiagnostics {
  const s = input.trackSettings;
  const settings = {
    echoCancellation: boolOrNull(s.echoCancellation),
    noiseSuppression: boolOrNull(s.noiseSuppression),
    autoGainControl: boolOrNull(s.autoGainControl),
    sampleRate: numberOrNull(s.sampleRate),
    channelCount: numberOrNull(s.channelCount),
    deviceId: typeof s.deviceId === 'string' ? s.deviceId : null,
  };
  const processingOn = (['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const).filter(
    (k) => settings[k] === true,
  );
  const toMs = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v * 1000 : null);
  return {
    requested: input.requested,
    settings,
    label: input.label,
    contextSampleRate: input.contextSampleRate,
    baseLatencyMs: toMs(input.baseLatencyS),
    outputLatencyMs: toMs(input.outputLatencyS),
    processingOn,
    bluetooth: isBluetoothLabel(input.label),
    capturedAt: input.now,
  };
}

/** iOS/iPadOS 16.4+: declare play-and-record before getUserMedia so output and mic coexist (SPEC §8.1). */
export function declarePlayAndRecord(nav: Navigator): void {
  const session = (nav as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = 'play-and-record';
}
