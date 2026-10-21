/**
 * "하는 법" panel (D-079): the steps of an exercise and the glossary terms it uses. Open before a run starts, so a
 * first-timer reads it before pressing start; folded above the running view, one tap away.
 */
import { ko } from '../../i18n/ko';
import type { HowTo } from '../types';

export function HowToPanel({
  howTo,
  open,
  className = '',
}: {
  howTo: HowTo;
  open: boolean;
  className?: string;
}) {
  const t = ko.exercises.guide;
  return (
    <details
      open={open}
      className={`card group rounded-2xl border border-border bg-surface px-4 py-2 sm:px-5 ${className}`}
      data-testid="how-to"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-accent transition-transform group-open:rotate-90">
          ▸
        </span>
        {t.title}
      </summary>
      <ol
        className="mb-3 mt-1 list-decimal space-y-2 pl-6 text-lg marker:text-muted"
        data-testid="how-to-steps"
      >
        {howTo.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      {howTo.terms.length > 0 && (
        <>
          <h3 className="mt-4 font-semibold">{t.termsTitle}</h3>
          <ul className="mb-3 mt-1 space-y-1.5" data-testid="how-to-terms">
            {howTo.terms.map((term) => (
              <li key={term} data-term={term}>
                <span className="font-semibold">{t.terms[term].name}</span>
                <span className="text-muted"> — {t.terms[term].text}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </details>
  );
}
