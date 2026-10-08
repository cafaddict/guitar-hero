/**
 * AC-X1: every registered plugin runs to completion without any audio input (manual / self-report mode),
 * driven only by key commands on a fake clock; results validate against the plugin's schema and produce
 * metrics through the same extractor rebuildDerived() uses.
 */
import { describe, expect, it } from 'vitest';
import { extractMetrics } from '../domain/exerciseResults';
import { registerAllExercises, registeredExerciseTypes } from './catalog';
import { exerciseDefinition } from './registry';
import { TEST_CONTENT, testContext } from './testing/fakes';
import type { RunnerCommand } from './types';

registerAllExercises();

const V1_TYPES = ['E0', 'E1', 'E2', 'E4', 'E5', 'E6', 'E7', 'E8', 'Q1', 'Q2', 'Q3', 'Q4', 'S'];
/** v1 types plus the v1.1 exercises registered so far (SPEC v1.1 §11.2). */
const EXPECTED_TYPES = [...V1_TYPES, 'K1', 'E16', 'E17', 'Q5'];
/** A "keyboard only" user: start, confirm, self-judge clean, adjust, confirm again. */
const SCRIPT: RunnerCommand[] = ['toggle', 'next', 'manual1', 'manual1', 'inc', 'next'];
const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

describe('exercise registry (SPEC §11.1)', () => {
  it('registers every v1 exercise once', () => {
    expect(registeredExerciseTypes().sort()).toEqual([...EXPECTED_TYPES].sort());
    for (const type of V1_TYPES) expect(registeredExerciseTypes()).toContain(type);
  });

  it.each(EXPECTED_TYPES)('%s runs to the end without a microphone', async (type) => {
    const definition = exerciseDefinition(type)!;
    const { ctx, clock, output } = testContext({ mic: false });
    const params = definition.parseParams(definition.defaultParams(TEST_CONTENT));
    const runner = definition.createRunner(ctx, params);
    runner.start();
    await flush();
    let step = 0;
    // Bounded: 600 simulated seconds of commands and clock ticks.
    while (runner.snapshot().phase !== 'done' && step < 2400) {
      runner.command(SCRIPT[step % SCRIPT.length]!);
      output.run(clock, 0.25, () => runner.tick());
      await flush();
      step++;
    }
    expect(runner.snapshot().phase).toBe('done');
    expect(runner.hasResult()).toBe(true);
    const result = definition.resultSchema.parse(runner.finish());
    const metrics = definition.toMetrics(result, params);
    expect(metrics).toEqual(extractMetrics(type, result));
    expect(runner.dspStats()).toEqual({ detectorVersion: null, meanProcessingMs: 0, events: 0 });
    runner.dispose();
  });

  it('rejects invalid params and foreign runners at the erasure boundary', () => {
    const e1 = exerciseDefinition('E1')!;
    expect(() => e1.parseParams({ voicingId: 'C' })).toThrow();
    const { ctx } = testContext({ mic: false });
    const e2 = exerciseDefinition('E2')!;
    const runner = e2.createRunner(ctx, e2.defaultParams(TEST_CONTENT));
    expect(() => e1.renderView({ runner, params: e1.defaultParams(TEST_CONTENT), ctx })).toThrow(
      /not created by this plugin/,
    );
  });

  it.each(EXPECTED_TYPES)('%s stopped right after starting records nothing', async (type) => {
    const definition = exerciseDefinition(type)!;
    const { ctx } = testContext({ mic: false });
    const runner = definition.createRunner(
      ctx,
      definition.parseParams(definition.defaultParams(TEST_CONTENT)),
    );
    runner.start();
    await flush();
    runner.command('abort');
    await flush();
    expect(runner.snapshot().phase).toBe('done');
    expect(runner.hasResult()).toBe(false);
    runner.dispose();
  });
});
