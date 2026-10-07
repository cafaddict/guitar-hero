/** Dev-only: why are single-note onsets missed on GuitarSet dev comp clips? */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeFlux, DEFAULT_ONSET_PARAMS, detectStrums, type OnsetParams } from '../../../src/dsp/onset';
import { decodeWav, toMono } from '../../../src/dsp/wav';
import { loadThresholds } from '../../bench/thresholds';
import { DATA_DIR } from '../download';
import { audioPathFor } from '../evaluate';
import { clipInfo, type EventFilters, groupOnsets, parseJams } from '../jams';

const t = loadThresholds();
const f = t.guitarset.eventFilters as unknown as EventFilters;
const p: OnsetParams = {
  ...DEFAULT_ONSET_PARAMS,
  ...(JSON.parse(process.argv[2] ?? '{}') as Partial<OnsetParams>),
};
const ids = readdirSync(join(DATA_DIR, 'annotation'))
  .map((file) => clipInfo(file.replace(/\.jams$/, ''), t.guitarset.clipNaming))
  .filter(
    (c) =>
      c !== null &&
      c.kind === 'comp' &&
      c.genre !== 'Funk' &&
      t.guitarset.split.devPlayers.includes(c.player),
  )
  .filter((_, i) => i % 6 === 0);
const reasons = new Map<string, number>();
const bump = (k: string) => reasons.set(k, (reasons.get(k) ?? 0) + 1);
let shown = 0;
for (const info of ids) {
  const parsed = parseJams(
    JSON.parse(readFileSync(join(DATA_DIR, 'annotation', `${info!.id}.jams`), 'utf8')),
  );
  const wav = decodeWav(readFileSync(audioPathFor(DATA_DIR, info!.id)));
  const fs = wav.sampleRate;
  const sig = toMono(wav);
  const frames = computeFlux(sig, fs, p);
  const L = Math.round((p.frameMs / 1000) * fs);
  const events = detectStrums(sig, fs, p).map((e) => e.sample);
  const groups = groupOnsets(parsed.notes, f.onsetF1GroupMs);
  groups.forEach((g, gi) => {
    if (g.length !== 1) return;
    const tr = g[0]!.time * fs;
    if (events.some((e) => Math.abs(e - tr) <= 0.05 * fs)) return;
    const prevGap = gi > 0 ? (g[0]!.time - groups[gi - 1]![0]!.time) * 1000 : 9999;
    const nearDet = events.reduce((b, e) => (Math.abs(e - tr) < Math.abs(b - tr) ? e : b), Infinity);
    const nearDetMs = ((nearDet - tr) / fs) * 1000;
    const frameIdx = frames.findIndex((fr) => fr.start + L / 2 >= tr - 0.02 * fs);
    const win = frames.slice(Math.max(0, frameIdx - 2), frameIdx + 10);
    const maxFlux = Math.max(...win.map((x) => x.flux));
    let reason = 'other';
    if (Math.abs(nearDetMs) <= 120) reason = 'neighbour detection (merged/shifted)';
    else if (maxFlux < 4) reason = 'weak flux';
    else reason = 'gated (threshold/broadband)';
    if (prevGap < 120) reason += ' + prev onset < 120 ms';
    bump(reason);
    if (shown++ < Number(process.argv[3] ?? 12)) {
      console.log(
        `${info!.id} t=${g[0]!.time.toFixed(2)} str${6 - g[0]!.idx} midi${g[0]!.midi.toFixed(1)} prevGap=${prevGap.toFixed(0)} nearDet=${nearDetMs.toFixed(0)}ms maxFlux=${maxFlux.toFixed(1)} lowF=${Math.max(...win.map((x) => x.lowFlux)).toFixed(1)} hiF=${Math.max(...win.map((x) => x.highFlux)).toFixed(1)}`,
      );
    }
  });
}
console.log([...reasons.entries()].sort((a, b) => b[1] - a[1]));
