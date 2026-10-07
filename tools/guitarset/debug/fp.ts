/** Dev-only: characterise onset false positives and timing offsets on GuitarSet dev comp clips. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_ONSET_PARAMS, detectStrums, type OnsetParams } from '../../../src/dsp/onset';
import { decodeWav, toMono } from '../../../src/dsp/wav';
import { loadThresholds } from '../../bench/thresholds';
import { DATA_DIR } from '../download';
import { audioPathFor } from '../evaluate';
import { clipInfo, type EventFilters, onsetTruth, parseJams } from '../jams';

const t = loadThresholds();
const f = t.guitarset.eventFilters as unknown as EventFilters;
const ids = readdirSync(join(DATA_DIR, 'annotation'))
  .map((file) => clipInfo(file.replace(/\.jams$/, ''), t.guitarset.clipNaming))
  .filter(
    (c) =>
      c !== null &&
      c.kind === 'comp' &&
      c.genre !== 'Funk' &&
      t.guitarset.split.devPlayers.includes(c.player),
  )
  .filter((_, i) => i % 4 === 0);
const signed: number[] = [];
const fpDist: number[] = [];
const fpSounding: number[] = [];
for (const info of ids) {
  const parsed = parseJams(
    JSON.parse(readFileSync(join(DATA_DIR, 'annotation', `${info!.id}.jams`), 'utf8')),
  );
  const wav = decodeWav(readFileSync(audioPathFor(DATA_DIR, info!.id)));
  const fs = wav.sampleRate;
  const truth = onsetTruth(parsed.notes, f);
  const params: OnsetParams = {
    ...DEFAULT_ONSET_PARAMS,
    ...(JSON.parse(process.argv[2] ?? '{}') as Partial<OnsetParams>),
  };
  const events = detectStrums(toMono(wav), fs, params).map(
    (e) => (process.argv.includes('--coarse') ? e.coarseSample : e.sample) / fs,
  );
  for (const e of events) {
    const nearest = truth.reduce(
      (b, x) => (Math.abs(x - e) < Math.abs(b - e) ? x : b),
      Number.POSITIVE_INFINITY,
    );
    const d = (e - nearest) * 1000;
    if (Math.abs(d) <= 50) signed.push(d);
    else {
      fpDist.push(d);
      fpSounding.push(parsed.notes.filter((n) => n.time < e && n.time + n.duration > e).length);
    }
  }
}
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
console.log(
  'matched signed error ms p5/p25/p50/p75/p95',
  [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => q(signed, p).toFixed(1)).join('/'),
);
console.log(
  'FP count',
  fpDist.length,
  'dist to nearest truth (ms) p10/p50/p90',
  [0.1, 0.5, 0.9].map((p) => q(fpDist, p).toFixed(0)).join('/'),
);
const hist = new Map<string, number>();
for (const d of fpDist) {
  const k = d < -200 ? '<-200' : d < -50 ? '-200..-50' : d < 100 ? '50..100' : d < 200 ? '100..200' : '>200';
  hist.set(k, (hist.get(k) ?? 0) + 1);
}
console.log('FP histogram', [...hist.entries()]);
console.log(
  'FP sounding-notes count p10/p50/p90',
  [0.1, 0.5, 0.9].map((p) => q(fpSounding, p)).join('/'),
  'zero sounding',
  fpSounding.filter((x) => x === 0).length,
);
