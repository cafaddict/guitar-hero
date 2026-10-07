/**
 * Real-device fixture benchmark (SPEC §13.4, §14.1-4). Reads recording-kit exports placed in
 * tests/fixtures/real/<device>/ (labels.json + WAV files) and runs Modes A/B/C/D on them.
 * Without fixtures it reports "no fixtures" and exits 0. Results are reported (no thresholds): they are the
 * user's manual validation evidence (docs/MANUAL_VALIDATION.md).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { patternById } from '../../src/content/patterns';
import { voicingById } from '../../src/content/voicings';
import { midiToHz, STANDARD_TUNING } from '../../src/domain/theory';
import { verifyPluck } from '../../src/dsp/modeA';
import { verifyStrum } from '../../src/dsp/modeB';
import { ChangeCounter, classifyPair } from '../../src/dsp/modeC';
import { detectStrums } from '../../src/dsp/onset';
import { analyzeTiming } from '../../src/dsp/timing';
import { decodeWav, toMono } from '../../src/dsp/wav';

const ROOT = join(import.meta.dirname, '..', '..');
export const REAL_DIR = join(ROOT, 'tests', 'fixtures', 'real');

/** labels.json written by the recording kit (src/features/settings/recordingKit). */
export const labelsSchema = z.object({
  app: z.literal('guitar-hero'),
  kind: z.literal('recording-kit'),
  version: z.number().int(),
  device: z.string(),
  sampleRate: z.number(),
  calibration: z
    .object({ tuningCents: z.array(z.number()).length(6), rttMs: z.number().nullable() })
    .nullable(),
  clips: z.array(
    z.object({
      file: z.string(),
      label: z.string(),
      kind: z.enum(['chord-strum', 'chord-pluck', 'chord-muted', 'x-string', 'one-minute', 'strum-grid']),
      voicingId: z.string().nullable(),
      expected: z.record(z.string(), z.unknown()),
    }),
  ),
});
export type RecordingLabels = z.infer<typeof labelsSchema>;

interface Row {
  device: string;
  file: string;
  kind: string;
  result: string;
  pass: boolean | null;
}

