import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { encodeWav } from '../../src/dsp/wav';

const OUT_DIR = join(import.meta.dirname, '..', '..', 'tests', 'fixtures', 'generated');

function sine(freq: number, seconds: number, sampleRate: number, amplitude: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * sampleRate));
  for (let i = 0; i < out.length; i++) out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  return out;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'spike-sine-440.wav'), encodeWav(sine(440, 2, 48000, 0.25), 48000));
  // Chrome --use-file-for-fake-audio-capture input (silence lead-in, then a tone).
  const capture = new Float32Array(48000 * 6);
  capture.set(sine(196, 4, 48000, 0.3), 48000);
  writeFileSync(join(OUT_DIR, 'fake-capture.wav'), encodeWav(capture, 48000));
  console.log(`fixtures written to ${OUT_DIR}`);
}

main();
