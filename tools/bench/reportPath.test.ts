import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATE_REPORT } from '../verify';
import { benchmarkReportPath, DOCS_REPORT } from './reportPath';

describe('benchmark report path', () => {
  it('direct bench runs update docs/BENCHMARK.md; the verify gate writes its own copy', () => {
    expect(benchmarkReportPath({})).toBe(DOCS_REPORT);
    expect(DOCS_REPORT.endsWith(join('docs', 'BENCHMARK.md'))).toBe(true);
    expect(benchmarkReportPath({ BENCHMARK_REPORT: GATE_REPORT })).toBe(GATE_REPORT);
    expect(benchmarkReportPath({ BENCHMARK_REPORT: 'bench-results/BENCHMARK.md' })).toBe(GATE_REPORT);
    // The gate copy lives in the ignored results directory, so a verify run leaves the work tree clean.
    expect(GATE_REPORT.endsWith(join('bench-results', 'BENCHMARK.md'))).toBe(true);
  });
});
