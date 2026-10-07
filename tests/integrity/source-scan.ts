/**
 * Helpers for the static source scans in tests/integrity (SPEC §14.6).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const ROOT = join(import.meta.dirname, '..', '..');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-e2e',
  'data',
  'bench-results',
  'test-results',
  '.git',
]);

/** Recursively lists files under `dir` (relative to ROOT) whose names match `pattern`. */
export function listFiles(dir: string, pattern: RegExp): string[] {
  const out: string[] = [];
  const walk = (abs: string) => {
    let entries: string[];
    try {
      entries = readdirSync(abs);
    } catch {
      return;
    }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(abs, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (pattern.test(name)) out.push(relative(ROOT, full));
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

export function readSource(relPath: string): string {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

/**
 * Removes comments (and optionally string/template literal contents) with a small state machine,
 * so words inside comments never trigger a rule. Regex literals are rare in our code and treated as code.
 */
export function stripComments(source: string, options: { stripStrings?: boolean } = {}): string {
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i]!;
    const next = source[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      let literal = c;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') {
          literal += source[i]! + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        literal += source[i]!;
        i++;
      }
      literal += quote;
      i++;
      out += options.stripStrings ? `${quote}${quote}` : literal;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Returns the comment text attached to each line (both `//` and `/* *\/` forms), keyed by line index. */
export function lineComments(source: string): string[] {
  return source.split('\n').map((line) => {
    const idx = line.indexOf('//');
    const block = line.indexOf('/*');
    if (idx >= 0) return line.slice(idx + 2);
    if (block >= 0) return line.slice(block + 2);
    return '';
  });
}
