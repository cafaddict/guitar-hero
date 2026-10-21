import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

/**
 * A secondary button that shows a state: a pressed toggle (`accent`) or an answer marked right / wrong. It
 * replaces the variant's colours instead of overriding them, so the classes never compete.
 */
export type ButtonSelected = 'accent' | 'ok' | 'fail';

const SELECTED: Record<ButtonSelected, string> = {
  accent: 'border border-accent bg-accent-soft text-fg',
  ok: 'border border-ok bg-ok-soft text-fg',
  fail: 'border border-fail bg-fail-soft text-fg',
};

const VARIANTS: Record<ButtonVariant, string> = {
  // The amber "pilot light": the one action the screen is about.
  primary: 'bg-accent text-accent-fg shadow-lg shadow-accent/20 hover:brightness-110',
  secondary: 'border border-border bg-surface-2 text-fg hover:border-muted',
  ghost: 'bg-transparent text-fg underline underline-offset-4',
};

/**
 * Classes of a touch-friendly button (≥ 48 px); `large` is the practice size (≥ 64 px, SPEC §12.3), found by
 * the layout check through its `min-h-16` class. Only motion is animated: a colour or opacity mid-transition
 * (a theme switch, disabled → enabled, secondary → primary) would read as low contrast for that moment.
 */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  large = false,
  align: 'center' | 'start' = 'center',
  selected: ButtonSelected | null = null,
): string {
  const size = large ? 'min-h-16 px-6 text-lg' : 'min-h-12 px-4';
  const justify = align === 'start' ? 'justify-start text-left' : 'justify-center';
  const colours = selected ? SELECTED[selected] : VARIANTS[variant];
  return `${size} inline-flex items-center ${justify} gap-2 rounded-xl font-semibold transition-[transform,filter] active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0 ${colours}`;
}

export function Button({
  variant = 'primary',
  large = false,
  align = 'center',
  selected = null,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  large?: boolean;
  /** `start`: a list of answers reads from a common left edge. */
  align?: 'center' | 'start';
  /** A state shown by the colours (pressed toggle, right / wrong answer); the text and icon say it too. */
  selected?: ButtonSelected | null;
}) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, large, align, selected)} ${className}`}
      {...rest}
    />
  );
}

/** A navigation link that looks like a button (same sizes and variants). */
export function ButtonLink({
  variant = 'secondary',
  large = false,
  className = '',
  ...rest
}: LinkProps & { variant?: ButtonVariant; large?: boolean }) {
  return <Link className={`${buttonClass(variant, large)} ${className}`} {...rest} />;
}
