/** Dev-only: x-string check salience (main/late) for clean vs x-string-ringing at several leakage factors. */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { DEFAULT_MODE_B_PARAMS, verifyStrum } from '../../../src/dsp/modeB';
import { detectStrums } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeB } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const all = buildCases(t, 'dev').modeB;
const q = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))] ?? Number.NaN;
const rendered = ['clean', 'x-string-ringing'].map((condition) => ({
  condition,
  items: all
    .filter((x) => x.condition === condition && voicingById(x.voicingId).frets.includes('x') && x.snrDb >= 25)
    .slice(0, 160)
    .map((c) => {
      const r = renderModeB(c, t);
      return { c, r, onset: detectStrums(r.signal, c.sampleRate)[0]?.sample ?? r.onsetSample };
    }),
}));
for (const lf of [1, 1.5]) {
  for (const { condition, items } of rendered) {
    const mains: number[] = [];
    const lates: number[] = [];
    for (const { c, r, onset } of items) {
      const res = verifyStrum({
        samples: r.signal,
        sampleRate: c.sampleRate,
        onsetSample: onset,
        voicing: voicingById(c.voicingId),
        tuning: STANDARD_TUNING,
        deltaCents: c.deltaGivenCents,
        params: {
          ...DEFAULT_MODE_B_PARAMS,
          residualSearch: false,
          unexpectedLeakageFactor: lf,
          tUnexpectedDb: -99,
          tUnexpectedLateDb: -99,
        },
      });
      const target = condition === 'clean' ? null : c.targetIdx;
      const hits = res.unexpected.filter((u) => target === null || u.idx === target);
      mains.push(hits.length ? Math.max(...hits.map((u) => u.salienceDb)) : -1);
      lates.push(hits.length ? Math.max(...hits.map((u) => (u as { lateDb?: number }).lateDb ?? -1)) : -1);
    }
    const ps = condition === 'clean' ? [0.9, 0.95, 0.98, 0.99, 1] : [0.05, 0.1, 0.15, 0.2, 0.5];
    console.log(
      `lf=${lf} ${condition.padEnd(18)} main ${ps.map((p) => `p${p * 100}=${q(mains, p).toFixed(1)}`).join(' ')}`,
    );
    console.log(
      `lf=${lf} ${condition.padEnd(18)} late ${ps.map((p) => `p${p * 100}=${q(lates, p).toFixed(1)}`).join(' ')}`,
    );
    const pairs = mains.map((m, i) => [m, lates[i]!] as const);
    for (const [tm, tl] of [
      [14, 8],
      [15, 10],
      [16, 8],
      [12, 12],
      [14, 12],
      [16, 12],
    ] as const) {
      console.log(
        `   rule main>=${tm}&late>=${tl}: ${(pairs.filter(([m, l]) => m >= tm && l >= tl).length / pairs.length).toFixed(3)}`,
      );
    }
  }
}
