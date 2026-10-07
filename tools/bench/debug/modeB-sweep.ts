/** Dev-only: Mode B parameter sweep over all conditions (judged strata as in metrics.ts). */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { DEFAULT_MODE_B_PARAMS, type ModeBParams, verifyStrum } from '../../../src/dsp/modeB';
import { detectStrums } from '../../../src/dsp/onset';
import { selectTakeEvent } from '../../../src/dsp/take';
import { buildCases } from '../cases';
import { renderModeB } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const cases = buildCases(t, 'dev').modeB.filter((_, i) => i % 2 === 0);
const rendered = cases.map((c) => {
  const r = renderModeB(c, t);
  const take = selectTakeEvent(detectStrums(r.signal, c.sampleRate), c.sampleRate);
  return { c, r, onset: take.ok ? take.event.sample : null };
});
const variants: [string, Partial<ModeBParams>][] = JSON.parse(process.argv[2] ?? '[["base",{}]]');
for (const [name, v] of variants) {
  const params = { ...DEFAULT_MODE_B_PARAMS, ...v };
  const by = new Map<
    string,
    { verdict: string; blamed: number[]; unexpected: number[]; target: number | null; snr: number }[]
  >();
  for (const { c, r, onset } of rendered) {
    let verdict = 'RETRY';
    let blamed: number[] = [];
    let unexpected: number[] = [];
    if (onset !== null) {
      const res = verifyStrum({
        samples: r.signal,
        sampleRate: c.sampleRate,
        onsetSample: onset,
        voicing: voicingById(c.voicingId),
        tuning: STANDARD_TUNING,
        deltaCents: c.deltaGivenCents,
        params,
      });
      verdict = res.verdict;
      blamed = res.blamed;
      unexpected = res.unexpected.map((u) => u.idx).filter((i): i is number => i !== null);
    }
    by.set(c.condition, [
      ...(by.get(c.condition) ?? []),
      { verdict, blamed, unexpected, target: c.targetIdx, snr: c.snrDb },
    ]);
  }
  const hi = (k: string) => (by.get(k) ?? []).filter((x) => x.snr >= 25);
  const rate = (xs: unknown[], n: number) => (n ? (xs.length / n).toFixed(3) : 'NaN');
  const clean = by.get('clean') ?? [];
  const out = [
    `cleanFail=${rate(
      clean.filter((x) => x.verdict === 'FAIL'),
      clean.length,
    )}`,
    `cleanRetry=${rate(
      hi('clean').filter((x) => x.verdict === 'RETRY'),
      hi('clean').length,
    )}`,
    `mutedFlag=${rate(
      hi('verifiable-muted').filter(
        (x) => x.verdict === 'FAIL' && x.blamed.length === 1 && x.blamed[0] === x.target,
      ),
      hi('verifiable-muted').length,
    )}`,
    `xFail=${rate(
      hi('x-string-ringing').filter(
        (x) => x.verdict === 'FAIL' && x.target !== null && x.unexpected.includes(x.target),
      ),
      hi('x-string-ringing').length,
    )}`,
    `xPass=${rate(
      hi('x-string-ringing').filter((x) => x.verdict === 'PASS'),
      hi('x-string-ringing').length,
    )}`,
    `wrongPass=${rate(
      hi('wrong-fret-verifiable').filter((x) => x.verdict === 'PASS'),
      hi('wrong-fret-verifiable').length,
    )}`,
    `depMis=${rate(
      hi('dependent-muted').filter((x) => x.verdict === 'FAIL' && x.blamed.some((b) => b !== x.target)),
      hi('dependent-muted').length,
    )}`,
  ];
  console.log(name.padEnd(22), out.join(' '));
}
