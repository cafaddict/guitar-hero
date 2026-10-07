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
};

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
