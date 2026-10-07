/**
 * Synthetic DSP benchmark runner (SPEC §14.3).
 *
 *   npm run bench:dsp:dev   → dev split (seeds 1000–1999), for tuning; prints, never fails the shell
 *   npm run bench:dsp       → test split (seeds 9000–9999); exit 1 if any threshold fails;
 *                              writes bench-results/dsp-test.json and docs/BENCHMARK.md
 * Options (dev only): --modes A,B,C,Cset,D,tuner,rtt  --fraction 0.25
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beginnerCoverageReport } from '../../src/domain/coverage';
import { STANDARD_TUNING } from '../../src/domain/theory';
import { CaptureCore } from '../../src/dsp/capture';
import { MODE_B_COLLISION_PARAMS } from '../../src/dsp/modeB';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { type BenchCase, buildCases, type Split } from './cases';
import { evaluateCase, type Outcome } from './evaluate';
import { evaluateOutcomes, type MetricResult, PERF_KEYS } from './metrics';
import { runInPool } from './pool';
import { renderModeA, renderModeB } from './render';
import { writeBenchmarkReport } from './report';
import { loadThresholds } from './thresholds';

const ROOT = join(import.meta.dirname, '..', '..');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[sorted.length >> 1] ?? Number.NaN;
}

interface PerfResult {
  verifyStrumMedianMs: number;
  verifyPluckMedianMs: number;
  workletBlockAvgMs: number;
}

/** Sequential, single-thread timing on this machine (SPEC §14.3 성능). */
function measurePerf(
  cases: ReturnType<typeof buildCases>,
  thresholds: ReturnType<typeof loadThresholds>,
): PerfResult {
  const strum: number[] = [];
  const pluck: number[] = [];
  const bCases = cases.modeB.filter((c) => c.condition === 'clean').slice(0, 80);
  const aCases = cases.modeA.filter((c) => c.condition === 'ok').slice(0, 80);
  // Warm-up (JIT) then measure the detector's own processingMs.
  for (const c of bCases.slice(0, 10)) evaluateCase(c, thresholds);
  for (const c of aCases.slice(0, 10)) evaluateCase(c, thresholds);
  for (const c of bCases) {
    const o = evaluateCase(c, thresholds);
    if (o.mode === 'B' && o.processingMs > 0) strum.push(o.processingMs);
  }
  for (const c of aCases) {
    const o = evaluateCase(c, thresholds);
    if (o.mode === 'A' && o.processingMs > 0) pluck.push(o.processingMs);
  }
  // Worklet block: CaptureCore over 10 s of a realistic signal at 48 kHz in 128-sample blocks.
  const signal = renderModeB(bCases[0]!, thresholds).signal;
  const pluckSignal = renderModeA(aCases[0]!, thresholds).signal;
  const core = new CaptureCore(48000, { onLevel: () => undefined, onOnset: () => undefined });
  const block = new Float32Array(128);
  const blocks = Math.floor((10 * 48000) / 128);
  for (let w = 0; w < 200; w++) core.processBlock(block);
  const t0 = performance.now();
  for (let b = 0; b < blocks; b++) {
    const src = b % 2 ? signal : pluckSignal;
    const offset = (b * 128) % Math.max(128, src.length - 128);
    for (let i = 0; i < 128; i++) block[i] = src[offset + i] ?? 0;
    core.processBlock(block);
  }
  const workletBlockAvgMs = (performance.now() - t0) / blocks;
  return { verifyStrumMedianMs: median(strum), verifyPluckMedianMs: median(pluck), workletBlockAvgMs };
}

function format(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(3) : v.toFixed(4);
}

