/** Dev-only: Mode A onset failures on dev solo notes under RELAXED event filters (more cases to study). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { midiToHz } from '../../../src/domain/theory';
import { verifyPluck } from '../../../src/dsp/modeA';
import { detectStrums } from '../../../src/dsp/onset';
import { energyOnset } from '../../../src/dsp/take';
import { decodeWav, toMono } from '../../../src/dsp/wav';
import { loadThresholds } from '../../bench/thresholds';
import { DATA_DIR } from '../download';
import { audioPathFor } from '../evaluate';
import { clipInfo, type EventFilters, parseJams, singleEvents, stringOffsetsCents } from '../jams';

const t = loadThresholds();
const official = t.guitarset.eventFilters as unknown as EventFilters;
const relaxed = process.argv.includes('--relaxed')
  ? { ...official, singleMinDurationMs: 250, singleMinGapToNextOnsetMs: 300, singleIsolationBeforeMs: 100 }
  : official;
const fallbackOnly = process.argv.includes('--fallback-only');
const counts = new Map<string, number>();
for (const info of readdirSync(join(DATA_DIR, 'annotation'))
  .map((file) => clipInfo(file.replace(/\.jams$/, ''), t.guitarset.clipNaming))
  .filter((c) => c !== null && c.kind === 'solo' && t.guitarset.split.devPlayers.includes(c.player))) {
  const parsed = parseJams(
    JSON.parse(readFileSync(join(DATA_DIR, 'annotation', `${info!.id}.jams`), 'utf8')),
  );
  const wav = decodeWav(readFileSync(audioPathFor(DATA_DIR, info!.id)));
  const fs = wav.sampleRate;
  const sig = toMono(wav);
  const delta = stringOffsetsCents(parsed.notes);
  const events = fallbackOnly ? [] : detectStrums(sig, fs);
  for (const s of singleEvents(parsed, relaxed).filter(
    (e) => e.time >= 0.5 && e.time + 0.4 <= sig.length / fs,
  )) {
    const target = Math.round(s.time * fs);
    const tol = 0.06 * fs;
    const near = events
      .filter((e) => Math.abs(e.sample - target) <= 0.3 * fs)
      .map((e) => Math.round(((e.sample - target) / fs) * 1000));
    const hit = events.find((e) => Math.abs(e.sample - target) <= tol);
    const fb = hit ? null : energyOnset(sig, fs, target - Math.round(0.15 * fs), target + tol);
    let status = 'OK';
    const onset = hit?.sample ?? (fb !== null && Math.abs(fb - target) <= tol ? fb : null);
    if (onset === null) status = 'NOT_PLAYED';
    else {
      const start = Math.max(0, onset - Math.round(0.5 * fs));
      const r = verifyPluck({
        samples: sig.slice(start, onset + Math.round(0.4 * fs)),
        sampleRate: fs,
        onsetSample: onset - start,
        expectedF0: midiToHz(s.midi) * 2 ** (delta[s.idx]! / 1200),
      });
      status = r.status === 'OK' ? 'OK' : `${r.status}:${r.reasons.join(',')}`;
    }
    counts.set(status, (counts.get(status) ?? 0) + 1);
    if (status !== 'OK')
      console.log(
        `${info!.id} t=${s.time.toFixed(2)} midi${s.midi} str${6 - s.idx} ${status} nearDetections(ms)=${near.join(',')} fallback=${fb === null ? '-' : Math.round(((fb - target) / fs) * 1000)}`,
      );
  }
}
console.log([...counts.entries()]);
