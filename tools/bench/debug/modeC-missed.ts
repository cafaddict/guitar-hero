/** Dev-only: which Mode C strum events does the onset detector miss? */
import { computeFlux, DEFAULT_ONSET_PARAMS, detectStrums } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeC } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const ids = (process.argv[2] ?? 'C-116,C-15,C-43,C-70').split(',');
for (const c of buildCases(t, 'dev').modeC.filter((x) => ids.includes(x.id))) {
  const r = renderModeC(c, t);
  const fs = c.sampleRate;
  const events = detectStrums(r.signal, fs);
  const frames = computeFlux(r.signal, fs);
  const hop = (DEFAULT_ONSET_PARAMS.hopMs / 1000) * fs;
  for (const [k, e] of c.events.entries()) {
    const s = Math.round(e.time * fs);
    if (events.some((d) => Math.abs(d.sample - s) <= 0.03 * fs)) continue;
    const fi = Math.round((s - Math.round((DEFAULT_ONSET_PARAMS.frameMs / 1000) * fs) / 2) / hop);
    const win = frames.slice(Math.max(0, fi - 3), fi + 8);
    const prev = c.events[k - 1];
    console.log(
      `${c.id} miss ${e.kind}/${e.chord} t=${e.time.toFixed(2)} prevGap=${prev ? (e.time - prev.time).toFixed(2) : '-'} spread=${e.spreadMs.toFixed(0)} ${e.direction}`,
      'flux',
      win.map((f) => f.flux.toFixed(1)).join(','),
      'hiE',
      win.map((f) => (10 * Math.log10(f.highEnergy + 1e-15)).toFixed(0)).join(','),
    );
  }
}
