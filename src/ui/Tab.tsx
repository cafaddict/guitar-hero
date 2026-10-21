/**
 * TAB renderer (SPEC v1.1 §6.9): six horizontal lines, the top line is the 1st (high E) string — the TAB
 * convention, independent of the left-handed setting. Fret numbers sit on their string; the current note is
 * highlighted. `hidden` keeps the lines and positions but hides the numbers (memorization).
 * D-080: the string numbers 1–6 label the lines, `barSize` draws bar lines, and `fingers` adds a row under the
 * 6th string with the fretting finger of each note (blank for an open string; hidden with the numbers).
 */
import { type RefObject, useEffect, useRef, useState } from 'react';
import type { RiffNote } from '../content/riffs';
import { ko } from '../i18n/ko';

const LINE_GAP = 14;
const NOTE_W = 26;
const PAD = 14;
/** Room left of the lines for the string numbers. */
const LABEL_W = 18;
const FINGER_ROW_GAP = 20;
/**
 * The most a TAB is scaled up: a short cycle (four notes) would otherwise fill a wide screen with 100 px digits.
 * At 2.5 the numbers are about 32 px, readable from a music stand.
 */
const MAX_SCALE = 2.5;
/**
 * The least a TAB is scaled: the fret numbers stay about 14 px. A longer cycle on a phone (a 22-note scale ladder
 * would shrink to 7 px digits) scrolls sideways instead and follows the current note (F-34, D-094).
 */
const MIN_SCALE = 1.1;

/** Whether an element's content is wider than the element (it scrolls sideways), kept current on resize. */
function useOverflowX(ref: RefObject<HTMLElement | null>): boolean {
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(check);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [ref]);
  return overflowing;
}

export function Tab({
  notes,
  current = null,
  hidden = false,
  label,
  barSize,
  fingers,
}: {
  notes: readonly Pick<RiffNote, 'string' | 'fret'>[];
  current?: number | null;
  hidden?: boolean;
  label: string;
  /** Notes per bar: a bar line after every `barSize` notes. */
  barSize?: number;
  /** Fretting finger per note (0 = open string). */
  fingers?: readonly number[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const overflowing = useOverflowX(scroller);
  const left = PAD + LABEL_W;
  const width = left + PAD + notes.length * NOTE_W;
  // A TAB wider than its column keeps the current note in the middle of what shows (instantly: no motion).
  useEffect(() => {
    const box = scroller.current;
    if (!box || !overflowing || current === null) return;
    const scale = box.scrollWidth / width;
    box.scrollLeft = (PAD + LABEL_W + current * NOTE_W + NOTE_W / 2) * scale - box.clientWidth / 2;
  }, [overflowing, current, width]);
  const yOf = (stringNo: number) => PAD + (stringNo - 1) * LINE_GAP;
  const fingerY = yOf(6) + FINGER_ROW_GAP;
  const height = (fingers ? fingerY : yOf(6)) + PAD;
  const xOf = (i: number) => left + i * NOTE_W + NOTE_W / 2;
  const barLines =
    barSize && barSize > 0
      ? Array.from(
          { length: Math.ceil(notes.length / barSize) - 1 },
          (_, b) => left + (b + 1) * barSize * NOTE_W,
        )
      : [];
  return (
    <div
      ref={scroller}
      className="w-full overflow-x-auto"
      // Only while it scrolls sideways: a scroller takes the keyboard focus (WCAG 2.1.1).
      tabIndex={overflowing ? 0 : undefined}
    >
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block h-auto w-full text-fg"
        style={{ minWidth: `${width * MIN_SCALE}px`, maxWidth: `${width * MAX_SCALE}px` }}
        data-testid="tab"
      >
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <g key={s}>
            <text
              data-role="string-number"
              x={PAD + LABEL_W / 2 - 4}
              y={yOf(s) + 4}
              textAnchor="middle"
              fontSize="10"
              className="fill-muted"
            >
              {s}
            </text>
            <line
              x1={left - 4}
              x2={width - PAD / 2}
              y1={yOf(s)}
              y2={yOf(s)}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.6"
            />
          </g>
        ))}
        {barLines.map((x) => (
          <line
            key={x}
            data-role="bar-line"
            x1={x}
            x2={x}
            y1={yOf(1)}
            y2={yOf(6)}
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.8"
          />
        ))}
        {fingers && (
          <text
            data-role="finger-label"
            x={PAD + LABEL_W / 2 - 4}
            y={fingerY + 4}
            textAnchor="middle"
            fontSize="10"
            className="fill-muted"
          >
            {ko.exercises.sequence.fingerRow}
          </text>
        )}
        {notes.map((note, i) => {
          const x = xOf(i);
          const active = i === current;
          const finger = fingers?.[i] ?? 0;
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
              {!hidden && fingers && finger > 0 && (
                <text
                  data-role="finger"
                  x={x}
                  y={fingerY + 4}
                  textAnchor="middle"
                  fontSize="11"
                  className={active ? 'fill-accent font-bold' : 'fill-muted'}
                >
                  {finger}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