export function summaryTable(metrics: readonly MetricResult[]): string {
  const rows = metrics.map((m) => [
    `${m.area}.${m.key}`,
    format(m.value),
    format(m.threshold),
    m.pass ? 'PASS' : 'FAIL',
    String(m.n),
  ]);
  const header = ['metric', 'value', 'threshold', 'verdict', 'n'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join('  ');
  return [line(header), ...rows.map(line)].join('\n');
}

async function main(): Promise<void> {
  const split = (process.argv.includes('--split') ? arg('split') : 'dev') as Split;
  if (split !== 'dev' && split !== 'test') throw new Error('--split dev|test');
  const thresholds = loadThresholds();
  const cases = buildCases(thresholds, split);
  const modes = split === 'dev' ? arg('modes')?.split(',') : undefined;
  const fraction = split === 'dev' ? Number(arg('fraction') ?? '1') : 1;
  const pickModes = (m: string) => !modes || modes.includes(m);
  const take = <T>(xs: T[]) => xs.filter((_, i) => i % Math.max(1, Math.round(1 / fraction)) === 0);
  const all: BenchCase[] = [
    ...(pickModes('C') ? take(cases.modeC) : []),
    ...(pickModes('D') ? take(cases.modeD) : []),
    ...(pickModes('A') ? take(cases.modeA) : []),
    ...(pickModes('B') ? take(cases.modeB) : []),
    ...(pickModes('Cset') ? take(cases.modeCSet) : []),
    ...(pickModes('tuner') ? take(cases.tuner) : []),
    ...(pickModes('rtt') ? take(cases.rtt) : []),
  ];
  const started = performance.now();
  let lastPrint = 0;
  const outcomes: Outcome[] = await runInPool(all, (done, total) => {
    const now = performance.now();
    if (now - lastPrint > 5000 || done === total) {
      lastPrint = now;
      process.stderr.write(
        `  bench:${split} ${done}/${total} cases (${((now - started) / 1000).toFixed(0)}s)\n`,
      );
    }
  });
  const evaluation = evaluateOutcomes(outcomes, thresholds);
  const perf = pickModes('perf') || !modes ? measurePerf(cases, thresholds) : null;
  const metrics = [...evaluation.metrics];
  if (perf) {
    const p = thresholds.synthetic.perf;
    const add = (key: string, value: number) =>
      metrics.push({ area: 'perf', key, value, threshold: p[key]!, pass: value <= p[key]!, n: 1 });
    const values: Record<(typeof PERF_KEYS)[number], number> = {
      verifyStrumMedianMsMax: perf.verifyStrumMedianMs,
      verifyPluckMedianMsMax: perf.verifyPluckMedianMs,
      workletBlockAvgMsMax: perf.workletBlockAvgMs,
    };
    for (const key of PERF_KEYS) add(key, values[key]);
  }
  // Coverage: verifiable-string ratio of the rule the strum verifier uses vs. the §6.3 default rule.
  const coverage = beginnerCoverageReport(STANDARD_TUNING, MODE_B_COLLISION_PARAMS);
  const defaultCoverage = beginnerCoverageReport(STANDARD_TUNING).overallRatio;
  if (!modes) {
    metrics.push({
      area: 'coverage',
      key: 'modeBVerifiableRatioAtLeastDefaultRule',
      value: coverage.overallRatio,
      threshold: defaultCoverage,
      pass:
        coverage.overallRatio >= defaultCoverage &&
        thresholds.synthetic.coverage.modeBVerifiableRatioMustBeAtLeastDefaultRule,
      n: coverage.rows.length,
    });
  }
  const elapsedS = (performance.now() - started) / 1000;
  const failed = metrics.filter((m) => !m.pass);
  console.log(
    `\nDSP benchmark — split ${split}, detector ${DETECTOR_VERSION}, ${outcomes.length} cases, ${elapsedS.toFixed(0)} s`,
  );
  console.log(summaryTable(metrics));
  if (Object.keys(cases.excluded).length)
    console.log(`excluded impossible combinations: ${JSON.stringify(cases.excluded)}`);
  mkdirSync(join(ROOT, 'bench-results'), { recursive: true });
  const payload = {
    split,
    detectorVersion: DETECTOR_VERSION,
    createdAt: new Date().toISOString(),
    elapsedS,
    cases: outcomes.length,
    metrics,
    breakdowns: evaluation.breakdowns,
    perf,
    coverage,
    excluded: cases.excluded,
  };
  writeFileSync(join(ROOT, 'bench-results', `dsp-${split}.json`), `${JSON.stringify(payload, null, 1)}\n`);
  if (split === 'dev' && process.argv.includes('--dump'))
    writeFileSync(join(ROOT, 'bench-results', 'outcomes-dev.json'), JSON.stringify(outcomes));
  if (split === 'test') writeBenchmarkReport(payload);
  console.log(
    `VERIFY_DETAIL: ${failed.length === 0 ? 'all thresholds met' : `${failed.length} thresholds failed`}`,
  );
  process.exit(split === 'test' && failed.length > 0 ? 1 : 0);
}

void main();
