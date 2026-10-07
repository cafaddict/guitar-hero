/**
 * Chord diagram as an own SVG (D-013: no svguitar). Strings run vertically, 6th string on the left (mirrored
 * for left-handed players), fret 1 at the top with the nut drawn thick when the shape starts there.
 * Finger numbers sit in the dots; x / o above the nut; barres as rounded bars. Screen readers get a full text
 * description, so nothing is conveyed by the picture alone.
 */
import { stringNumber } from '../domain/strings';
import type { ChordVoicing } from '../domain/voicing';
import { ko } from '../i18n/ko';

const FRETS_SHOWN = 4;

export type DiagramMark = 'ok' | 'fail' | 'retry' | null;

export interface ChordDiagramProps {
  voicing: ChordVoicing;
  leftHanded?: boolean;
  /** Highlighted string (idx 0 = 6th string). */
  activeIdx?: number | null;
  /** Per-string result marks shown under the diagram. */
  marks?: readonly DiagramMark[];
  /** Highlight one finger position (Q1 diagram quiz). */
  highlight?: { idx: number; fret: number } | null;
  className?: string;
}

function describe(voicing: ChordVoicing): string {
  const parts = voicing.frets.map((fret, idx) => {
    const stringNo = stringNumber(idx);
    if (fret === 'x') return ko.exercises.e1.mutedString(stringNo);
    if (fret === 0) return ko.exercises.e1.openString(stringNo);
    const finger = voicing.fingers[idx];
    const name =
      finger === null || finger === 0 || finger === undefined ? '' : ko.exercises.e1.fingerName(finger);
    return ko.exercises.e1.fingerAt(stringNo, fret, name);
  });
  return `${ko.exercises.e1.diagramLabel(voicing.symbol)}: ${parts.join(', ')}`;
}

export function ChordDiagram({
  voicing,
  leftHanded = false,
  activeIdx = null,
  marks,
  highlight = null,
  className = '',
}: ChordDiagramProps) {
  const width = 180;
  const height = 230;
  const left = 30;
  const right = width - 30;
  const top = 46;
  const bottom = top + 150;
  const stringGap = (right - left) / 5;
  const fretGap = (bottom - top) / FRETS_SHOWN;
  const x = (idx: number) => left + (leftHanded ? 5 - idx : idx) * stringGap;
  const base = voicing.baseFret;
  const y = (fret: number) => top + (fret - base + 0.5) * fretGap;
  const markColor: Record<Exclude<DiagramMark, null>, string> = {
    ok: 'var(--ok)',
    fail: 'var(--fail)',
    retry: 'var(--retry)',
  };
  const markShape = (mark: Exclude<DiagramMark, null>, cx: number, cy: number) => {
    if (mark === 'ok') return <circle cx={cx} cy={cy} r={6} fill={markColor.ok} />;
    if (mark === 'fail') return <rect x={cx - 6} y={cy - 6} width={12} height={12} fill={markColor.fail} />;
    return (
      <polygon points={`${cx},${cy - 7} ${cx + 7},${cy + 6} ${cx - 7},${cy + 6}`} fill={markColor.retry} />
    );
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={describe(voicing)}
      className={`h-auto w-full max-w-xs ${className}`}
      data-testid="chord-diagram"
    >
      <text x={width / 2} y={18} textAnchor="middle" fontSize={18} fontWeight={700} fill="var(--fg)">
        {voicing.symbol}
      </text>
      {base > 1 && (
        <text
          x={leftHanded ? right + 6 : left - 8}
          y={top + fretGap / 2 + 5}
          textAnchor={leftHanded ? 'start' : 'end'}
          fontSize={12}
          fill="var(--muted)"
        >
          {ko.exercises.e1.baseFret(base)}
        </text>
      )}
      <line x1={left} x2={right} y1={top} y2={top} stroke="var(--fg)" strokeWidth={base === 1 ? 6 : 1.5} />
      {Array.from({ length: FRETS_SHOWN }, (_, k) => k + 1).map((k) => (
        <line
          key={`fret-${k}`}
          x1={left}
          x2={right}
          y1={top + k * fretGap}
          y2={top + k * fretGap}
          stroke="var(--muted)"
          strokeWidth={1.5}
        />
      ))}
      {voicing.frets.map((_, idx) => (
        <line
          key={`string-${stringNumber(idx)}`}
          x1={x(idx)}
          x2={x(idx)}
          y1={top}
          y2={bottom}
          stroke={activeIdx === idx ? 'var(--accent)' : 'var(--fg)'}
          strokeWidth={activeIdx === idx ? 4 : 1 + (5 - idx) * 0.3}
        />
      ))}
      {voicing.frets.map((fret, idx) => {
        const cx = x(idx);
        if (fret === 'x')
          return (
            <text
              key={`top-${stringNumber(idx)}`}
              x={cx}
              y={top - 10}
              textAnchor="middle"
              fontSize={16}
              fill="var(--fg)"
            >
              ×
            </text>
          );
        if (fret === 0)
          return (
            <circle
              key={`top-${stringNumber(idx)}`}
              cx={cx}
              cy={top - 15}
              r={6}
              fill="none"
              stroke="var(--fg)"
              strokeWidth={2}
            />
          );
        return null;
      })}
      {(voicing.barres ?? []).map((b) => {
        const x1 = Math.min(x(b.fromIdx), x(b.toIdx));
        const x2 = Math.max(x(b.fromIdx), x(b.toIdx));
        return (
          <rect
            key={`barre-${b.fret}-${b.fromIdx}`}
            x={x1 - 9}
            y={y(b.fret) - 9}
            width={x2 - x1 + 18}
            height={18}
            rx={9}
            fill="var(--fg)"
          />
        );
      })}
      {voicing.frets.map((fret, idx) => {
        if (typeof fret !== 'number' || fret === 0) return null;
        const finger = voicing.fingers[idx];
        const isHighlight = highlight !== null && highlight.idx === idx && highlight.fret === fret;
        return (
          <g key={`dot-${stringNumber(idx)}`}>
            <circle cx={x(idx)} cy={y(fret)} r={11} fill={isHighlight ? 'var(--accent)' : 'var(--fg)'} />
            {finger !== null && finger !== 0 && finger !== undefined && (
              <text
                x={x(idx)}
                y={y(fret) + 5}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                fill="var(--bg)"
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
      {marks?.map((mark, idx) =>
        mark ? <g key={`mark-${stringNumber(idx)}`}>{markShape(mark, x(idx), bottom + 18)}</g> : null,
      )}
      {voicing.frets.map((_, idx) => (
        <text
          key={`num-${stringNumber(idx)}`}
          x={x(idx)}
          y={height - 4}
          textAnchor="middle"
          fontSize={11}
          fill="var(--muted)"
        >
          {stringNumber(idx)}
        </text>
      ))}
    </svg>
  );
}
