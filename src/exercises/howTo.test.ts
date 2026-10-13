/** D-079: every exercise explains itself before the run — steps and glossary terms for its params. */
import { describe, expect, it } from 'vitest';
import { ko } from '../i18n/ko';
import { registerAllExercises, registeredExerciseTypes } from './catalog';
import { exerciseDefinition } from './registry';
import { testContext } from './testing/fakes';
import type { HowTo } from './types';

registerAllExercises();

const content = testContext({ mic: false }).ctx.content;

function howToOf(type: string, overrides: Record<string, unknown> = {}): HowTo {
  const definition = exerciseDefinition(type)!;
  const params = { ...(definition.defaultParams(content) as Record<string, unknown>), ...overrides };
  const howTo = definition.howTo(params);
  expect(howTo, type).not.toBeNull();
  return howTo!;
}

describe('"하는 법" for every exercise (D-079)', () => {
  it('every registered exercise has steps in plain words and only known glossary terms', () => {
    const types = registeredExerciseTypes();
    expect(types.length).toBeGreaterThanOrEqual(22);
    for (const type of types) {
      const howTo = howToOf(type);
      expect(howTo.steps.length, type).toBeGreaterThan(0);
      for (const step of howTo.steps) {
        expect(step.trim().length, type).toBeGreaterThan(0);
        expect(step, type).not.toMatch(/undefined|NaN|\[object/);
      }
      for (const term of howTo.terms) expect(Object.keys(ko.exercises.guide.terms), type).toContain(term);
    }
  });

  it('invalid params give no panel instead of breaking the start screen', () => {
    expect(exerciseDefinition('E17')!.howTo({ riffId: 3 })).toBeNull();
  });

  it('the rules come from the runners: E6 pass count, E5 clicks per bar (6/8) and mute term, riff notes per click', () => {
    expect(howToOf('E6', { bars: 16 }).steps.join(' ')).toContain('16마디 중 14마디');
    const sixEight = howToOf('E5', { patternId: 'P5', mode: 'mute' });
    expect(sixEight.steps[0]).toContain('클릭 2번');
    expect(sixEight.steps[1]).toContain('3칸');
    expect(sixEight.terms).toContain('muteStrum');
    expect(howToOf('E5', { patternId: 'P0', mode: 'single' }).terms).not.toContain('muteStrum');
    expect(howToOf('E17', { riffId: 'R1' }).steps.join(' ')).toContain('클릭 한 번에 한 음');
    const r2 = howToOf('E17', { riffId: 'R2' });
    expect(r2.steps.join(' ')).toContain('클릭 한 번에 두 음');
    expect(r2.terms).toEqual(expect.arrayContaining(['tab', 'fingerNumbers', 'stringNumbers']));
    expect(howToOf('E2', { from: 'A', to: 'E', countMode: 'tap' }).steps.join(' ')).toContain('Enter');
  });
});
