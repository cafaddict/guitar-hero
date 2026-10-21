import { ko } from '../i18n/ko';

/**
 * The frame a screen shows while its data loads, instead of an empty page (D-089): quiet card-shaped blocks in
 * the layout's rhythm. Static on purpose: no shimmer (motion and opacity changes are kept out, UQ-7/UQ-8).
 */
export function LoadingPlaceholder({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className="flex flex-col gap-4" data-testid="loading-placeholder">
      <p className="sr-only">{ko.app.loading}</p>
      {Array.from({ length: blocks }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: identical decorative blocks; the index is the identity.
          key={i}
          aria-hidden="true"
          className={`rounded-2xl border border-border bg-surface ${i === 0 ? 'h-40' : 'h-24'}`}
        />
      ))}
    </div>
  );
}
