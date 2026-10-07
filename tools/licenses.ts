/**
 * Production dependency license gate (SPEC §2.4, AC-P3).
 *
 * Reads package-lock.json (lockfile v3 records each package's license), evaluates SPDX expressions
 * against the allowlist, and fails on any GPL-family license or on explicitly banned packages.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

export const ALLOWED_LICENSES: ReadonlySet<string> = new Set([
  'MIT',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'Apache-2.0',
  '0BSD',
  'MPL-2.0',
  'CC0-1.0',
  'Unlicense',
]);

/** Banned regardless of declared license or dependency kind (SPEC §4.3). */
export const BANNED_PACKAGES: ReadonlySet<string> = new Set([
  'essentia.js',
  'pitchfinder',
  'aubio',
  'aubiojs',
  '@spotify/basic-pitch',
]);

interface LockPackage {
  version?: string;
  license?: string;
  dev?: boolean;
  devOptional?: boolean;
}

/**
 * Evaluates a (flat) SPDX expression: `A OR B` passes if any alternative passes,
 * `A AND B` only if all parts pass. Parentheses are stripped (no nested mixes in our tree).
 */
export function isLicenseAllowed(expression: string): boolean {
  const cleaned = expression.replace(/[()]/g, ' ').trim();
  if (/\bGPL|\bLGPL|\bAGPL/i.test(cleaned)) {
    // A GPL-family alternative is acceptable only inside an OR with an allowed license.
    if (!/\bOR\b/.test(cleaned)) return false;
  }
  return cleaned.split(/\s+OR\s+/).some((alternative) =>
    alternative
      .split(/\s+AND\s+/)
      .map((part) => part.trim())
      .every((part) => ALLOWED_LICENSES.has(part)),
  );
}

function packageName(lockPath: string): string {
  const idx = lockPath.lastIndexOf('node_modules/');
  return lockPath.slice(idx + 'node_modules/'.length);
}

function main(): void {
  const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as {
    packages: Record<string, LockPackage>;
  };
  const rows: { name: string; version: string; license: string; ok: boolean }[] = [];
  const failures: string[] = [];
  for (const [path, info] of Object.entries(lock.packages)) {
    if (path === '') continue;
    const name = packageName(path);
    if (BANNED_PACKAGES.has(name)) failures.push(`${name}: banned package (SPEC §4.3)`);
    if (info.dev || info.devOptional) continue;
    const license = info.license ?? 'UNKNOWN';
    const ok = isLicenseAllowed(license);
    rows.push({ name, version: info.version ?? '?', license, ok });
    if (!ok) failures.push(`${name}@${info.version ?? '?'}: ${license}`);
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  const width = Math.max(...rows.map((r) => r.name.length), 7);
  console.log(`${'package'.padEnd(width)}  ${'version'.padEnd(10)}  license`);
  for (const r of rows) {
    console.log(
      `${r.name.padEnd(width)}  ${r.version.padEnd(10)}  ${r.license}${r.ok ? '' : '  <-- NOT ALLOWED'}`,
    );
  }
  console.log(`\n${rows.length} production packages checked.`);
  if (failures.length > 0) {
    console.error(`License check FAILED:\n  ${failures.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`VERIFY_DETAIL: ${rows.length} prod packages, all allowed`);
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) main();
