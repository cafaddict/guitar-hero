import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { Icon } from './icons';

/**
 * One look for every text-like field (text and number inputs, selects, text areas), D-089: ≥ 48 px tall, a
 * recessed ground, an outline in the field token (≥ 3:1 on every ground, WCAG 1.4.11), the global focus ring,
 * and visible disabled and invalid (`aria-invalid`) states.
 */
export const FIELD_CLASS =
  'min-h-12 rounded-xl border border-field bg-bg px-3 text-base text-fg disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-fail';

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...rest} />;
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASS} py-2 ${className}`} {...rest} />;
}

/**
 * A select drawn by the app: WebKit ignores the height of a native select (23 px on iPad and iPhone), so the
 * native look is turned off and a chevron marks it as a menu. `className` places the wrapper (width, margins).
 */
export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative flex ${className}`}>
      <select className={`${FIELD_CLASS} w-full min-w-0 cursor-pointer appearance-none pr-10`} {...rest}>
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
      />
    </span>
  );
}

/** A labelled field stacked as label → control → help, the label naming the control. */
export function Field({
  label,
  help,
  children,
  className = '',
}: {
  label: ReactNode;
  help?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control comes in as `children`, inside the label.
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="font-semibold">{label}</span>
      {children}
      {help !== undefined && <span className="text-sm text-muted">{help}</span>}
    </label>
  );
}

/**
 * A checkbox or radio with its text: the whole row is the touch target (≥ 48 px tall), the box 24 px.
 */
export function Choice({
  label,
  className = '',
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type: 'checkbox' | 'radio';
  label: ReactNode;
}) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 ${className}`}>
      <input className="size-6 shrink-0 cursor-pointer" {...rest} />
      <span>{label}</span>
    </label>
  );
}
