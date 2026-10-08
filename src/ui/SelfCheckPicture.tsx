/**
 * Simple app-drawn pictures for the K1 self-check cards (SPEC v1.1 §11.12): a few strokes each, decorative
 * (the card text carries the meaning), so they are hidden from assistive technology.
 */
const STROKE = { stroke: 'currentColor', strokeWidth: 3, fill: 'none', strokeLinecap: 'round' } as const;

function Shape({ id }: { id: string }) {
  switch (id) {
    case 'posture':
      return (
        <>
          <circle cx="40" cy="20" r="9" {...STROKE} />
          <path d="M40 29 L40 70 M40 70 L60 72 L60 100 M40 45 L70 55" {...STROKE} />
          <ellipse cx="78" cy="68" rx="20" ry="13" {...STROKE} />
          <path d="M90 60 L140 40" {...STROKE} />
        </>
      );
    case 'pick':
      return (
        <>
          <path d="M60 30 Q80 20 100 30 L80 80 Z" {...STROKE} />
          <path d="M30 60 Q60 50 90 58 M40 80 Q65 75 95 70" {...STROKE} />
        </>
      );
    case 'countAloud':
      return (
        <>
          <circle cx="40" cy="55" r="18" {...STROKE} />
          <path d="M70 45 Q80 55 70 65 M82 38 Q98 55 82 72 M94 30 Q116 55 94 80" {...STROKE} />
        </>
      );
    case 'footTap':
      return (
        <>
          <path d="M30 90 L110 90" {...STROKE} />
          <path d="M45 88 L45 60 L70 60 Q95 62 100 80" {...STROKE} />
          <path d="M100 50 L100 70 M92 58 L100 70 L108 58" {...STROKE} />
        </>
      );
    case 'deliberateMute':
      return (
        <>
          <path d="M20 40 L140 40 M20 55 L140 55 M20 70 L140 70" {...STROKE} />
          <path d="M70 25 Q80 45 75 80" {...STROKE} />
        </>
      );
    case 'palmMute':
      return (
        <>
          <rect x="95" y="35" width="10" height="45" {...STROKE} />
          <path d="M20 45 L140 45 M20 58 L140 58 M20 71 L140 71" {...STROKE} />
          <path d="M60 20 Q85 40 90 70 Q70 90 50 80" {...STROKE} />
        </>
      );
    default:
      return <circle cx="80" cy="55" r="30" {...STROKE} />;
  }
}

export function SelfCheckPicture({ id }: { id: string }) {
  return (
    <svg
      viewBox="0 0 160 110"
      className="h-28 w-40 text-accent"
      aria-hidden="true"
      data-testid="self-check-picture"
    >
      <Shape id={id} />
    </svg>
  );
}
