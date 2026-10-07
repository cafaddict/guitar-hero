/**
 * GuitarSet download (SPEC §14.4): Zenodo record 3371780 (GuitarSet 1.1.0, CC BY 4.0), only the files listed
 * in thresholds.json (audio_mono-mic.zip, annotation.zip). Checksums come from the Zenodo API. Up to
 * `maxAttempts` tries per file with exponential back-off (curl; Node's fetch prefers IPv6 here and times out);
 * if every attempt fails, the script — and only the script — writes data/guitarset/.download-blocked with each
 * attempt's URL, HTTP status or curl exit code, and time.
 *
 *   npx tsx tools/guitarset/download.ts         (also called by bench:guitarset when data is missing)
 */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { loadThresholds } from '../bench/thresholds';
import { extractZip } from './unzip';

export const ROOT = join(import.meta.dirname, '..', '..');
export const DATA_DIR = join(ROOT, 'data', 'guitarset');

interface ZenodoFile {
  key: string;
  size: number;
  checksum: string;
  links: { self: string };
}

export interface AttemptLog {
  file: string;
  url: string;
  attempt: number;
  time: string;
  httpStatus: number | null;
  error: string | null;
}

async function md5(path: string): Promise<string> {
  const hash = createHash('md5');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

interface CurlResult {
  exitCode: number;
  httpStatus: number | null;
  stdout: string;
}

/** Runs curl (follows redirects, fails on HTTP errors) and returns its exit code and final HTTP status. */
function curl(args: string[], timeoutS: number): Promise<CurlResult> {
  return new Promise((resolvePromise) => {
    execFile(
      'curl',
      [
        '-sS',
        '-L',
        '--fail',
        '--max-time',
        String(timeoutS),
        '-A',
        'guitar-hero-bench/1.0',
        '-w',
        '\n%{http_code}',
        ...args,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        const lines = String(stdout).trimEnd().split('\n');
        const status = Number(lines.at(-1));
        const exitCode =
          error && typeof (error as { code?: unknown }).code === 'number'
            ? (error as { code: number }).code
            : error
              ? 1
              : 0;
        resolvePromise({
          exitCode,
          httpStatus: Number.isFinite(status) && status > 0 ? status : null,
          stdout: lines.slice(0, -1).join('\n'),
        });
      },
    );
  });
}

async function fetchRecord(record: number, log: AttemptLog[], attempt: number): Promise<ZenodoFile[] | null> {
  const url = `https://zenodo.org/api/records/${record}`;
  const res = await curl([url], 60);
  if (res.exitCode !== 0) {
    log.push({
      file: 'record',
      url,
      attempt,
      time: new Date().toISOString(),
      httpStatus: res.httpStatus,
      error: `curl exit ${res.exitCode}`,
    });
    return null;
  }
  try {
    return ((JSON.parse(res.stdout) as { files?: ZenodoFile[] }).files ?? []) as ZenodoFile[];
  } catch (error) {
    log.push({
      file: 'record',
      url,
      attempt,
      time: new Date().toISOString(),
      httpStatus: res.httpStatus,
      error: `bad JSON: ${String(error)}`,
    });
    return null;
  }
}

async function downloadFile(
  file: ZenodoFile,
  target: string,
  log: AttemptLog[],
  attempt: number,
): Promise<boolean> {
  const url = file.links.self;
  const partial = `${target}.part`;
  rmSync(partial, { force: true });
  const res = await curl(['-o', partial, url], 3600);
  if (res.exitCode !== 0) {
    log.push({
      file: file.key,
      url,
      attempt,
      time: new Date().toISOString(),
      httpStatus: res.httpStatus,
      error: `curl exit ${res.exitCode}`,
    });
    rmSync(partial, { force: true });
    return false;
  }
  const [algo, expected] = file.checksum.split(':');
  const actual = algo === 'md5' ? await md5(partial) : '';
  if (actual !== expected) {
    log.push({
      file: file.key,
      url,
      attempt,
      time: new Date().toISOString(),
      httpStatus: res.httpStatus,
      error: `checksum mismatch ${actual} != ${expected}`,
    });
    rmSync(partial, { force: true });
    return false;
  }
  renameSync(partial, target);
  return true;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Returns true when every required file is present, verified and extracted. */
export async function ensureGuitarSet(
  options: { verbose?: boolean } = {},
): Promise<{ ok: boolean; markerPath: string }> {
  const t = loadThresholds();
  const g = t.guitarset;
  const markerPath = join(ROOT, g.download.blockedMarker);
  mkdirSync(DATA_DIR, { recursive: true });
  const log: AttemptLog[] = [];
  const say = (m: string) => options.verbose && console.log(m);

  const extractedFlag = (name: string) => join(DATA_DIR, `.${name}.extracted`);
  if (g.files.every((f) => existsSync(extractedFlag(f)))) {
    rmSync(markerPath, { force: true });
    return { ok: true, markerPath };
  }

  let files: ZenodoFile[] | null = null;
  for (let attempt = 1; attempt <= g.download.maxAttempts && files === null; attempt++) {
    files = await fetchRecord(g.zenodoRecord, log, attempt);
    if (files === null && attempt < g.download.maxAttempts) await sleep(1000 * 2 ** attempt);
  }
  if (files === null) {
    writeFileSync(
      markerPath,
      `${JSON.stringify({ reason: 'zenodo record unreachable', record: g.zenodoRecord, attempts: log }, null, 2)}\n`,
    );
    return { ok: false, markerPath };
  }

  for (const name of g.files) {
    const meta = files.find((f) => f.key === name);
    if (!meta) {
      log.push({
        file: name,
        url: `record ${g.zenodoRecord}`,
        attempt: 0,
        time: new Date().toISOString(),
        httpStatus: null,
        error: 'file not listed in record',
      });
      writeFileSync(
        markerPath,
        `${JSON.stringify({ reason: 'file missing from record', attempts: log }, null, 2)}\n`,
      );
      return { ok: false, markerPath };
    }
    const target = join(DATA_DIR, name);
    let ok =
      existsSync(target) &&
      statSync(target).size === meta.size &&
      (await md5(target)) === meta.checksum.split(':')[1];
    for (let attempt = 1; !ok && attempt <= g.download.maxAttempts; attempt++) {
      say(`downloading ${name} (${(meta.size / 1e6).toFixed(0)} MB), attempt ${attempt}`);
      ok = await downloadFile(meta, target, log, attempt);
      if (!ok && attempt < g.download.maxAttempts) await sleep(2000 * 2 ** attempt);
    }
    if (!ok) {
      writeFileSync(
        markerPath,
        `${JSON.stringify({ reason: `download failed after ${g.download.maxAttempts} attempts`, attempts: log }, null, 2)}\n`,
      );
      return { ok: false, markerPath };
    }
    say(`extracting ${name}`);
    await extractZip(readFileSync(target), join(DATA_DIR, name.replace(/\.zip$/, '')));
    writeFileSync(extractedFlag(name), new Date().toISOString());
  }
  rmSync(markerPath, { force: true });
  return { ok: true, markerPath };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  ensureGuitarSet({ verbose: true }).then((r) => {
    console.log(r.ok ? 'GuitarSet ready' : `GuitarSet download BLOCKED (marker: ${r.markerPath})`);
    process.exit(r.ok ? 0 : 3);
  });
}
