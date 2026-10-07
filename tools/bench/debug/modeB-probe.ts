/** Dev-only probe: prints Mode B per-string salience for a few dev cases. */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { DEFAULT_MODE_B_PARAMS, verifyStrum } from '../../../src/dsp/modeB';
import { detectStrums } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeB } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const cases = buildCases(t, 'dev').modeB;
const want = process.argv[2] ?? 'clean';
const params = { ...DEFAULT_MODE_B_PARAMS, residualSearch: process.argv.includes('--residual') };
for (const c of cases.filter((x) => x.condition === want).slice(0, Number(process.argv[3] ?? 8))) {
  const r = renderModeB(c, t);
  const ev = detectStrums(r.signal, c.sampleRate)[0];
  const onset = ev?.sample ?? r.onsetSample;
  const res = verifyStrum({
    samples: r.signal,
    sampleRate: c.sampleRate,
    onsetSample: onset,
    voicing: voicingById(c.voicingId),
    tuning: STANDARD_TUNING,
    deltaCents: c.deltaGivenCents,
    params,
  });
  console.log(
    `${c.id} ${c.voicingId} snr${c.snrDb} ${c.model} tgt${c.targetIdx} onsetErr=${(((onset - r.onsetSample) / c.sampleRate) * 1000).toFixed(1)}ms ref=${res.referenceDb.toFixed(1)} ${res.verdict} blamed=${res.blamed}`,
    res.strings
      .map(
        (s) =>
          `${s.idx}:${s.status}:${s.salienceDb?.toFixed(1) ?? '-'}/${s.decayDb?.toFixed(1) ?? '-'}/${s.relLateDb?.toFixed(1) ?? '-'}`,
      )
      .join(' '),
    res.unexpected.map((u) => `U${u.idx}/${u.midi}:${u.salienceDb.toFixed(1)}`).join(' '),
  );
}
