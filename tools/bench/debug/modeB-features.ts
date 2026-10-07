/** Dev-only: per-string feature distributions for muted vs sounding verifiable strings. */
import { voicingById } from '../../../src/content/voicings';
import { STANDARD_TUNING } from '../../../src/domain/theory';
import { expectedNotes, partialCollisionMap } from '../../../src/domain/voicing';
import { leakageAt } from '../../../src/dsp/leakage';
import { detectStrums } from '../../../src/dsp/onset';
import { magnitudeSpectrum, medianSpectrum, msToSamples, partialPeak } from '../../../src/dsp/spectrum';
import { buildCases } from '../cases';
import { renderModeB } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const cases = buildCases(t, 'dev')
  .modeB.filter((c) => c.condition === 'verifiable-muted' || c.condition === 'clean')
  .slice(0, Number(process.argv[2] ?? 300));
const B = 5e-5;
const ph = (f0: number, h: number) => h * f0 * Math.sqrt(1 + B * h * h);
const rows: {
  muted: boolean;
  snr: number;
  decay: number;
  relLate: number;
  relEarly: number;
  eE: number;
  eL: number;
  xDecay: number;
}[] = [];
for (const c of cases) {
  const r = renderModeB(c, t);
  const fs = c.sampleRate;
  const onset = detectStrums(r.signal, fs)[0]?.sample ?? r.onsetSample;
  const v = voicingById(c.voicingId);
  const notes = expectedNotes(v, STANDARD_TUNING, 0, c.deltaGivenCents);
  const map = partialCollisionMap(v, STANDARD_TUNING, undefined, c.deltaGivenCents);
  const win = (startMs: number) =>
    magnitudeSpectrum(r.signal, onset + msToSamples(startMs, fs), msToSamples(100, fs), fs, 2);
  const early = win(30);
  const late = win(130);
  const len = msToSamples(100, fs);
  const noiseSpec = medianSpectrum(
    Array.from({ length: 8 }, (_, k) =>
      magnitudeSpectrum(
        r.signal,
        onset - msToSamples(500, fs) + k * Math.round(len / 4),
        len,
        fs,
        2,
      ).mag.slice(),
    ),
  );
  const known = (s2: typeof early) =>
    notes
      .flatMap((n) => Array.from({ length: 16 }, (_, k) => ph(n.f0, k + 1)).filter((f) => f < 6000))
      .map((hz) => ({ hz, mag: partialPeak(s2, hz, 30).mag }));
  const kE = known(early);
  const kL = known(late);
  const binHz = fs / len;
  const ev = (s2: typeof early, kn: typeof kE, f: number) => {
    const pk = partialPeak(s2, f, 30);
    return (
      20 * Math.log10((pk.mag + 1e-12) / ((noiseSpec[pk.bin] ?? 0) + 2 * leakageAt(f, kn, binHz) + 1e-12))
    );
  };
  const excess = (s2: typeof early, kn: typeof kE, f: number) => {
    const pk = partialPeak(s2, f, 30);
    return Math.max(1e-9, pk.mag - (noiseSpec[pk.bin] ?? 0) - 2 * leakageAt(f, kn, binHz));
  };
  const all = notes.flatMap((n) => [1, 2, 3, 4].map((h) => ph(n.f0, h)));
  const db = (s: typeof early, f: number) => 20 * Math.log10(partialPeak(s, f, 30).mag + 1e-12);
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1]!;
  const refE = median(all.map((f) => db(early, f)));
  const refL = median(all.map((f) => db(late, f)));
  for (const n of notes) {
    const m = map.find((x) => x.idx === n.idx);
    if (!m?.verifiable) continue;
    const hs = m.independentPartials.filter((h) => h <= 6);
    if (!hs.length) continue;
    const e = hs.map((h) => db(early, ph(n.f0, h))).reduce((a, b) => a + b, 0) / hs.length;
    const l = hs.map((h) => db(late, ph(n.f0, h))).reduce((a, b) => a + b, 0) / hs.length;
    const eE = hs.map((h) => ev(early, kE, ph(n.f0, h))).reduce((a, b) => a + b, 0) / hs.length;
    const eL = hs.map((h) => ev(late, kL, ph(n.f0, h))).reduce((a, b) => a + b, 0) / hs.length;
    const xDecay =
      hs
        .map((h) => 20 * Math.log10(excess(late, kL, ph(n.f0, h)) / excess(early, kE, ph(n.f0, h))))
        .reduce((a, b) => a + b, 0) / hs.length;
    rows.push({
      muted: c.condition === 'verifiable-muted' && c.targetIdx === n.idx,
      snr: c.snrDb,
      decay: l - e,
      relLate: l - refL,
      relEarly: e - refE,
      eE,
      eL,
      xDecay,
    });
  }
}
const q = (xs: number[], p: number) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
for (const muted of [true, false]) {
  const s = rows.filter((r) => r.muted === muted);
  for (const key of ['decay', 'relLate', 'relEarly', 'eE', 'eL', 'xDecay'] as const) {
    const xs = s.map((r) => r[key]);
    console.log(
      `${muted ? 'MUTED ' : 'sound '} ${key.padEnd(8)} n=${xs.length} p02=${q(xs, 0.02).toFixed(1)} p10=${q(xs, 0.1).toFixed(1)} p50=${q(xs, 0.5).toFixed(1)} p90=${q(xs, 0.9).toFixed(1)} p98=${q(xs, 0.98).toFixed(1)}`,
    );
  }
}

