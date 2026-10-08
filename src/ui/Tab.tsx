/**
 * TAB renderer (SPEC v1.1 §6.9): six horizontal lines, the top line is the 1st (high E) string — the TAB
 * convention, independent of the left-handed setting. Fret numbers sit on their string; the current note is
 * highlighted. `hidden` keeps the lines and positions but hides the numbers (memorization).
 */
import type { RiffNote } from '../content/riffs';

const LINE_GAP = 14;
const NOTE_W = 26;
const PAD = 14;

export function Tab({
  notes,
  current = null,
  hidden = false,
  label,
}: {
  notes: readonly RiffNote[];
  current?: number | null;
  hidden?: boolean;
  label: string;
}) {
  const width = PAD * 2 + notes.length * NOTE_W;
  const height = PAD * 2 + LINE_GAP * 5;
  const yOf = (stringNo: number) => PAD + (stringNo - 1) * LINE_GAP;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className="h-auto w-full max-w-full text-fg"
      data-testid="tab"
    >
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <line
          key={s}
          x1={PAD / 2}
          x2={width - PAD / 2}
          y1={yOf(s)}
          y2={yOf(s)}
          stroke="currentColor"
          strokeWidth="1"
          opacity="0.6"
        />
      ))}
      {notes.map((note, i) => {
        const x = PAD + i * NOTE_W + NOTE_W / 2;
        const active = i === current;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: a TAB cell is a fixed position in the note sequence; its index is its identity.
          <g key={`${i}-${note.string}-${note.fret}`} data-active={active || undefined}>
            <rect
              x={x - 9}
              y={yOf(note.string) - 8}
              width="18"
              height="16"
              rx="3"
              className={active ? 'fill-accent' : 'fill-bg'}
            />
            {!hidden && (
              <text
                x={x}
                y={yOf(note.string) + 5}
                textAnchor="middle"
                fontSize="13"
                className={active ? 'fill-accent-fg font-bold' : 'fill-fg'}
              >
                {note.fret}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
