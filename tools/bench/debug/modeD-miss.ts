/** Dev-only: where does the onset detector miss strums? */
import { DEFAULT_ONSET_PARAMS, detectStrums, type OnsetParams } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeD } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const overrides = JSON.parse(process.argv[2] ?? '{}') as Partial<OnsetParams>;
const params = { ...DEFAULT_ONSET_PARAMS, ...overrides };
const cases = buildCases(t, 'dev')
  .modeD.filter((x) => x.kind === 'pattern')
  .filter((_, i) => i % 3 === 0);
const stats = new Map<string, [number, number]>();
const bump = (k: string, miss: boolean) => {
  const s = stats.get(k) ?? [0, 0];
  s[0] += miss ? 1 : 0;
  s[1] += 1;
  stats.set(k, s);
};
let fp = 0;
let det = 0;
for (const c of cases) {
  const r = renderModeD(c, t);
  const fs = c.sampleRate;
  const clickSamples = c.clicks.map((k) => Math.round((k.time + c.rttGivenMs / 1000) * fs));
  const events = detectStrums(r.signal, fs, params, { clickSamples }).map((e) => e.sample);
  det += events.length;
  fp += events.filter((e) => !r.truthSamples.some((tr) => Math.abs(tr - e) <= 0.025 * fs)).length;
  r.truthSamples.forEach((tr, k) => {
    const miss = !events.some((e) => Math.abs(e - tr) <= 0.025 * fs);
    const ioi = k > 0 ? (tr - r.truthSamples[k - 1]!) / fs : 9;
    bump(`model:${c.model}`, miss);
    bump(`snr:${c.snrDb}`, miss);
    bump(`pattern:${c.patternId}`, miss);
    bump(`dir:${c.strums[k]!.direction}`, miss);
    bump(`ioi:${ioi < 0.2 ? '<200' : ioi < 0.3 ? '<300' : ioi < 0.5 ? '<500' : '>=500'}`, miss);
    bump(`bpm:${c.bpm < 80 ? '<80' : c.bpm < 100 ? '<100' : '>=100'}`, miss);
  });
}
console.log('false positives', fp, 'of', det);
for (const [k, [m, n]] of [...stats.entries()].sort())
  console.log(k.padEnd(20), `miss ${(m / n).toFixed(3)} (${m}/${n})`);
