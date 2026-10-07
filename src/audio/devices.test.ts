import { describe, expect, it } from 'vitest';
import {
  buildDiagnostics,
  captureConstraints,
  classifyMicError,
  declarePlayAndRecord,
  isBluetoothLabel,
} from './devices';

describe('captureConstraints', () => {
  it('turns every processing stage off and leaves the sample rate to the device', () => {
    const c = captureConstraints(null);
    expect(c.audio).toEqual({
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 1 },
    });
    expect(JSON.stringify(c)).not.toContain('sampleRate');
  });

  it('pins the preferred device exactly', () => {
    expect((captureConstraints('abc').audio as MediaTrackConstraints).deviceId).toEqual({ exact: 'abc' });
  });
});

describe('classifyMicError', () => {
  const err = (name: string) => Object.assign(new Error(name), { name });
  it.each([
    ['NotAllowedError', 'PERMISSION_DENIED'],
    ['SecurityError', 'PERMISSION_DENIED'],
    ['NotFoundError', 'NO_DEVICE'],
    ['OverconstrainedError', 'NO_DEVICE'],
    ['NotReadableError', 'DEVICE_BUSY'],
    ['AbortError', 'DEVICE_BUSY'],
    ['TypeError', 'UNSUPPORTED'],
    ['Weird', 'UNKNOWN'],
  ])('%s → %s', (name, code) => {
    expect(classifyMicError(err(name))).toBe(code);
  });

  it('handles DOMException-like objects and garbage', () => {
    expect(classifyMicError({ name: 'NotAllowedError' })).toBe('PERMISSION_DENIED');
    expect(classifyMicError(undefined)).toBe('UNKNOWN');
  });
});

describe('isBluetoothLabel', () => {
  it.each(['AirPods Pro', 'Galaxy Buds2', 'WH-1000XM4 Hands-Free', 'BT Headset', 'Bluetooth Mic'])(
    '%s is Bluetooth',
    (label) => {
      expect(isBluetoothLabel(label)).toBe(true);
    },
  );
  it.each(['MacBook Pro Microphone', 'iPad Microphone', 'Built-in Microphone', 'Default'])(
    '%s is not',
    (label) => {
      expect(isBluetoothLabel(label)).toBe(false);
    },
  );
});

describe('buildDiagnostics', () => {
  it('records getSettings and flags stages the browser kept on', () => {
    const d = buildDiagnostics({
      requested: captureConstraints(null),
      trackSettings: {
        echoCancellation: false,
        noiseSuppression: true,
        autoGainControl: false,
        sampleRate: 48000,
        channelCount: 1,
        deviceId: 'x',
      },
      label: 'AirPods',
      contextSampleRate: 48000,
      baseLatencyS: 0.005,
      outputLatencyS: undefined,
      now: 1,
    });
    expect(d.processingOn).toEqual(['noiseSuppression']);
    expect(d.bluetooth).toBe(true);
    expect(d.baseLatencyMs).toBeCloseTo(5);
    expect(d.outputLatencyMs).toBeNull();
    expect(d.settings.sampleRate).toBe(48000);
    expect(JSON.parse(JSON.stringify(d))).toEqual(d);
  });

  it('treats unknown values as null (Safari omits some settings)', () => {
    const d = buildDiagnostics({
      requested: {},
      trackSettings: {},
      label: '',
      contextSampleRate: 44100,
      baseLatencyS: undefined,
      outputLatencyS: undefined,
      now: 0,
    });
    expect(d.settings).toEqual({
      echoCancellation: null,
      noiseSuppression: null,
      autoGainControl: null,
      sampleRate: null,
      channelCount: null,
      deviceId: null,
    });
    expect(d.processingOn).toEqual([]);
  });
});

describe('declarePlayAndRecord', () => {
  it('sets the iOS audio session type when available', () => {
    const nav = { audioSession: { type: 'auto' } } as unknown as Navigator;
    declarePlayAndRecord(nav);
    expect((nav as unknown as { audioSession: { type: string } }).audioSession.type).toBe('play-and-record');
    expect(() => declarePlayAndRecord({} as Navigator)).not.toThrow();
  });
});
