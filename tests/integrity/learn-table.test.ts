/**
 * SPEC v1.1 §14.6-8: every curriculum learn item says what practises it (`practicedBy`), every reference names an
 * existing exercise (or self-check item), and the links are exactly the §7.1 learn table.
 * M9–M11 accepted the planned v1.1 exercise ids of §11.2 before they were registered; from M12 every id must be
 * a registered plugin and every E5 variant an existing pattern (or the dynamics mode).
 */
import { describe, expect, it } from 'vitest';
import { CURRICULUM } from '../../src/content/curriculum';
import { STRUM_PATTERNS } from '../../src/content/patterns';
import { SELF_CHECK_IDS } from '../../src/content/selfChecks';
import { registerAllExercises, registeredExerciseTypes } from '../../src/exercises/catalog';

/** §7.1 learn table: per stage, each learn item's practicedBy, in order. */
const LEARN_TABLE: Readonly<Record<number, readonly (readonly string[])[]>> = {
  0: [['E0'], ['K1:posture'], ['K1:pick'], ['Q1'], ['E16'], ['E5:P0', 'K1:countAloud']],
  1: [['E1', 'Q2'], ['E4'], ['E2'], ['E6'], ['S']],
  2: [['E1', 'Q2'], ['E6'], ['K1:footTap', 'E5'], ['E5'], ['E17']],
  3: [['E1', 'Q2'], ['E5:P1'], ['E5:P2'], ['E2']],
  4: [['E1', 'Q2'], ['E5'], ['E5:P3'], ['E7'], ['Q5'], ['E17']],
  5: [['E1', 'Q2'], ['E2'], ['E5:P3', 'E6'], ['Q3']],
  6: [['E1', 'Q2'], ['E8'], ['E5:P5'], ['Q3'], ['E2']],
  7: [['E4'], ['E2'], ['E5:dynamics'], ['Q4'], ['S']],
  8: [['E1', 'Q2'], ['E3'], ['E10'], ['E5:P4'], ['E5:P6', 'K1:deliberateMute'], ['Q3'], ['E17']],
  9: [['E1', 'Q2'], ['E12'], ['E10'], ['E3'], ['Q4']],
  10: [['E1', 'Q2'], ['E5:P4', 'K1:palmMute'], ['E10'], ['Q3'], ['E9'], ['E17']],
  11: [['E1', 'Q2'], ['S'], ['E5:P7', 'E5:P8'], ['E11'], ['Q4']],
};

const E5_VARIANTS = new Set(['dynamics']);

registerAllExercises();
const registered = new Set(registeredExerciseTypes());
const patterns = new Set(STRUM_PATTERNS.map((p) => p.id));

function refProblem(ref: string): string | null {
  const [exercise, variant] = ref.split(':') as [string, string | undefined];
  if (exercise === 'K1') {
    if (!variant || !(SELF_CHECK_IDS as readonly string[]).includes(variant))
      return `${ref}: unknown self-check item`;
    return null;
  }
  if (!registered.has(exercise)) return `${ref}: unknown exercise`;
  if (variant !== undefined) {
    if (exercise !== 'E5') return `${ref}: only E5 has variants`;
    if (!patterns.has(variant) && !E5_VARIANTS.has(variant)) return `${ref}: unknown E5 variant`;
  }
  return null;
}

describe('§14.6-8 learn items are practised (practicedBy)', () => {
  it('every stage has the §7.1 learn table links, item by item', () => {
    for (const def of CURRICULUM) {
      expect(
        def.learn.map((l) => l.practicedBy),
        `stage ${def.stage}`,
      ).toEqual(LEARN_TABLE[def.stage]);
    }
  });

  it('every practicedBy reference names an exercise, an E5 variant or a self-check item that exists', () => {
    const problems = CURRICULUM.flatMap((def) => def.learn.flatMap((l) => l.practicedBy.map(refProblem)));
    expect(problems.filter((p) => p !== null)).toEqual([]);
  });

  it('the reference check rejects unknown ids (self-test)', () => {
    expect(refProblem('E99')).not.toBeNull();
    expect(refProblem('K1:nope')).not.toBeNull();
    expect(refProblem('E5:P42')).not.toBeNull();
    expect(refProblem('Q2:x')).not.toBeNull();
    expect(refProblem('E5:P0')).toBeNull();
    expect(refProblem('K1:posture')).toBeNull();
  });
});
