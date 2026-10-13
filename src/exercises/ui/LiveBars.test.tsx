import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LiveBar } from '../liveTiming';
import { LiveBars, liveBarText } from './LiveBars';

const bar = (b: number, partial: Partial<LiveBar>): LiveBar => ({
  bar: b,
  status: 'good',
  expected: 1,
  hits: 1,
  misses: 0,
  extras: 0,
  offsetMs: 12,
  judgements: ['hit'],
  ...partial,
});

describe('LiveBars (D-077)', () => {
  it('one cell per bar with its status (pending ones too), the current bar outlined, the last bar described', () => {
    const html = renderToStaticMarkup(
      <LiveBars
        bars={4}
        live={[bar(0, {}), bar(1, { status: 'off', hits: 0, misses: 1, offsetMs: 85, chord: 'wrong' })]}
        current={2}
        kind="beatOne"
      />,
    );
    expect(html.match(/data-testid="live-bar"/g)).toHaveLength(4);
    expect(html).toContain('data-status="good"');
    expect(html).toContain('data-status="off"');
    expect(html.match(/data-status="pending"/g)).toHaveLength(2);
    expect(html).toContain('data-chord="wrong"');
    expect(html).toContain('ring-2');
    expect(html).toContain('2마디: 조금 어긋남 · 늦게 85 ms · 앞 코드 소리 같아요');
  });

  it('counts wording for E5/E8 bars', () => {
    expect(liveBarText(bar(2, { status: 'off', expected: 8, hits: 6, misses: 2, extras: 1 }), 'counts')).toBe(
      '3마디: 6/8 맞음 · 놓침 2 · 더 친 것 1',
    );
    expect(liveBarText(bar(0, { offsetMs: -40 }), 'beatOne')).toBe('1마디: 제때 · 빨리 40 ms');
  });
});
