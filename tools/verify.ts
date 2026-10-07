/**
 * verify orchestrator (SPEC §5.3, §14.7).
 *
 * Runs every quality gate in a fixed order, records status and wall time, prints the summary table
 * and writes it to bench-results/verify-summary.txt. Exit 1 if any step FAILs.
 *
 * Step protocol: a step may print `VERIFY_DETAIL: <text>` (shown in parentheses) and exits with
 *   0 = PASS, BLOCKED_EXIT_CODE = BLOCKED (accepted only for bench:guitarset with its marker file), other = FAIL.
 * A step whose entry file does not exist yet is NOT_YET (allowed only before its milestone).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const BLOCKED_EXIT_CODE = 3;
const ROOT = join(import.meta.dirname, '..');
const RESULTS_DIR = join(ROOT, 'bench-results');
const LOG_DIR = join(RESULTS_DIR, 'verify-logs');
const GUITARSET_MARKER = join(ROOT, 'data', 'guitarset', '.download-blocked');

type StepStatus = 'PASS' | 'FAIL' | 'BLOCKED' | 'NOT_YET';

interface StepDef {
  name: string;
  command: string;
  /** Files that must exist for the step to be implemented; otherwise NOT_YET. */
  requires: string[];
  /** Extracts the parenthesized detail from the captured output. */
  detail?: (output: string) => string | undefined;
}

interface StepResult {
  name: string;
  status: StepStatus;
  ms: number;
  detail: string | undefined;
}

function lastDetail(output: string): string | undefined {
  const matches = [...output.matchAll(/^VERIFY_DETAIL: (.+)$/gm)];
  return matches.at(-1)?.[1]?.trim();
}

function vitestDetail(): string | undefined {
  const file = join(RESULTS_DIR, 'vitest.json');
  if (!existsSync(file)) return undefined;
  const report = JSON.parse(readFileSync(file, 'utf8')) as {
    numTotalTests?: number;
    numPassedTests?: number;
  };
  return `${report.numPassedTests ?? 0}/${report.numTotalTests ?? 0} tests`;
}

function e2eDetail(): string | undefined {
  const file = join(ROOT, 'test-results', 'e2e-results.json');
  if (!existsSync(file)) return undefined;
  const report = JSON.parse(readFileSync(file, 'utf8')) as {
    stats?: { expected?: number; unexpected?: number; flaky?: number; skipped?: number };
    config?: { projects?: unknown[] };
  };
  const s = report.stats ?? {};
  const total = (s.expected ?? 0) + (s.unexpected ?? 0) + (s.flaky ?? 0) + (s.skipped ?? 0);
  return `${s.expected ?? 0}/${total} tests, ${report.config?.projects?.length ?? 0} projects`;
}

export const STEPS: readonly StepDef[] = [
  { name: 'licenses', command: 'npm run licenses', requires: ['tools/licenses.ts'], detail: lastDetail },
  { name: 'typecheck', command: 'npm run typecheck', requires: [] },
  { name: 'lint', command: 'npm run lint', requires: [] },
  {
    name: 'test',
    command: 'npx vitest run --reporter=default --reporter=json --outputFile.json=bench-results/vitest.json',
    requires: [],
    detail: vitestDetail,
  },
  { name: 'bench:dsp', command: 'npm run bench:dsp', requires: ['tools/bench/run.ts'], detail: lastDetail },
  {
    name: 'bench:guitarset',
    command: 'npm run bench:guitarset',
    requires: ['tools/guitarset/bench.ts'],
    detail: lastDetail,
  },
  { name: 'build', command: 'npm run build', requires: [] },
  { name: 'test:e2e', command: 'npm run test:e2e', requires: ['playwright.config.ts'], detail: e2eDetail },
];

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}

function runStep(step: StepDef): Promise<{ code: number; output: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(step.command, { cwd: ROOT, shell: true, env: { ...process.env, FORCE_COLOR: '0' } });
    let output = '';
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => resolvePromise({ code: code ?? 1, output }));
  });
}

function gitShortSha(): Promise<string> {
  return new Promise((resolvePromise) => {
    const child = spawn('git rev-parse --short HEAD', { cwd: ROOT, shell: true });
    let out = '';
    child.stdout.on('data', (c: Buffer) => {
      out += c.toString();
    });
    child.on('close', () => resolvePromise(out.trim() || 'unknown'));
  });
}

export function renderSummary(sha: string, results: readonly StepResult[]): string {
  const lines = [`VERIFY SUMMARY (guitar-hero @ ${sha})`, `${'step'.padEnd(18)}${'status'.padEnd(10)}time`];
  for (const r of results) {
    const time = r.status === 'NOT_YET' ? '-' : formatDuration(r.ms);
    const detail = r.detail ? ` (${r.detail})` : '';
    lines.push(`${r.name.padEnd(18)}${r.status.padEnd(10)}${time.padEnd(6)}${detail}`.trimEnd());
  }
  const failed = results.filter((r) => r.status === 'FAIL');
  const blocked = results.filter((r) => r.status === 'BLOCKED');
  const notYet = results.filter((r) => r.status === 'NOT_YET');
  if (failed.length > 0) {
    lines.push(`RESULT: FAIL (${failed.map((r) => r.name).join(', ')})`);
  } else {
    const notes = [
      ...blocked.map((r) => `BLOCKED: ${r.name}`),
      ...(notYet.length > 0 ? [`NOT_YET: ${notYet.map((r) => r.name).join(', ')}`] : []),
    ];
    lines.push(`RESULT: PASS${notes.length > 0 ? ` (${notes.join('; ')})` : ''}`);
  }
  return lines.join('\n');
}

async function main(): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  const results: StepResult[] = [];
  for (const step of STEPS) {
    if (!step.requires.every((file) => existsSync(join(ROOT, file)))) {
      results.push({ name: step.name, status: 'NOT_YET', ms: 0, detail: undefined });
      continue;
    }
    console.log(`\n=== verify: ${step.name} (${step.command}) ===`);
    const started = performance.now();
    const { code, output } = await runStep(step);
    const ms = performance.now() - started;
    writeFileSync(join(LOG_DIR, `${step.name.replace(/[:]/g, '_')}.log`), output);
    let status: StepStatus = code === 0 ? 'PASS' : 'FAIL';
    if (code === BLOCKED_EXIT_CODE && step.name === 'bench:guitarset') {
      status = existsSync(GUITARSET_MARKER) ? 'BLOCKED' : 'FAIL';
    }
    results.push({ name: step.name, status, ms, detail: step.detail?.(output) });
  }
  const summary = renderSummary(await gitShortSha(), results);
  let printed = `\n${summary}\n`;
  if (results.some((r) => r.status === 'BLOCKED') && existsSync(GUITARSET_MARKER)) {
    printed += `\nGuitarSet download-blocked marker (${GUITARSET_MARKER}):\n${readFileSync(GUITARSET_MARKER, 'utf8')}\n`;
  }
  console.log(printed);
  writeFileSync(join(RESULTS_DIR, 'verify-summary.txt'), printed.trimStart());
  process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
}

if (process.argv[1]?.endsWith('verify.ts')) void main();
