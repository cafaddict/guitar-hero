import { describe, expect, it } from 'vitest';
import { extractMetrics, selfCheckResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { SelfCheckRunner } from './runner';

describe('K1 self-check cards (SPEC v1.1 §11.12)', () => {
  it('answers each card with 1 (됐어요) / 2 (아직) and records the answers', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new SelfCheckRunner(ctx, { items: ['posture', 'pick', 'countAloud'] });
    runner.start();
    expect(runner.snapshot().view.itemId).toBe('posture');
    runner.command('manual1');
    runner.command('manual2');
    expect(runner.snapshot().view.itemId).toBe('countAloud');
    runner.command('prev');
    expect(runner.snapshot().view.itemId).toBe('pick');
    runner.command('manual1');
    runner.command('manual1');
    expect(runner.snapshot().phase).toBe('done');
    const result = selfCheckResultSchema.parse(runner.finish());
    expect(result.items).toEqual([
      { id: 'posture', status: 'done' },
      { id: 'pick', status: 'done' },
      { id: 'countAloud', status: 'done' },
    ]);
    expect(extractMetrics('K1', result)).toContainEqual({
      subjectKey: 'check:pick',
      metric: 'done',
      value: 1,
    });
  });

  it('stopping before any answer records nothing; a partial run records what was answered', () => {
    const { ctx } = testContext({ mic: false });
    const empty = new SelfCheckRunner(ctx, { items: ['posture', 'pick'] });
    empty.start();
    empty.command('abort');
    expect(empty.hasResult()).toBe(false);
    const partial = new SelfCheckRunner(ctx, { items: ['posture', 'pick'] });
    partial.start();
    partial.command('manual2');
    partial.command('abort');
    expect(partial.hasResult()).toBe(true);
    expect(partial.finish().items).toEqual([{ id: 'posture', status: 'notYet' }]);
  });
});
