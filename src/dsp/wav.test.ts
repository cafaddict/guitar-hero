import { describe, expect, it } from 'vitest';
import { decodeWav, encodeWav, toMono } from './wav';

function ramp(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sin(i * 0.05) * 0.8;
  return out;
}

describe('wav', () => {
  it('round-trips float32 exactly', () => {
    const signal = ramp(1000);
    const decoded = decodeWav(encodeWav(signal, 44100, 'float32'));
    expect(decoded.sampleRate).toBe(44100);
    expect(Array.from(decoded.channels[0]!)).toEqual(Array.from(signal));
  });

  it('round-trips pcm16 within quantization error', () => {
    const signal = ramp(1000);
    const decoded = decodeWav(encodeWav(signal, 48000, 'pcm16'));
    const ch = decoded.channels[0]!;
    for (let i = 0; i < signal.length; i++) expect(Math.abs(ch[i]! - signal[i]!)).toBeLessThan(1 / 16000);
  });

  it('decodes stereo and mixes to mono', () => {
    const l = new Float32Array([0.5, 0.5, 0.5]);
    const r = new Float32Array([-0.5, 0.5, 0]);
    const mono = toMono(decodeWav(encodeWav([l, r], 22050, 'float32')));
    expect(Array.from(mono)).toEqual([0, 0.5, 0.25]);
  });

  it('rejects non-RIFF input', () => {
    expect(() => decodeWav(new Uint8Array(64))).toThrow(/RIFF/);
  });
});
