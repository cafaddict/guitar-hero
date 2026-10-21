import { describe, expect, it } from 'vitest';
import { prevRoute } from './prevRoute';

describe('← during a run (D-096)', () => {
  it("is the runner's step back while it has one, in a session or not", () => {
    expect(prevRoute({ canStepBack: true, inSession: true, waiting: false })).toBe('runner');
    expect(prevRoute({ canStepBack: true, inSession: false, waiting: false })).toBe('runner');
  });

  it('stays with the runner outside a session (no previous item)', () => {
    expect(prevRoute({ canStepBack: false, inSession: false, waiting: true })).toBe('runner');
    expect(prevRoute({ canStepBack: false, inSession: false, waiting: false })).toBe('runner');
  });

  it('goes to the previous item at once before anything was played, and asks once the run is under way', () => {
    expect(prevRoute({ canStepBack: false, inSession: true, waiting: true })).toBe('previous');
    expect(prevRoute({ canStepBack: false, inSession: true, waiting: false })).toBe('confirmPrevious');
  });
});
