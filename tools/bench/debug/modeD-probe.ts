/** Dev-only: truth vs detected strum times for a few Mode D cases. */
import { computeFlux, DEFAULT_ONSET_PARAMS, detectStrums, pickOnsets } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeD } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const model = process.argv[2] ?? 'additive';
for (const c of buildCases(t, 'dev')
  .modeD.filter((x) => x.kind === 'pattern' && x.model === model)
  .slice(0, Number(process.argv[3] ?? 2))) {
  const r = renderModeD(c, t);
  const fs = c.sampleRate;
  const events = detectStrums(r.signal, fs);
  const frames = computeFlux(r.signal, fs);
  const frameLength = Math.round((DEFAULT_ONSET_PARAMS.frameMs / 1000) * fs);
  const cands = pickOnsets(frames, fs, frameLength, DEFAULT_ONSET_PARAMS);
  console.log(
    `${c.id} ${c.patternId} bpm${c.bpm.toFixed(0)} snr${c.snrDb} spread? truth=${r.truthSamples.length} det=${events.length} cand=${cands.length}`,
  );
  console.log(
    ' truth ms',
    r.truthSamples
      .slice(0, 14)
      .map((s) => ((s / fs) * 1000).toFixed(0))
      .join(' '),
  );
  console.log(
    ' det   ms',
    events
      .slice(0, 14)
      .map((e) => ((e.sample / fs) * 1000).toFixed(0))
      .join(' '),
  );
  console.log(
    ' coarse  ',
    events
      .slice(0, 14)
      .map((e) => ((e.coarseSample / fs) * 1000).toFixed(0))
      .join(' '),
  );
  console.log(
    ' spreads ',
    c.strums
      .slice(0, 14)
      .map((s) => `${s.direction[0]}${s.spreadMs.toFixed(0)}`)
      .join(' '),
  );
}
