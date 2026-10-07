/**
 * Where the benchmark report is written. `npm run bench:dsp` / `bench:guitarset` update the tracked report of
 * record, docs/BENCHMARK.md. The verify gate sets BENCHMARK_REPORT to its own copy under bench-results/ so a
 * gate run leaves the work tree clean (SPEC §16.2: nothing changes after the final verify), while that copy still
 * carries the full report and test-run log of the gate's run (D-050).
 */
import { isAbsolute, join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
export const DOCS_REPORT = join(ROOT, 'docs', 'BENCHMARK.md');

export function benchmarkReportPath(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const override = env.BENCHMARK_REPORT;
  if (!override) return DOCS_REPORT;
  return isAbsolute(override) ? override : resolve(ROOT, override);
}
