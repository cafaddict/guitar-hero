import { describe, expect, it } from 'vitest';
import { actionForKey, defaultActionForKey, isEditableTarget, isNativeActivation } from './keys';

const key = (k: string, code = '') => ({ key: k, code });

describe('actionForKey (SPEC §12.3)', () => {
  it.each([
    [' ', 'toggle'],
    ['Enter', 'next'],
    ['PageDown', 'next'],
    ['ArrowRight', 'next'],
    ['PageUp', 'prev'],
    ['ArrowLeft', 'prev'],
    ['ArrowUp', 'inc'],
    ['+', 'inc'],
    ['ArrowDown', 'dec'],
    ['-', 'dec'],
    ['Escape', 'abort'],
    ['1', 'manual1'],
    ['2', 'manual2'],
    ['3', 'manual3'],
  ])('%s → %s', (k, action) => {
    expect(actionForKey(key(k))).toBe(action);
  });

  it('learned pedal bindings override defaults; modifiers are ignored', () => {
    expect(actionForKey(key('b', 'KeyB'), { KeyB: 'next' })).toBe('next');
    expect(actionForKey(key('PageDown', 'PageDown'), { PageDown: 'inc' })).toBe('inc');
    expect(actionForKey({ ...key('1'), metaKey: true })).toBeNull();
    expect(actionForKey(key('q'))).toBeNull();
  });

  it('never steals keys from form fields', () => {
    expect(isEditableTarget({ tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget)).toBe(
      true,
    );
    expect(isEditableTarget({ tagName: 'BUTTON', isContentEditable: false } as unknown as EventTarget)).toBe(
      false,
    );
    expect(isEditableTarget(null)).toBe(false);
  });

  it('leaves Enter/Space on a focused button to the button itself (no double action)', () => {
    const el = (tagName: string, role: string | null = null) =>
      ({ tagName, getAttribute: () => role }) as unknown as EventTarget;
    expect(isNativeActivation({ key: 'Enter', target: el('BUTTON') })).toBe(true);
    expect(isNativeActivation({ key: ' ', target: el('A') })).toBe(true);
    expect(isNativeActivation({ key: 'Enter', target: el('DIV', 'button') })).toBe(true);
    expect(isNativeActivation({ key: 'PageDown', target: el('BUTTON') })).toBe(false);
    expect(isNativeActivation({ key: 'Enter', target: el('BODY') })).toBe(false);
    expect(isNativeActivation({ key: 'Enter', target: null })).toBe(false);
  });

  it('v1.1 option keys (SPEC v1.1 §12.3) are new keys: every v1 default keeps its action', () => {
    const v1: [string, string][] = [
      [' ', 'toggle'],
      ['Enter', 'next'],
      ['PageDown', 'next'],
      ['ArrowRight', 'next'],
      ['PageUp', 'prev'],
      ['ArrowLeft', 'prev'],
      ['ArrowUp', 'inc'],
      ['+', 'inc'],
      ['=', 'inc'],
      ['ArrowDown', 'dec'],
      ['-', 'dec'],
      ['Escape', 'abort'],
      ['1', 'manual1'],
      ['2', 'manual2'],
      ['3', 'manual3'],
      ['m', 'mark'],
      ['M', 'mark'],
    ];
    for (const [k, action] of v1) expect(defaultActionForKey(k), k).toBe(action);
    const options: [string, string][] = [
      ['e', 'ear'],
      ['E', 'ear'],
      ['v', 'cues'],
      ['V', 'cues'],
      ['l', 'loop'],
      ['L', 'loop'],
      ['h', 'hide'],
      ['H', 'hide'],
      ['b', 'backing'],
      ['B', 'backing'],
    ];
    for (const [k, action] of options) expect(actionForKey(key(k, `Key${k.toUpperCase()}`)), k).toBe(action);
    expect(new Set(options.map(([k]) => k)).size).toBe(options.length);
    for (const [k] of options)
      expect(
        v1.some(([v]) => v === k),
        k,
      ).toBe(false);
  });
});
