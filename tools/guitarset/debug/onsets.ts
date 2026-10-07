/** Dev-only (players 00–03): onset F1 on GuitarSet comp clips for detector parameter variants. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_ONSET_PARAMS, detectStrums, type OnsetParams } from '../../../src/dsp/onset';
import { decodeWav, toMono } from '../../../src/dsp/wav';
import { loadThresholds } from '../../bench/thresholds';
import { DATA_DIR } from '../download';
import { audioPathFor } from '../evaluate';
import { clipInfo, type EventFilters, groupOnsets, onsetTruth, parseJams } from '../jams';

const t = loadThresholds();
const f = t.guitarset.eventFilters as unknown as EventFilters;
const step = Number(process.argv[3] ?? 2);
const clips = readdirSync(join(DATA_DIR, 'annotation'))
  .map((file) => file.replace(/\.jams$/, ''))
  .map((id) => clipInfo(id, t.guitarset.clipNaming))
  .filter(
    (c) =>
      c !== null &&
      c.kind === 'comp' &&
      c.genre !== 'Funk' &&
      t.guitarset.split.devPlayers.includes(c.player),
  )
  .filter((_, i) => i % step === 0)
  .map((info) => {
    const parsed = parseJams(
      JSON.parse(readFileSync(join(DATA_DIR, 'annotation', `${info!.id}.jams`), 'utf8')),
    );
    const wav = decodeWav(readFileSync(audioPathFor(DATA_DIR, info!.id)));
    return { info: info!, parsed, signal: toMono(wav), fs: wav.sampleRate };
  });
const variants: [string, Partial<OnsetParams>][] = JSON.parse(process.argv[2] ?? '[["base",{}]]');
for (const [name, v] of variants) {
  const params = { ...DEFAULT_ONSET_PARAMS, ...v };
  let tp = 0;
  let det = 0;
  let tru = 0;
  const missBySize = new Map<number, [number, number]>();
  for (const c of clips) {
    const truth = onsetTruth(c.parsed.notes, f).map((x) => Math.round(x * c.fs));
    const sizes = groupOnsets(c.parsed.notes, f.onsetF1GroupMs).map((g) => Math.min(6, g.length));
    const events = detectStrums(c.signal, c.fs, params).map((e) => e.sample);
    det += events.length;
    tru += truth.length;
    const tol = 0.05 * c.fs;
    const used = new Set<number>();
    truth.forEach((tr, k) => {
      let best = -1;
      for (let i = 0; i < events.length; i++)
        if (
          !used.has(i) &&
          Math.abs(events[i]! - tr) <= tol &&
          (best < 0 || Math.abs(events[i]! - tr) < Math.abs(events[best]! - tr))
        )
          best = i;
      const size = sizes[k]!;
      const s = missBySize.get(size) ?? [0, 0];
      s[1]++;
      if (best >= 0) {
        used.add(best);
        tp++;
      } else s[0]++;
      missBySize.set(size, s);
    });
  }
  const p = tp / det;
  const r = tp / tru;
  console.log(
    `${name.padEnd(28)} F1=${((2 * p * r) / (p + r)).toFixed(3)} P=${p.toFixed(3)} R=${r.toFixed(3)} miss by group size ${[
      ...missBySize.entries(),
    ]
      .sort()
      .map(([k, [m, n]]) => `${k}:${(m / n).toFixed(2)}(${n})`)
      .join(' ')}`,
  );
}
// Near-miss analysis for the last variant: missed truths with an unmatched detection 50–100 ms away.
{
  const [, v] = variants[variants.length - 1]!;
  const params = { ...DEFAULT_ONSET_PARAMS, ...v };
  let near = 0;
  let missed = 0;
  const offs: number[] = [];
  for (const c of clips) {
    const truth = onsetTruth(c.parsed.notes, f).map((x) => Math.round(x * c.fs));
    const events = detectStrums(c.signal, c.fs, params).map((e) => e.sample);
    const tol = 0.05 * c.fs;
    const usedE = new Set<number>();
    const usedT = new Set<number>();
    const pairs: { e: number; t: number; d: number }[] = [];
    for (const [i, e] of events.entries()) {
      for (const [j, tr] of truth.entries())
        if (Math.abs(e - tr) <= tol) pairs.push({ e: i, t: j, d: Math.abs(e - tr) });
    }
    pairs.sort((a, b) => a.d - b.d);
    for (const p of pairs)
      if (!usedE.has(p.e) && !usedT.has(p.t)) {
        usedE.add(p.e);
        usedT.add(p.t);
      }
    truth.forEach((tr, j) => {
      if (usedT.has(j)) return;
      missed++;
      const cand = events
        .map((e, i) => ({ e, i }))
        .filter((x) => !usedE.has(x.i) && Math.abs(x.e - tr) <= 0.1 * c.fs);
      if (cand.length) {
        near++;
        offs.push(((cand[0]!.e - tr) / c.fs) * 1000);
      }
    });
  }
  offs.sort((a, b) => a - b);
  console.log(
    `near-miss: ${near}/${missed} missed truths have an unmatched detection within 100 ms; offsets p10/p50/p90 ${[0.1, 0.5, 0.9].map((q) => offs[Math.floor(q * (offs.length - 1))]?.toFixed(0)).join('/')}`,
  );
}