function evaluateClip(dir: string, labels: RecordingLabels, clip: RecordingLabels['clips'][number]): Row {
  const wav = decodeWav(readFileSync(join(dir, clip.file)));
  const signal = toMono(wav);
  const fs = wav.sampleRate;
  const delta = labels.calibration?.tuningCents;
  const events = detectStrums(signal, fs);
  const base = { device: labels.device, file: clip.file, kind: clip.kind };
  const voicing = clip.voicingId ? voicingById(clip.voicingId) : null;
  const seg = (onset: number) => {
    const start = Math.max(0, onset - Math.round(0.5 * fs));
    return { samples: signal.slice(start, onset + Math.round(0.4 * fs)), onsetSample: onset - start };
  };
  switch (clip.kind) {
    case 'chord-strum':
    case 'chord-muted':
    case 'x-string': {
      if (!voicing || events.length === 0) return { ...base, result: 'no onset', pass: false };
      const s = seg(events[0]!.sample);
      const r = verifyStrum({ ...s, sampleRate: fs, voicing, tuning: STANDARD_TUNING, deltaCents: delta });
      const expectedIdx = Number(clip.expected.mutedStringIdx ?? clip.expected.ringingIdx ?? Number.NaN);
      const pass =
        clip.kind === 'chord-strum'
          ? r.verdict !== 'FAIL'
          : r.verdict === 'FAIL' && r.blamed.includes(expectedIdx);
      return { ...base, result: `${r.verdict} blamed=[${r.blamed.join(',')}]`, pass };
    }
    case 'chord-pluck': {
      if (!voicing) return { ...base, result: 'no voicing', pass: false };
      const order =
        (clip.expected.strings as number[] | undefined) ??
        voicing.frets.flatMap((f, i) => (f === 'x' ? [] : [i]));
      const statuses = order.map((idx, k) => {
        const e = events[k];
        if (!e) return 'NOT_PLAYED';
        const fret = voicing.frets[idx] as number;
        const f0 = midiToHz(STANDARD_TUNING.openMidi[idx]! + fret) * 2 ** ((delta?.[idx] ?? 0) / 1200);
        return verifyPluck({ ...seg(e.sample), sampleRate: fs, expectedF0: f0 }).status;
      });
      const mutedIdx = clip.expected.mutedStringIdx as number | undefined;
      const pass = statuses.every((st, k) => (order[k] === mutedIdx ? st === 'MUTED' : st === 'OK'));
      return { ...base, result: statuses.join(' '), pass };
    }
    case 'one-minute': {
      const [a, b] = String(clip.expected.direction ?? '').split('>');
      if (!a || !b) return { ...base, result: 'bad direction', pass: null };
      const pair = [voicingById(a === 'G' ? 'G-3f' : a), voicingById(b === 'G' ? 'G-3f' : b)] as const;
      const counter = new ChangeCounter();
      for (const e of events)
        counter.push(
          classifyPair(
            {
              samples: signal,
              sampleRate: fs,
              onsetSample: e.sample,
              tuning: STANDARD_TUNING,
              deltaCents: delta,
            },
            pair,
          ),
          (e.sample / fs) * 1000,
        );
      const user = Number(clip.expected.userCount);
      return {
        ...base,
        result: `auto ${counter.count} vs user ${user}`,
        pass: Number.isFinite(user) ? Math.abs(counter.count - user) <= 1 : null,
      };
    }
    case 'strum-grid': {
      const pattern = patternById(String(clip.expected.patternId));
      const bpm = Number(clip.expected.bpm);
      const bars = Number(clip.expected.bars ?? 8);
      const gridStart = Number(clip.expected.gridStartS);
      const rtt = Number(clip.expected.rttMs ?? labels.calibration?.rttMs ?? 0) / 1000;
      const slotS = 60 / bpm / (pattern.timeSignature === '6/8' ? 3 : 2);
      const slots = Array.from({ length: bars * pattern.slots.length }, (_, k) => ({
        time: gridStart + k * slotS,
        expected: pattern.slots[k % pattern.slots.length] !== '-',
      }));
      const r = analyzeTiming(
        slots,
        events.map((e) => e.sample / fs),
        rtt,
        bpm,
      );
      return {
        ...base,
        result: `hit ${(r.hitRate * 100).toFixed(0)}% mean ${r.meanOffsetMs?.toFixed(1)} ms sd ${r.sdOffsetMs?.toFixed(1)} ms`,
        pass: null,
      };
    }
  }
}

export function findFixtureDirs(): string[] {
  if (!existsSync(REAL_DIR)) return [];
  return readdirSync(REAL_DIR)
    .map((d) => join(REAL_DIR, d))
    .filter((d) => statSync(d).isDirectory() && existsSync(join(d, 'labels.json')));
}

function main(): void {
  const dirs = findFixtureDirs();
  if (dirs.length === 0) {
    console.log(
      `bench:real — no fixtures in ${REAL_DIR} (add recording-kit exports as tests/fixtures/real/<device>/)`,
    );
    console.log('VERIFY_DETAIL: no fixtures');
    return;
  }
  const rows: Row[] = [];
  for (const dir of dirs) {
    const labels = labelsSchema.parse(JSON.parse(readFileSync(join(dir, 'labels.json'), 'utf8')));
    for (const clip of labels.clips) rows.push(evaluateClip(dir, labels, clip));
  }
  for (const r of rows)
    console.log(
      `${r.device.padEnd(24)} ${r.kind.padEnd(12)} ${r.pass === null ? 'INFO' : r.pass ? 'PASS' : 'FAIL'}  ${r.file}  ${r.result}`,
    );
  const judged = rows.filter((r) => r.pass !== null);
  console.log(
    `\n${judged.filter((r) => r.pass).length}/${judged.length} judged clips as expected, ${rows.length - judged.length} informational`,
  );
  mkdirSync(join(ROOT, 'bench-results'), { recursive: true });
  writeFileSync(join(ROOT, 'bench-results', 'real.json'), `${JSON.stringify(rows, null, 1)}\n`);
}

if (process.argv[1]?.endsWith('real.ts')) main();
