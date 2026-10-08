/**
 * Keyboard / Bluetooth page-turner mapping (SPEC §12.3). Pedals emulate keys, so they land here too; the
 * pedal-learning mode stores extra `code → action` bindings in settings.customKeys, which win over defaults.
 */
import type { KeyAction } from '../data/settings';

const DEFAULT_KEYS: Readonly<Record<string, KeyAction>> = {
  ' ': 'toggle',
  Enter: 'next',
  PageDown: 'next',
  ArrowRight: 'next',
  PageUp: 'prev',
  ArrowLeft: 'prev',
  ArrowUp: 'inc',
  '+': 'inc',
  '=': 'inc',
  ArrowDown: 'dec',
  '-': 'dec',
  Escape: 'abort',
  '1': 'manual1',
  '2': 'manual2',
  '3': 'manual3',
  m: 'mark',
  M: 'mark',
  // v1.1 option keys (SPEC v1.1 §12.3): E1 E = ear first, E5 V = visual cues, S L = loop, H = hide chart/TAB.
  e: 'ear',
  E: 'ear',
  v: 'cues',
  V: 'cues',
  l: 'loop',
  L: 'loop',
  h: 'hide',
  H: 'hide',
};

/** Default keys per action (for the settings screen). */
export function defaultKeysFor(action: KeyAction): string[] {
  return Object.entries(DEFAULT_KEYS)
    .filter(([, a]) => a === action)
    .map(([key]) => key);
}

export interface KeyLike {
  key: string;
  code: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

/** Action for a key press, or null (modifier chords are left to the browser). */
export function actionForKey(
  event: KeyLike,
  customKeys: Readonly<Record<string, KeyAction>> = {},
): KeyAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  return customKeys[event.code] ?? DEFAULT_KEYS[event.key] ?? null;
}

/** Keys typed into form fields must not drive the exercise. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).tagName !== 'string') return false;
  const el = target as HTMLElement;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Enter/Space on a focused button or link already activates it natively; key handlers that also map those keys
 * must leave them alone or the action would run twice.
 */
export function isNativeActivation(event: { key: string; target: EventTarget | null }): boolean {
  if (event.key !== 'Enter' && event.key !== ' ') return false;
  const target = event.target as HTMLElement | null;
  if (!target || typeof target.tagName !== 'string') return false;
  return target.tagName === 'BUTTON' || target.tagName === 'A' || target.getAttribute('role') === 'button';
}
