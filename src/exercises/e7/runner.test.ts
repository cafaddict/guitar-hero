import { describe, expect, it } from 'vitest';
import { stretchResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { StretchRunner } from './runner';

describe('E7 stretching', () => {
  it('timer then pain 0–10 (Enter ends early)', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new StretchRunner(ctx, { startFret: 5, durationMs: 60_000 });
    runner.start();
    runner.command('toggle');
    clock.advance(30);
    runner.command('next');
    expect(runner.snapshot().phase).toBe('review');
    runner.command('inc');
    runner.command('inc');
    runner.command('next');
    const result = runner.finish();
    expect(stretchResultSchema.parse(result)).toEqual(result);
    expect(result).toEqual({ startFret: 5, durationMs: 30_000, pain: 2 });
  });

  it('aborted before the report → pain unknown', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new StretchRunner(ctx, { startFret: 4, durationMs: 60_000 });
    runner.start();
    runner.command('toggle');
    runner.command('abort');
    expect(runner.finish().pain).toBeNull();
  });

  it('stopped before starting records nothing', () => {
    const { ctx } = testContext({ mic: false });
    const runner = new StretchRunner(ctx, { startFret: 5, durationMs: 60_000 });
    runner.start();
    runner.command('abort');
    expect(runner.hasResult()).toBe(false);
  });
});
