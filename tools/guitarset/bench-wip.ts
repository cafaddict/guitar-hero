/**
 * GuitarSet real-recording benchmark (SPEC §14.4). Downloads the data when missing (exit 3 = BLOCKED with the
 * download script's marker), evaluates every clip, and judges the TEST players (04, 05) against the hard and
 * soft thresholds. Dev players (00–03) are reported for tuning only.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { loadThresholds } from '../bench/thresholds';
import { DATA_DIR, ensureGuitarSet, ROOT } from './download';
import { audioPathFor, type ClipOutcome, type ClipTask, deriveClipSeed } from './evaluate';
import { clipInfo, type EventFilters } from './jams';
import { writeGuitarSetSection } from './report';

export const BLOCKED_EXIT_CODE = 3;

export interface GuitarSetMetric {
  kind: 'hard' | 'soft';
  key: string;
  value: number;
  threshold: number;
  pass: boolean;
  n: number;
}

export function computeMetrics(
  outcomes: readonly ClipOutcome[],
  t: ReturnType<typeof loadThresholds>,
): GuitarSetMetric[] {
  const singles = outcomes.flatMap((o) => o.singles);
  const pairs = outcomes.flatMap((o) => o.pairs);
  const strums = outcomes.flatMap((o) => o.strums);
  const perturbed = strums.filter((s) => s.perturbedStringOk !== null);
  const f1 = outcomes.flatMap((o) => (o.f1 ? [o.f1] : []));
  const tp = f1.reduce((s, x) => s + x.tp, 0);
  const det = f1.reduce((s, x) => s + x.detected, 0);
  const tru = f1.reduce((s, x) => s + x.truth, 0);
  const p = det ? tp / det : 0;
  const r = tru ? tp / tru : 0;
  const ratio = (a: number, b: number) => (b ? a / b : Number.NaN);
  const values: Record<string, { value: number; n: number }> = {
    modeAOkRateMin: { value: ratio(singles.filter((s) => s.ok).length, singles.length), n: singles.length },
    modeAPerturbedFalseAcceptMax: {
      value: ratio(singles.filter((s) => s.perturbedOk).length, singles.length),
      n: singles.length,
    },
    modeCPairAccuracyMin: {
      value: ratio(pairs.filter((x) => x.correct).length, pairs.length),
      n: pairs.length,
    },
    strumOnsetF1At50msMin: { value: p + r > 0 ? (2 * p * r) / (p + r) : 0, n: tru },
    modeBFalseRejectMax: {
      value: ratio(strums.filter((s) => s.verdict === 'FAIL').length, strums.length),
      n: strums.length,
    },
    modeBPerturbedFalseAcceptMax: {
      value: ratio(perturbed.filter((s) => s.perturbedStringOk).length, perturbed.length),
      n: perturbed.length,
    },
  };
  const judge = (key: string, value: number, threshold: number) =>
    !Number.isNaN(value) && (key.endsWith('Max') ? value <= threshold : value >= threshold);
  const out: GuitarSetMetric[] = [];
  for (const [kind, table] of [
    ['hard', t.guitarset.hard],
    ['soft', t.guitarset.soft],
  ] as const) {
    for (const [key, threshold] of Object.entries(table)) {
      const v = values[key];
      if (!v) throw new Error(`no GuitarSet metric for ${key}`);
      out.push({ kind, key, value: v.value, threshold, pass: judge(key, v.value, threshold), n: v.n });
    }
  }
  return out;
}

function listTasks(t: ReturnType<typeof loadThresholds>): ClipTask[] {
  const annotationDir = join(DATA_DIR, 'annotation');
  const files = readdirSync(annotationDir)
    .filter((f) => f.endsWith('.jams'))
    .sort();
  const filters = t.guitarset.eventFilters as unknown as EventFilters;
  const exclude = (t.guitarset.eventFilters.onsetF1ExcludeGenres as string[]) ?? [];
  const tasks: ClipTask[] = [];
  for (const file of files) {
    const id = file.replace(/\.jams$/, '');
    const info = clipInfo(id, t.guitarset.clipNaming);
    if (!info) continue;
    const wavPath = audioPathFor(DATA_DIR, id);
    if (!existsSync(wavPath)) continue;
    tasks.push({
      info,
      jamsPath: join(annotationDir, file),
      wavPath,
      filters,
      excludeGenresFromF1: exclude,
      seed: deriveClipSeed(id),
    });
  }
  return tasks;
}

async function runTasks(tasks: readonly ClipTask[]): Promise<ClipOutcome[]> {
  const threads = Math.max(1, Math.min(availableParallelism() - 1, 11));
  const results: ClipOutcome[] = new Array(tasks.length);
  let next = 0;
  let done = 0;
  const url = new URL('./worker-boot.mjs', import.meta.url);
  await Promise.all(
    Array.from(
      { length: Math.min(threads, tasks.length) },
      () =>
        new Promise<void>((resolvePromise, reject) => {
          const worker = new Worker(url);
          const feed = () => {
            if (next >= tasks.length) {
              void worker.terminate().then(() => resolvePromise());
              return;
            }
            const taskId = next++;
            worker.postMessage({ task: tasks[taskId], taskId });
          };
          worker.on('message', (msg: { taskId: number; outcome?: ClipOutcome; error?: string }) => {
            if (msg.error) {
              reject(new Error(msg.error));
              return;
            }
            results[msg.taskId] = msg.outcome!;
            done++;
            if (done % 40 === 0 || done === tasks.length)
              process.stderr.write(`  guitarset ${done}/${tasks.length} clips\n`);
            feed();
          });
          worker.on('error', reject);
          feed();
        }),
    ),
  );
  return results;
}

function table(metrics: readonly GuitarSetMetric[]): string {
  const fmt = (v: number) => (Number.isFinite(v) ? v.toFixed(4) : String(v));
  const rows = metrics.map((m) => [
    m.kind,
    m.key,
    fmt(m.value),
    fmt(m.threshold),
    m.pass ? 'PASS' : 'FAIL',
    String(m.n),
  ]);
  const header = ['kind', 'metric', 'value', 'threshold', 'verdict', 'n'];
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  return [header, ...rows].map((r) => r.map((c, i) => c.padEnd(widths[i]!)).join('  ')).join('\n');
}

async function main(): Promise<void> {
  const t = loadThresholds();
  const ready = await ensureGuitarSet({ verbose: true });
  if (!ready.ok) {
    console.log(`GuitarSet unavailable — download blocked. Marker ${ready.markerPath}:`);
    console.log(readFileSync(ready.markerPath, 'utf8'));
    console.log('VERIFY_DETAIL: BLOCKED (download marker present)');
    process.exit(BLOCKED_EXIT_CODE);
  }
  const started = performance.now();
  const tasks = listTasks(t);
  const outcomes = await runTasks(tasks);
  const split = (players: string[]) => outcomes.filter((o) => players.includes(o.player));
  const dev = computeMetrics(split(t.guitarset.split.devPlayers), t);
  const test = computeMetrics(split(t.guitarset.split.testPlayers), t);
  const elapsedS = (performance.now() - started) / 1000;
  console.log(
    `\nGuitarSet benchmark — detector ${DETECTOR_VERSION}, ${outcomes.length} clips, ${elapsedS.toFixed(0)} s`,
  );
  console.log('\n[dev players 00–03 — tuning only]');
  console.log(table(dev));
  console.log('\n[TEST players 04–05 — judged]');
  console.log(table(test));
  mkdirSync(join(ROOT, 'bench-results'), { recursive: true });
  const payload = {
    detectorVersion: DETECTOR_VERSION,
    createdAt: new Date().toISOString(),
    elapsedS,
    clips: outcomes.length,
    dev,
    test,
  };
  writeFileSync(
    join(ROOT, 'bench-results', 'guitarset.json'),
    `${JSON.stringify({ ...payload, outcomes }, null, 1)}\n`,
  );
  writeGuitarSetSection(payload, outcomes);
  const hard = test.filter((m) => m.kind === 'hard');
  const soft = test.filter((m) => m.kind === 'soft');
  console.log(
    `VERIFY_DETAIL: hard ${hard.filter((m) => m.pass).length}/${hard.length}, soft ${soft.filter((m) => m.pass).length}/${soft.length}`,
  );
  process.exit(hard.every((m) => m.pass) ? 0 : 1);
}

if (process.argv[1]?.endsWith('bench.ts') || process.argv[1]?.endsWith('bench-wip.ts')) void main();
