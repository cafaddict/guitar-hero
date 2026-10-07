/** Dev-only: Mode C parameter sweep (pair counting + set accuracy). */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import {
  ChangeCounter,
  classifyPair,
  classifySet,
  DEFAULT_MODE_C_PARAMS,
  type ModeCParams,
} from '../../../src/dsp/modeC';
import { detectStrums } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeC, renderModeCSet } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const cs = buildCases(t, 'dev');
const seqs = cs.modeC
  .filter((_, i) => i % 2 === 0)
  .map((c) => {
    const r = renderModeC(c, t);
    return { c, r, events: detectStrums(r.signal, c.sampleRate) };
  });
const sets = cs.modeCSet
  .filter((_, i) => i % 4 === 0)
  .map((c) => {
    const r = renderModeCSet(c, t);
    return { c, r, onset: detectStrums(r.signal, c.sampleRate)[0]?.sample ?? r.onsetSample };
  });
const variants: [string, Partial<ModeCParams>][] = JSON.parse(process.argv[2] ?? '[["base",{}]]');
for (const [name, v] of variants) {
  const params = { ...DEFAULT_MODE_C_PARAMS, ...v };
  const errs: number[] = [];
  for (const { c, r, events } of seqs) {
    const counter = new ChangeCounter();
    const pair = [voicingById(c.pair[0]), voicingById(c.pair[1])] as const;
    for (const e of events)
      counter.push(
        classifyPair(
          {
            samples: r.signal,
            sampleRate: c.sampleRate,
            onsetSample: e.sample,
            tuning: STANDARD_TUNING,
            deltaCents: c.deltaGivenCents,
            params,
          },
          pair,
        ),
        (e.sample / c.sampleRate) * 1000,
      );
    errs.push(counter.count - c.truthChanges);
  }
  const cands = ['D', 'A', 'E', 'Em', 'Am', 'Dm', 'C', 'G-2f', 'G-3f'].map(voicingById);
  const cls = (id: string) => (id.startsWith('G-') ? 'G' : id);
  let correct = 0;
  for (const { c, r, onset } of sets) {
    const res = classifySet(
      {
        samples: r.signal,
        sampleRate: c.sampleRate,
        onsetSample: onset,
        tuning: STANDARD_TUNING,
        deltaCents: c.deltaGivenCents,
        params,
      },
      cands,
      (x) => cls(x.id),
    );
    if (cls(cands[res.top]!.id) === cls(c.voicingId)) correct++;
  }
  const le1 = errs.filter((e) => Math.abs(e) <= 1).length / errs.length;
  const mae = errs.reduce((s, e) => s + Math.abs(e), 0) / errs.length;
  const over2 = errs.filter((e) => e >= 2).length / errs.length;
  console.log(
    `${name.padEnd(24)} le1=${le1.toFixed(3)} mae=${mae.toFixed(3)} over2=${over2.toFixed(3)} set=${(correct / sets.length).toFixed(3)} errs=${JSON.stringify(errs.filter((e) => e !== 0))}`,
  );
}
