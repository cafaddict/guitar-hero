/**
 * Live input level (−60…0 dBFS, red when clipping). SPEC §5.1: 60 fps visuals bypass React state — a
 * requestAnimationFrame loop reads the latest level and draws on a canvas; the text and the native <meter>
 * (for assistive tech) are updated through refs a few times per second.
 */
import { useEffect, useRef } from 'react';
import type { LevelReading } from '../audio/engine';

const FLOOR_DB = -60;

function toDb(level: LevelReading | null): number | null {
  return level ? 20 * Math.log10(Math.max(level.rms, 1e-9)) : null;
}

export function LevelMeter({
  read,
  label,
  format,
  textTestId,
}: {
  /** Latest level (polled from rAF, e.g. `() => audioEngine.latestLevel`). */
  read: () => LevelReading | null;
  label: string;
  /** Optional text line ("입력 레벨: −23.4 dBFS"). */
  format?: (db: number | null) => string;
  textTestId?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const meter = useRef<HTMLMeterElement>(null);
  const text = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let frame = 0;
    let lastText = 0;
    const draw = (now: number) => {
      const level = read();
      const db = toDb(level);
      const c = canvas.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) {
        const width = c.clientWidth * devicePixelRatio;
        const height = c.clientHeight * devicePixelRatio;
        if (c.width !== width || c.height !== height) {
          c.width = width;
          c.height = height;
        }
        const styles = getComputedStyle(c);
        const fraction = db === null ? 0 : Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
        ctx.fillStyle = styles.getPropertyValue('--surface-2') || '#334155';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = level?.clipped
          ? styles.getPropertyValue('--fail') || '#f87171'
          : styles.getPropertyValue('--ok') || '#4ade80';
        ctx.fillRect(0, 0, width * fraction, height);
      }
      if (now - lastText > 250) {
        lastText = now;
        const shown = db === null ? FLOOR_DB : Math.max(FLOOR_DB, Math.min(0, db));
        if (meter.current) meter.current.value = Math.round(shown);
        if (text.current && format) text.current.textContent = format(db);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [read, format]);

  return (
    <div className="flex flex-col gap-1">
      {format && (
        <p ref={text} data-testid={textTestId}>
          {format(null)}
        </p>
      )}
      <meter ref={meter} className="sr-only" aria-label={label} min={FLOOR_DB} max={0} value={FLOOR_DB} />
      <div aria-hidden="true">
        <canvas ref={canvas} className="block h-3 w-full rounded" />
      </div>
    </div>
  );
}
