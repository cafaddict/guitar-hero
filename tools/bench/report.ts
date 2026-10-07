/**
 * Writes docs/BENCHMARK.md (generated) from a test-split run, preserving the "test-run log" section.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CoverageReport } from '../../src/domain/coverage';
import type { Breakdown, MetricResult } from './metrics';

const REPORT = join(import.meta.dirname, '..', '..', 'docs', 'BENCHMARK.md');
const LOG_HEADER = '## test-run log';

export interface ReportPayload {
  split: string;
  detectorVersion: string;
  createdAt: string;
  elapsedS: number;
  cases: number;
  metrics: MetricResult[];
  breakdowns: Breakdown[];
  coverage: CoverageReport;
  excluded: Record<string, number>;
  guitarset?: unknown;
}

const fmt = (v: number) =>
  !Number.isFinite(v)
    ? String(v)
    : Math.abs(v) >= 100
      ? v.toFixed(1)
      : Math.abs(v) >= 1
        ? v.toFixed(3)
        : v.toFixed(4);

const GS_START = '<!-- guitarset:start -->';
const GS_END = '<!-- guitarset:end -->';

/** The GuitarSet section written by bench:guitarset (kept verbatim across bench:dsp runs). */
function existingGuitarSetSection(): string | null {
  if (!existsSync(REPORT)) return null;
  const text = readFileSync(REPORT, 'utf8');
  const start = text.indexOf(GS_START);
  const end = text.indexOf(GS_END);
  return start >= 0 && end > start ? text.slice(start, end + GS_END.length) : null;
}

function existingLog(): string[] {
  if (!existsSync(REPORT)) return [];
  const text = readFileSync(REPORT, 'utf8');
  const idx = text.indexOf(LOG_HEADER);
  if (idx < 0) return [];
  return text
    .slice(idx + LOG_HEADER.length)
    .split('\n')
    .filter((l) => l.startsWith('- '));
}

/** Replaces the generated part of BENCHMARK.md and appends one line to the test-run log. */
export function writeBenchmarkReport(p: ReportPayload): void {
  const failed = p.metrics.filter((m) => !m.pass);
  const lines: string[] = [];
  lines.push('# BENCHMARK — 합성 DSP 벤치마크 (생성 파일)');
  lines.push('');
  lines.push(
    '> `npm run bench:dsp`(test split)가 생성한다. 손으로 고치지 않는다. GuitarSet 결과는 `npm run bench:guitarset`가 아래 별도 절에 쓴다.',
  );
  lines.push('');
  lines.push(
    `- 실행: ${p.createdAt} · split **${p.split}** · detectorVersion **${p.detectorVersion}** · ${p.cases} cases · ${p.elapsedS.toFixed(0)} s`,
  );
  lines.push(
    `- 결과: **${failed.length === 0 ? 'ALL THRESHOLDS MET' : `${failed.length} FAILED`}** (임계값: \`docs/goal/thresholds.json\`)`,
  );
  lines.push('');
  lines.push('## 지표 요약');
  lines.push('');
  lines.push('| 영역 | 지표 | 값 | 임계값 | 판정 | n |');
  lines.push('|---|---|---|---|---|---|');
  for (const m of p.metrics)
    lines.push(
      `| ${m.area} | ${m.key} | ${fmt(m.value)} | ${fmt(m.threshold)} | ${m.pass ? 'PASS' : 'FAIL'} | ${m.n} |`,
    );
  lines.push('');
  lines.push('## 스트럼 모드 검증 가능 줄 커버리지 (Stage 0–7, §6.3 기본 규칙)');
  lines.push('');
  lines.push('| 보이싱 | 연주 줄 | verifiable 줄 | 비율 | verifiable idx (0=6번 줄) |');
  lines.push('|---|---|---|---|---|');
  for (const r of p.coverage.rows)
    lines.push(
      `| ${r.voicingId} | ${r.playedStrings} | ${r.verifiableStrings} | ${r.ratio.toFixed(2)} | ${r.verifiableIdx.join(', ')} |`,
    );
  lines.push(`| **전체** | | | **${p.coverage.overallRatio.toFixed(3)}** | |`);
  lines.push('');
  lines.push('## 제외한 불가능 조합 (§14.3-5)');
  lines.push('');
  lines.push(
    Object.keys(p.excluded).length
      ? Object.entries(p.excluded)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join('\n')
      : '- 없음',
  );
  lines.push('');
  lines.push('## 조건별 분해');
  lines.push('');
  for (const b of p.breakdowns) {
    if (b.rows.length === 0) continue;
    lines.push(`<details><summary>${b.area}.${b.key} × ${b.dim}</summary>`);
    lines.push('');
    lines.push(`| ${b.dim} | 값 | n |`);
    lines.push('|---|---|---|');
    for (const r of b.rows) lines.push(`| ${r.value} | ${fmt(r.metric)} | ${r.n} |`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }
  const guitarset = existingGuitarSetSection();
  if (guitarset) lines.push(guitarset, '');
  const log = existingLog();
  log.push(
    `- ${p.createdAt} · detector ${p.detectorVersion} · split ${p.split} · ${failed.length === 0 ? 'PASS (all thresholds met)' : `FAIL (${failed.map((m) => `${m.area}.${m.key}`).join(', ')})`}`,
  );
  lines.push(LOG_HEADER);
  lines.push('');
  lines.push(...log);
  lines.push('');
  writeFileSync(REPORT, lines.join('\n'));
}