const rules: Record<string, (r: (typeof rows)[number]) => boolean> = {
  'decay<=-8': (r) => r.decay <= -8,
  'decay<=-8|(decay<=-5&relLate<=-16)': (r) => r.decay <= -8 || (r.decay <= -5 && r.relLate <= -16),
  'decay<=-7&relLate<=-10': (r) => r.decay <= -7 && r.relLate <= -10,
  'decay<=-6&relLate<=-14': (r) => r.decay <= -6 && r.relLate <= -14,
  'decay<=-6&relLate<=-16': (r) => r.decay <= -6 && r.relLate <= -16,
  '(decay<=-6&relLate<=-16)|(decay<=-10)': (r) => (r.decay <= -6 && r.relLate <= -16) || r.decay <= -10,
};
for (const [name, rule] of Object.entries(rules)) {
  const m = rows.filter((r) => r.muted && r.snr >= 25);
  const snd = rows.filter((r) => !r.muted);
  const snd15 = rows.filter((r) => !r.muted && r.snr < 25);
  console.log(
    `${name.padEnd(40)} detect(snr>=25)=${(m.filter(rule).length / m.length).toFixed(3)} falseMuted(all)=${(snd.filter(rule).length / snd.length).toFixed(4)} false@15=${(snd15.filter(rule).length / snd15.length).toFixed(4)}`,
  );
}
const okRule = (r: (typeof rows)[number]) => r.eE >= 12 && r.decay >= -5;
const snd25 = rows.filter((r) => !r.muted && r.snr >= 25);
console.log(
  'sounding OK-rule rate (snr>=25)',
  (snd25.filter(okRule).length / snd25.length).toFixed(4),
  'muted judged OK',
  (rows.filter((r) => r.muted).filter(okRule).length / rows.filter((r) => r.muted).length).toFixed(4),
);
const okRule2 = (r: (typeof rows)[number]) => r.eE >= 10 && r.decay >= -6;
console.log(
  'sounding OK-rule2 rate (snr>=25)',
  (snd25.filter(okRule2).length / snd25.length).toFixed(4),
  'muted judged OK',
  (rows.filter((r) => r.muted).filter(okRule2).length / rows.filter((r) => r.muted).length).toFixed(4),
);
