import { describe, expect, it } from 'vitest';
import { extractMetrics, pinkyResultSchema } from '../../domain/exerciseResults';
import { testContext } from '../testing/fakes';
import { e12ParamsSchema, PinkyRunner } from './runner';

describe('E12 pinky exercise (SPEC v1.1 §11.17)', () => {
  it('two-minute block → clarity 1–3 → pain 0–10; completion only when the block ran out', () => {
    const t = testContext({ mic: false });
    const runner = new PinkyRunner(t.ctx, e12ParamsSchema.parse({}));
    runner.start();
    runner.command('toggle');
    t.output.run(t.clock, 121, () => runner.tick());
    expect(runner.snapshot()).toMatchObject({ phase: 'review', view: { question: 'clarity' } });
    runner.command('manual2');
    runner.command('inc');
    runner.command('inc');
    runner.command('next');
    const result = pinkyResultSchema.parse(runner.finish());
    expect(result).toEqual({ completed: true, clarity: 2, pain: 2, durationMs: 120_000 });
    expect(extractMetrics('E12', result)).toEqual([
      { subjectKey: 'pinky', metric: 'done', value: 1 },
      { subjectKey: 'pinky', metric: 'clarity', value: 2 },
      { subjectKey: 'pinky', metric: 'pain', value: 2 },
    ]);
  });

  it('stopping early is not a completion', () => {
    const t = testContext({ mic: false });
    const runner = new PinkyRunner(t.ctx, e12ParamsSchema.parse({}));
    runner.start();
    runner.command('toggle');
    t.output.run(t.clock, 30, () => runner.tick());
    runner.command('next');
    expect(runner.finish().completed).toBe(false);
  });
});
