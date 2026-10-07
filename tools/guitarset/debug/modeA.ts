/** Dev-only: Mode A margins (level, clarity, cents, decay) on GuitarSet dev single-note events. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { midiToHz } from '../../../src/domain/theory';
import { verifyPluck } from '../../../src/dsp/modeA';
import { detectStrums } from '../../../src/dsp/onset';
import { decodeWav, toMono } from '../../../src/dsp/wav';
import { loadThresholds } from '../../bench/thresholds';
import { DATA_DIR } from '../download';
import { audioPathFor } from '../evaluate';
import { clipInfo, type EventFilters, parseJams, singleEvents, stringOffsetsCents } from '../jams';

const t = loadThresholds();
const f = t.guitarset.eventFilters as unknown as EventFilters;
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
  const events = detectStrums(sig, fs);
  for (const s of singleEvents(parsed, f).filter((e) => e.time >= 0.5 && e.time + 0.4 <= sig.length / fs)) {
    const target = Math.round(s.time * fs);
    const e = events.reduce<(typeof events)[number] | null>(
      (b, x) =>
        Math.abs(x.sample - target) <= 0.06 * fs &&
        (!b || Math.abs(x.sample - target) < Math.abs(b.sample - target))
          ? x
          : b,
      null,
    );
    if (!e) {
      console.log(`${info!.id} midi${s.midi} NO ONSET`);
      continue;
    }
    const start = Math.max(0, e.sample - Math.round(0.5 * fs));
    const seg = sig.slice(start, e.sample + Math.round(0.4 * fs));
    const r = verifyPluck({
      samples: seg,
      sampleRate: fs,
      onsetSample: e.sample - start,
      expectedF0: midiToHz(s.midi) * 2 ** (delta[s.idx]! / 1200),
    });
    console.log(
      `${info!.id.padEnd(24)} midi${s.midi} str${6 - s.idx} ${r.status.padEnd(10)} ${r.reasons.join(',').padEnd(10)} level=${r.levelDb.toFixed(1)} clarity=${r.clarity.toFixed(3)} cents=${r.cents?.toFixed(1)} decay=${r.decayRatio?.toFixed(2)} onsetErr=${(((e.sample - target) / fs) * 1000).toFixed(0)}ms`,
    );
  }
}
