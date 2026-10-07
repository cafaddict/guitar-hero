/** Dev-only: where do false onsets occur in synthetic 3 s sustained chords? */
import { computeFlux, DEFAULT_ONSET_PARAMS, detectStrums, type OnsetParams } from '../../../src/dsp/onset';
import { buildCases } from '../cases';
import { renderModeD } from '../render';
import { loadThresholds } from '../thresholds';

const t = loadThresholds();
const params: OnsetParams = {
  ...DEFAULT_ONSET_PARAMS,
  ...(JSON.parse(process.argv[2] ?? '{}') as Partial<OnsetParams>),
};
const offsets: number[] = [];
const info: string[] = [];
for (const c of buildCases(t, 'dev').modeD.filter((x) => x.kind === 'sustain')) {
  const r = renderModeD(c, t);
  const fs = c.sampleRate;
  const frames = computeFlux(r.signal, fs, params);
  const L = Math.round((params.frameMs / 1000) * fs);
  for (const e of detectStrums(r.signal, fs, params)) {
    const d = ((e.sample - r.truthSamples[0]!) / fs) * 1000;
    if (Math.abs(d) > 60) {
      offsets.push(d);
      const n = frames.findIndex((fr) => fr.start + L / 2 >= e.coarseSample);
      if (n < 0) continue;
      const fr = frames[n]!;
      const lows = frames
        .slice(Math.max(0, n - 188), n)
        .map((x) => x.lowFlux)
        .sort((a, b) => a - b);
      let before = Infinity;
      for (let j = n - params.lagFrames - params.broadbandLookbackFrames; j <= n - params.lagFrames - 1; j++)
        before = Math.min(before, frames[Math.max(0, j)]!.highEnergy);
      let peak = 0;
      for (let j = n; j <= n + params.broadbandLookaheadFrames; j++)
        peak = Math.max(peak, frames[Math.min(frames.length - 1, j)]!.highEnergy);
      if (info.length < 20)
        info.push(
          `${c.id} ${c.model} snr${c.snrDb} at ${d.toFixed(0)}ms flux=${fr.flux.toFixed(1)} low=${fr.lowFlux.toFixed(2)} lowMed=${(lows[lows.length >> 1] ?? 0).toFixed(2)} thrIdx=${n} hi=${fr.highFlux.toFixed(2)} rise=${(10 * Math.log10(peak / before)).toFixed(1)}`,
        );
    }
  }
}
console.log(info.join('\n'));
const hist = new Map<string, number>();
for (const o of offsets) {
  const k = o < 0 ? '<0' : o < 150 ? '60-150' : o < 400 ? '150-400' : o < 1000 ? '400-1000' : '>1000';
  hist.set(k, (hist.get(k) ?? 0) + 1);
}
console.log([...hist.entries()]);
