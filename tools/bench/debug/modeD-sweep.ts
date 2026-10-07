/** Dev-only: onset refinement parameter sweep (timing error vs truth, F1@25 ms) on dev pattern cases. */
import { DEFAULT_ONSET_PARAMS, detectStrums, type OnsetParams } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeD } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const allD = buildCases(t, 'dev').modeD;
const cases = allD.filter((x) => x.kind === 'pattern').filter((_, i) => i % 3 === 0);
const rendered = cases.map((c) => ({ c, r: renderModeD(c, t) }));
const sustain = allD
  .filter((x) => x.kind === 'sustain')
  .filter((_, i) => i % 4 === 0)
  .map((c) => ({ c, r: renderModeD(c, t) }));
const variants: [string, Partial<OnsetParams>][] = JSON.parse(process.argv[2] ?? '[["base",{}]]');
for (const [name, v] of variants) {
  const params = { ...DEFAULT_ONSET_PARAMS, ...v };
  const signed: number[] = [];
  let tp = 0;
  let det = 0;
  let tru = 0;
  for (const { c, r } of rendered) {
    const fs = c.sampleRate;
    const clickSamples = c.clicks.map((k) => Math.round((k.time + c.rttGivenMs / 1000) * fs));
    const events = detectStrums(r.signal, fs, params, { clickSamples }).map((e) => e.sample);
    det += events.length;
    tru += r.truthSamples.length;
    const used = new Set<number>();
    for (const tr of r.truthSamples) {
      let best = -1;
      for (let i = 0; i < events.length; i++)
        if (
          !used.has(i) &&
          Math.abs(events[i]! - tr) <= 0.05 * fs &&
          (best < 0 || Math.abs(events[i]! - tr) < Math.abs(events[best]! - tr))
        )
          best = i;
      if (best >= 0) {
        used.add(best);
        const e = ((events[best]! - tr) / fs) * 1000;
        signed.push(e);
        if (Math.abs(e) <= 25) tp++;
      }
    }
  }
  let susFalse = 0;
  for (const { c, r } of sustain) {
    const ev = detectStrums(r.signal, c.sampleRate, params).map((e) => e.sample);
    if (ev.some((e) => Math.abs(e - r.truthSamples[0]!) > 0.06 * c.sampleRate)) susFalse++;
  }
  const abs = signed.map(Math.abs).sort((a, b) => a - b);
  const s2 = [...signed].sort((a, b) => a - b);
  const p = tp / det;
  const r2 = tp / tru;
  console.log(
    `${name.padEnd(18)} F1=${((2 * p * r2) / (p + r2)).toFixed(3)} P=${p.toFixed(3)} R=${r2.toFixed(3)} med|e|=${abs[abs.length >> 1]!.toFixed(1)} p95|e|=${abs[Math.floor(abs.length * 0.95)]!.toFixed(1)} signed p5/50/95=${s2[Math.floor(s2.length * 0.05)]!.toFixed(1)}/${s2[s2.length >> 1]!.toFixed(1)}/${s2[Math.floor(s2.length * 0.95)]!.toFixed(1)} sustainFalse=${(susFalse / sustain.length).toFixed(3)}`,
  );
}
