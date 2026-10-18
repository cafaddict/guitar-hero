/** D-084: a pair rule says how far each missing pair is, not only its name. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { PairProgress, RuleEvaluation } from '../../domain/progression';
import { RuleChecklist } from './RuleChecklist';

const pairRule = (pairs: PairProgress[]): RuleEvaluation => ({
  rule: { kind: 'unlockedPairsAtLeast', value: 30, days: 2 },
  met: false,
  progress: 2 / 3,
  missing: pairs.map((p) => p.pairId),
  pairs,
});

describe('RuleChecklist pair progress (D-084)', () => {
  it('shows days reached of days needed and the best run per missing pair', () => {
    const html = renderToStaticMarkup(
      <RuleChecklist
        rules={[
          pairRule([
            { pairId: 'D|E', days: 1, needDays: 2, value: 30, best: 36 },
            { pairId: 'A|E', days: 0, needDays: 2, value: 30, best: 27 },
            { pairId: 'A|D', days: 0, needDays: 2, value: 30, best: null },
          ]),
        ]}
      />,
    );
    expect(html).toContain('D ↔ E: 30회 넘은 날 1/2일 · 최고 36회 — 다른 날 한 번 더 넘기면 돼요');
    expect(html).toContain('A ↔ E: 30회 넘은 날 0/2일 · 최고 27회');
    expect(html).not.toContain('최고 27회 — ');
    expect(html).toContain('A ↔ D: 아직 1분을 채운 실행이 없어요');
    expect(html).not.toContain('남은 것');
  });
});
