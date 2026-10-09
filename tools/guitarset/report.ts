/**
 * Writes the GuitarSet section of docs/BENCHMARK.md between markers (bench:dsp preserves it). The verify gate
 * writes into its copy instead (tools/bench/reportPath.ts).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { benchmarkReportPath } from '../bench/reportPath';
import type { GuitarSetMetric } from './bench';
import type { ClipOutcome } from './evaluate';

export const GUITARSET_START = '<!-- guitarset:start -->';
export const GUITARSET_END = '<!-- guitarset:end -->';

const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(4) : String(v));

function metricTable(metrics: readonly GuitarSetMetric[]): string[] {
  return [
    '| 구분 | 지표 | 값 | 임계값 | 판정 | n |',
    '|---|---|---|---|---|---|',
    ...metrics.map(
      (m) =>
        `| ${m.kind === 'hard' ? '**하드**' : '소프트'} | ${m.key} | ${fmt(m.value)} | ${fmt(m.threshold)} | ${m.pass ? 'PASS' : 'FAIL'} | ${m.n} |`,
    ),
  ];
}

export function renderGuitarSetSection(
  p: {
    detectorVersion: string;
    createdAt: string;
    clips: number;
    dev: GuitarSetMetric[];
    test: GuitarSetMetric[];
  },
  outcomes: readonly ClipOutcome[],
): string {
  const byGenre = new Map<string, { singles: number; strums: number; pairs: number; seq: number }>();
  for (const o of outcomes) {
    const g = byGenre.get(o.genre) ?? { singles: 0, strums: 0, pairs: 0, seq: 0 };
    g.singles += o.singles.length;
    g.strums += o.strums.length;
    g.pairs += o.pairs.length;
    g.seq += o.seqNotes.length;
    byGenre.set(o.genre, g);
  }
  const lines = [
    GUITARSET_START,
    '## GuitarSet 실녹음 벤치마크 (`npm run bench:guitarset`, 생성)',
    '',
    `- 실행: ${p.createdAt} · detector **${p.detectorVersion}** · ${p.clips} clips · 데이터: Zenodo 3371780 (GuitarSet 1.1.0, **CC BY 4.0**, Xi et al. 2018) — \`audio_mono-mic\` + \`annotation\``,
    '- 판정은 **test 플레이어(04, 05)**, 튜닝은 dev 플레이어(00–03)만 썼다.',
    '- Funk comp 클립은 주석 없는 뮤트 "칙" 소리가 많아 onset F1에서 제외했다(SPEC §14.4).',
    '- solo 단음 시퀀스(SPEC v1.1 §14.4): 인접 onset 간격·음 지속 ≥ 120 ms, onset + 60 ms에 다른 줄 음이 울리는 중이면 제외, [+30, +130 ms] 윤곽 ±35 cents. 검출 onset(시퀀스 경로)과 ±50 ms 짝지은 음만 하드 지표에 쓰고, test 플레이어의 짝지은 음이 1000개 미만이면 FAIL. onset F1(소프트)은 해머온·슬라이드를 포함한 모든 solo 음 onset(60 ms 묶음)이 정답이다.',
    '- **한계**: GuitarSet 마이크는 스튜디오 콘덴서(근접, 조용한 방)라 휴대폰·노트북 내장 마이크보다 깨끗하다. 실기기 성능은 `bench:real`(녹음 키트)로 확인해야 한다.',
    '',
    '### test (판정)',
    '',
    ...metricTable(p.test),
    '',
    '### dev (참고)',
    '',
    ...metricTable(p.dev),
    '',
    '### 장르별 이벤트 수(전체 플레이어)',
    '',
    '| 장르 | 단음 | 스트럼 | 쌍 | 시퀀스 음(짝지음) |',
    '|---|---|---|---|---|',
    ...[...byGenre.entries()]
      .sort()
      .map(([g, v]) => `| ${g} | ${v.singles} | ${v.strums} | ${v.pairs} | ${v.seq} |`),
    '',
    GUITARSET_END,
  ];
  return lines.join('\n');
}

export function writeGuitarSetSection(
  p: Parameters<typeof renderGuitarSetSection>[0],
  outcomes: readonly ClipOutcome[],
): void {
  const section = renderGuitarSetSection(p, outcomes);
  const report = benchmarkReportPath();
  const text = existsSync(report) ? readFileSync(report, 'utf8') : '# BENCHMARK\n';
  const start = text.indexOf(GUITARSET_START);
  const end = text.indexOf(GUITARSET_END);
  const next =
    start >= 0 && end > start
      ? `${text.slice(0, start)}${section}${text.slice(end + GUITARSET_END.length)}`
      : `${text.trimEnd()}\n\n${section}\n`;
  writeFileSync(report, next);
}
