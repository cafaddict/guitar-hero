import { describe, expect, it } from 'vitest';
import { parseLog } from './report';

describe('BENCHMARK.md test-run log', () => {
  it('keeps every run line and drops anything else that ended up under the header', () => {
    const text = [
      '# BENCHMARK',
      '## test-run log',
      '',
      '- 2026-10-07T15:38:22.554Z · detector 1.0.0 · split test · PASS (all thresholds met)',
      '- 실행: 2026-10-07T15:39:25.274Z · detector **1.0.0** · 240 clips',
      '- 판정은 **test 플레이어(04, 05)**',
      '- 2026-10-07T17:02:11.045Z · detector 1.1.0 · split test · FAIL (modeB.cleanFailMax)',
    ].join('\n');
    expect(parseLog(text)).toEqual([
      '- 2026-10-07T15:38:22.554Z · detector 1.0.0 · split test · PASS (all thresholds met)',
      '- 2026-10-07T17:02:11.045Z · detector 1.1.0 · split test · FAIL (modeB.cleanFailMax)',
    ]);
    expect(parseLog('# nothing')).toEqual([]);
  });
});
