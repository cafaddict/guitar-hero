import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

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
export function buttonClass(variant: ButtonVariant = 'primary', large = false): string {
  const size = large ? 'min-h-16 px-6 text-lg' : 'min-h-12 px-4';
  return `${size} inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[transform,filter] active:translate-y-px disabled:opacity-50 disabled:active:translate-y-0 ${VARIANTS[variant]}`;
}

export function Button({
  variant = 'primary',
  large = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; large?: boolean }) {
  return <button type={type} className={`${buttonClass(variant, large)} ${className}`} {...rest} />;
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
