/** Dev-only: high-band envelope around a truth onset. */
import { highBandEnvelope } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeD } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const c = buildCases(t, 'dev').modeD.find((x) => x.id === (process.argv[2] ?? 'D-0'))!;
const r = renderModeD(c, t);
const fs = c.sampleRate;
const k = Number(process.argv[3] ?? 1);
const truth = r.truthSamples[k]!;
const env = highBandEnvelope(r.signal, truth - Math.round(0.12 * fs), truth + Math.round(0.03 * fs), fs, 1);
const line: string[] = [];
for (let ms = -120; ms < 30; ms += 4) {
  const i = Math.round(((ms + 120) / 1000) * fs);
  line.push(`${ms}:${(10 * Math.log10(env[i]! + 1e-20)).toFixed(0)}`);
}
console.log(c.id, 'strum', k, 'truth', ((truth / fs) * 1000).toFixed(1), c.strums[k]);
console.log(line.join(' '));
