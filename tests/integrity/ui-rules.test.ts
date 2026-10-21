/**
 * UI goal source rules (docs/goal/ui/SPEC.md §5, UR-1–UR-2). Pinned by SHA-256 in the goal condition, and
 * self-contained on purpose: it reads the files itself instead of sharing helpers the run may edit.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');

function files(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    for (const name of readdirSync(abs)) {
      const full = join(abs, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (pattern.test(name)) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

/** Tailwind's built-in palette (and white/black): colours must come from the theme tokens instead. */
const PALETTE =
  /(?<![\w-])(?:[a-z-]+:)*-?(?:bg|text|border(?:-[trblxy])?|ring|ring-offset|fill|stroke|from|to|via|outline|shadow|decoration|accent|caret|divide|placeholder)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?![\w-])/;

describe('UR-1 colours come from the theme tokens', () => {
  it('the pattern catches palette classes (self-test)', () => {
    for (const bad of [
      'bg-slate-800',
      'hover:text-blue-400',
      'border-t-gray-200',
      'text-white',
      'lg:bg-black/50',
    ])
      expect(PALETTE.test(` ${bad} `), bad).toBe(true);
    for (const ok of ['bg-surface-2', 'text-accent', 'border-border', 'ring-focus', 'bg-accent-soft'])
      expect(PALETTE.test(` ${ok} `), ok).toBe(false);
  });

  it('no Tailwind palette colour class in src (outside the Korean text modules)', () => {
    const found: string[] = [];
    for (const f of files('src', /\.(tsx?|css)$/)) {
      if (f.startsWith(join('src', 'i18n')) || f.startsWith(join('src', 'content'))) continue;
      readFileSync(join(ROOT, f), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          const m = line.match(PALETTE);
          if (m) found.push(`${f}:${i + 1} ${m[0]}`);
        });
    }
    expect(found, found.join('\n')).toEqual([]);
  });
});

describe('UR-2 safe areas', () => {
  it('the app pads all four safe-area insets (notch, home indicator, landscape sides)', () => {
    const css = files('src', /\.(tsx?|css)$/)
      .map((f) => readFileSync(join(ROOT, f), 'utf8'))
      .join('\n');
    for (const side of ['top', 'right', 'bottom', 'left'])
      expect(css.includes(`env(safe-area-inset-${side}`), side).toBe(true);
  });
});
