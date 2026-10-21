import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { anchorDrillResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { AnchorDrillRunner } from './runner';

describe('E4 anchor / air drill', () => {
  it('D → A is an anchor drill (finger 1 stays); G → C is an air drill', () => {
    const { ctx } = testContext();
    expect(new AnchorDrillRunner(ctx, { from: 'D', to: 'A', durationMs: 60_000 }, voicingById).kind).toBe(
      'anchor',
    );
    expect(new AnchorDrillRunner(ctx, { from: 'G', to: 'C', durationMs: 60_000 }, voicingById).kind).toBe(
      'air',
    );
  });

  it('timer, then a 0–10 self-report', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new AnchorDrillRunner(ctx, { from: 'C', to: 'G', durationMs: 90_000 }, voicingById);
    runner.start();
    expect(runner.snapshot().phase).toBe('ready');
    runner.command('toggle');
    clock.advance(91);
    runner.tick();
    expect(runner.snapshot().phase).toBe('review');
    for (let k = 0; k < 3; k++) runner.command('inc');
    runner.command('next');
    const result = runner.finish();
    expect(anchorDrillResultSchema.parse(result)).toEqual(result);
    expect(result).toEqual({ pair: 'C|G', kind: 'air', durationMs: 90_000, selfReportSuccess: 8 });
  });

  it('stopped before starting → nothing recorded; stopped mid-way → the drilled time', () => {
    const { ctx, clock } = testContext({ mic: false });
    const idle = new AnchorDrillRunner(ctx, { from: 'C', to: 'G', durationMs: 90_000 }, voicingById);
    idle.start();
    idle.command('abort');
    expect(idle.hasResult()).toBe(false);
    const partial = new AnchorDrillRunner(ctx, { from: 'C', to: 'G', durationMs: 90_000 }, voicingById);
    partial.start();
    partial.command('toggle');
    clock.advance(40);
    partial.command('abort');
    clock.advance(40);
    expect(partial.hasResult()).toBe(true);
    expect(partial.finish()).toMatchObject({ durationMs: 40_000, selfReportSuccess: null });
  });

  it('prev after an early end continues the remaining time (D-096); impossible after time-up', () => {
    const { ctx, clock } = testContext({ mic: false });
    const runner = new AnchorDrillRunner(ctx, { from: 'C', to: 'G', durationMs: 90_000 }, voicingById);
    runner.start();
    runner.command('toggle');
    clock.advance(30);
    runner.command('next');
    runner.command('inc');
    expect(runner.canStepBack()).toBe(true);
    clock.advance(5); // time spent in the review is not drill time
    runner.command('prev');
    expect(runner.snapshot()).toMatchObject({ phase: 'running', remainingMs: 60_000, view: { success: 6 } });
    clock.advance(61);
    runner.tick();
    expect(runner.snapshot().phase).toBe('review');
    expect(runner.canStepBack()).toBe(false);
    runner.command('prev');
    expect(runner.snapshot().phase).toBe('review');
    runner.command('next');
    expect(runner.finish()).toMatchObject({ durationMs: 90_000, selfReportSuccess: 6 });
  });
});
