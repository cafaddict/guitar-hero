/** Dev-only: inspect GuitarSet dev single-note events that fail Mode A. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeFlux, DEFAULT_ONSET_PARAMS, detectStrums } from '../../../src/dsp/onset';
import { rms } from '../../../src/dsp/spectrum';
import { decodeWav, toMono } from '../../../src/dsp/wav';
import { loadThresholds } from '../../bench/thresholds';
import { DATA_DIR } from '../download';
import { audioPathFor } from '../evaluate';
import { type EventFilters, parseJams, singleEvents } from '../jams';

const t = loadThresholds();
const f = t.guitarset.eventFilters as unknown as EventFilters;
const targets: [string, number][] = [
  ['00_Jazz2-110-Bb_solo', 75],
  ['01_Jazz3-150-C_solo', 60],
  ['02_BN2-166-Ab_solo', 56],
  ['02_SS2-88-F_solo', 53],
  ['00_SS2-88-F_solo', 41],
];
for (const [id, midi] of targets) {
  const parsed = parseJams(JSON.parse(readFileSync(join(DATA_DIR, 'annotation', `${id}.jams`), 'utf8')));
  const wav = decodeWav(readFileSync(audioPathFor(DATA_DIR, id)));
  const fs = wav.sampleRate;
  const sig = toMono(wav);
  const ev = singleEvents(parsed, f).find((e) => e.midi === midi)!;
  const s = Math.round(ev.time * fs);
  const events = detectStrums(sig, fs)
    .map((e) => ((e.sample - s) / fs) * 1000)
    .filter((d) => Math.abs(d) < 400);
  const frames = computeFlux(sig, fs);
  const L = Math.round((DEFAULT_ONSET_PARAMS.frameMs / 1000) * fs);
  const near = frames.filter((fr) => Math.abs(fr.start + L / 2 - s) < 0.12 * fs);
  console.log(
    `${id} midi${midi} str${6 - ev.idx} t=${ev.time.toFixed(2)} detections(ms rel)=${events.map((d) => d.toFixed(0)).join(',')} pre/post rms dB=${(20 * Math.log10(rms(sig, s - 0.15 * fs, s))).toFixed(0)}/${(20 * Math.log10(rms(sig, s, s + 0.15 * fs))).toFixed(0)}`,
  );
  console.log(
    '   flux',
    near.map((fr) => fr.flux.toFixed(1)).join(' '),
    '| low',
    near.map((fr) => fr.lowFlux.toFixed(1)).join(' '),
    '| hi',
    near.map((fr) => fr.highFlux.toFixed(1)).join(' '),
  );
}
