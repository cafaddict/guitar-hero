/** Dev-only: max residual (wrong-fret hypothesis) salience in clean vs wrong-fret strums. */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { DEFAULT_MODE_B_PARAMS, verifyStrum } from '../../../src/dsp/modeB';
import { detectStrums } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeB } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const all = buildCases(t, 'dev').modeB;
const params = { ...DEFAULT_MODE_B_PARAMS, tResidualDb: -999, tUnexpectedLateDb: -999 };
const q = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? Number.NaN;
for (const condition of ['clean', 'wrong-fret-verifiable', 'dependent-muted']) {
  const vals: number[] = [];
  for (const c of all.filter((x) => x.condition === condition).slice(0, 200)) {
    const r = renderModeB(c, t);
    const onset = detectStrums(r.signal, c.sampleRate)[0]?.sample ?? r.onsetSample;
    const res = verifyStrum({
      samples: r.signal,
      sampleRate: c.sampleRate,
      onsetSample: onset,
      voicing: voicingById(c.voicingId),
      tuning: STANDARD_TUNING,
      deltaCents: c.deltaGivenCents,
      params: { ...params, residualSearch: true },
    });
    const resid = res.unexpected.filter((u) => !(voicingById(c.voicingId).frets[u.idx ?? -1] === 'x'));
    vals.push(resid.length ? Math.max(...resid.map((u) => u.salienceDb)) : -1);
  }
  console.log(
    condition.padEnd(24),
    [0.5, 0.8, 0.9, 0.95, 0.98, 1].map((p) => `p${p * 100}=${q(vals, p).toFixed(1)}`).join(' '),
  );
}
