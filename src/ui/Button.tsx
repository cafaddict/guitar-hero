import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg',
  secondary: 'bg-surface-2 text-fg',
  ghost: 'bg-transparent text-fg underline',
};

/** Touch-friendly button (≥ 48 px); practice screens pass `large` for ≥ 64 px (SPEC §12.3). */
export function Button({
  variant = 'primary',
  large = false,
  className = '',
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; large?: boolean }) {
  const size = large ? 'min-h-16 px-6 text-lg' : 'min-h-12 px-4';
  return (
    <button
      type={type}
      className={`${size} rounded-lg font-semibold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  );
}
