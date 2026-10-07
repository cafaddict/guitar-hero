/** Dev-only: per-event Mode C classification for a sequence. */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { classifyPair } from '../../../src/dsp/modeC';
import { detectStrums } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeC } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const idx = Number(process.argv[2] ?? 0);
const c = buildCases(t, 'dev').modeC[idx]!;
const r = renderModeC(c, t);
const fs = c.sampleRate;
const events = detectStrums(r.signal, fs);
console.log(c.id, c.pair, c.snrDb, c.model, 'truth', c.truthChanges);
for (const e of events.slice(0, Number(process.argv[3] ?? 12))) {
  const tMs = (e.sample / fs) * 1000;
  const truth = c.events.reduce((best, x) =>
    Math.abs(x.time * 1000 - tMs) < Math.abs(best.time * 1000 - tMs) ? x : best,
  );
  const cls = classifyPair(
    {
      samples: r.signal,
      sampleRate: fs,
      onsetSample: e.sample,
      tuning: STANDARD_TUNING,
      deltaCents: c.deltaGivenCents,
    },
    [voicingById(c.pair[0]), voicingById(c.pair[1])],
  );
  console.log(
    `${tMs.toFixed(0)}ms truth=${truth.kind}/${truth.chord} winner=${cls.winner} margin=${cls.margin.toFixed(1)} distractor=${cls.distractorWins}`,
  );
}
