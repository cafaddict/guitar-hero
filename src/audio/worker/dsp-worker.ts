/**
 * DSP worker (SPEC §8.3): a thin adapter that runs the pure src/dsp functions on segments sent directly by
 * the capture worklet and posts judgements to the main thread.
 */
import { STANDARD_TUNING } from '../../domain/theory';
import { verifyPluck, verifySilentString } from '../../dsp/modeA';
import { verifyStrum } from '../../dsp/modeB';
import { classifyPair, classifySet } from '../../dsp/modeC';
import { DEFAULT_ONSET_PARAMS, refineOnset } from '../../dsp/onset';
import { estimateRtt } from '../../dsp/rtt';
import { magnitudeSpectrum, partialPeak, rms } from '../../dsp/spectrum';
import { analyzeTiming } from '../../dsp/timing';
import { TunerStability, tunerFrame } from '../../dsp/tuner';
import { DETECTOR_VERSION } from '../../dsp/version';
import {
  type Job,
  type MainToWorker,
  mainToWorkerSchema,
  type RangeRequest,
  type TemplateResult,
  type WorkerToMain,
} from './protocol';

interface SegmentMessage {
  type: 'segment';
  onsetSample: number;
  segmentStart: number;
  strength: number;
  broadband: boolean;
  samples: Float32Array;
}
interface RangeMessage {
  type: 'range';
  id: number;
  fromSample: number;
  samples: Float32Array;
}
interface TunerFrameMessage {
  type: 'tunerFrame';
  endSample: number;
  samples: Float32Array;
}
type FromCapture = SegmentMessage | RangeMessage | TunerFrameMessage;

const scope = self as unknown as {
  postMessage(message: WorkerToMain, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
};

let sampleRate = 48000;
let job: Job | null = null;
let capturePort: MessagePort | null = null;
let tunerExpected: number | null = null;
let tunerOn = false;
const stability = new TunerStability();
const pendingRanges = new Map<number, RangeRequest>();
const arrivedRanges = new Map<number, RangeMessage>();

function post(message: WorkerToMain, transfer?: Transferable[]): void {
  scope.postMessage(message, transfer);
}

function returnBuffer(buffer: Float32Array): void {
  capturePort?.postMessage({ type: 'returnBuffer', buffer }, [buffer.buffer as ArrayBuffer]);
}

function judge(segment: Float32Array, onsetIndex: number): unknown {
  if (!job || job.kind === 'onsets') return null;
  const base = { samples: segment, sampleRate, onsetSample: onsetIndex };
  switch (job.kind) {
    case 'template':
      return analyzeTemplate(segment, onsetIndex, job.expectedF0);
    case 'pluck': {
      const input = {
        ...base,
        expectedF0: job.expectedF0,
        templateDecayRatio: job.templateDecayRatio,
        strictness: job.strictness,
      };
      return job.silent ? verifySilentString(input) : verifyPluck(input);
    }
    case 'strum':
      return verifyStrum({
        ...base,
        voicing: job.voicing,
        tuning: STANDARD_TUNING,
        deltaCents: job.deltaCents,
        strictness: job.strictness,
      });
    case 'pair':
      return classifyPair({ ...base, tuning: STANDARD_TUNING, deltaCents: job.deltaCents }, job.voicings);
    case 'set':
      return classifySet(
        { ...base, tuning: STANDARD_TUNING, deltaCents: job.deltaCents },
        job.voicings,
        (v) => (v.id.startsWith('G-') ? 'G' : v.id),
      );
  }
}

function onSegment(msg: SegmentMessage): void {
  const t0 = performance.now();
  const frameLength = Math.round((DEFAULT_ONSET_PARAMS.frameMs / 1000) * sampleRate);
  const coarse = msg.onsetSample - msg.segmentStart;
  const refined = refineOnset(msg.samples, coarse, frameLength, sampleRate, DEFAULT_ONSET_PARAMS);
  const result = judge(msg.samples, refined);
  post({
    type: 'onset',
    sample: msg.segmentStart + refined,
    strength: msg.strength,
    result,
    jobKind: job?.kind ?? null,
    detectorVersion: DETECTOR_VERSION,
    processingMs: Math.max(1e-3, performance.now() - t0),
  });
  returnBuffer(msg.samples);
}

function onTunerFrame(msg: TunerFrameMessage): void {
  if (tunerOn) {
    const mode = tunerExpected
      ? ({ kind: 'string', expectedF0: tunerExpected } as const)
      : ({ kind: 'chromatic' } as const);
    const reading = tunerFrame(msg.samples, 0, sampleRate, mode);
    post({ type: 'tuner', endSample: msg.endSample, reading, stableF0: stability.push(reading) });
  }
  returnBuffer(msg.samples);
}

/**
 * Noise check (SPEC §9.1-2): overall dBFS and a 1/3-octave floor summary — per band, the median over 100 ms
 * frames of the mean bin power (robust to a single cough or click).
 */
function analyzeNoise(samples: Float32Array): { noiseDbfs: number; thirdOctaveDb: number[] } {
  const noiseDbfs = 20 * Math.log10(Math.max(1e-9, rms(samples, 0, samples.length)));
  const len = Math.min(samples.length, Math.round(0.1 * sampleRate));
  const spectra: Float64Array[] = [];
  for (let s = 0; s + len <= samples.length; s += len)
    spectra.push(magnitudeSpectrum(samples, s, len, sampleRate, 1).mag.slice());
  const centers = [63, 125, 250, 500, 1000, 2000, 4000, 8000];
  const binHz = sampleRate / (2 * (spectra[0]?.length ? spectra[0].length - 1 : 1));
  const thirdOctaveDb = centers.map((fc) => {
    const lo = Math.max(1, Math.floor(fc / 2 ** (1 / 6) / binHz));
    const hi = Math.ceil((fc * 2 ** (1 / 6)) / binHz);
    const perFrame = spectra
      .map((spec) => {
        let sum = 0;
        let n = 0;
        for (let k = lo; k <= hi && k < spec.length; k++) {
          sum += spec[k]! * spec[k]!;
          n++;
        }
        return n ? sum / n : 0;
      })
      .sort((a, b) => a - b);
    const median = perFrame.length ? perFrame[perFrame.length >> 1]! : 0;
    return 10 * Math.log10(Math.max(1e-18, median));
  });
  return { noiseDbfs, thirdOctaveDb };
}

/** Open-string template from one pluck: Mode A measurement plus the harmonic profile (SPEC §9.1-4). */
function analyzeTemplate(samples: Float32Array, onsetIndex: number, expectedF0: number): TemplateResult {
  const pluck = verifyPluck({ samples, sampleRate, onsetSample: onsetIndex, expectedF0 });
  const f0 = pluck.f0 ?? expectedF0;
  const spec = magnitudeSpectrum(
    samples,
    onsetIndex + Math.round(0.03 * sampleRate),
    Math.round(0.1 * sampleRate),
    sampleRate,
    2,
  );
  const h1 = partialPeak(spec, f0, 30).mag || 1e-12;
  const harmonics = [1, 2, 3, 4, 5, 6, 7, 8].map((h) => partialPeak(spec, h * f0, 30).mag / h1);
  return { pluck, harmonics };
}

function onRange(msg: RangeMessage): void {
  arrivedRanges.set(msg.id, msg);
  processRange(msg.id);
}

function processRange(id: number): void {
  const request = pendingRanges.get(id);
  const range = arrivedRanges.get(id);
  if (!request || !range) return;
  pendingRanges.delete(id);
  arrivedRanges.delete(id);
  const t0 = performance.now();
  let result: unknown = null;
  let transfer: Transferable[] | undefined;
  let samples: Float32Array | undefined;
  switch (request.kind) {
    case 'rtt': {
      // Recording time 0 = fromSample; scheduled times as capture samples relative to the same origin.
      const scheduledS = request.scheduledSamples.map((s) => (s - range.fromSample) / sampleRate);
      result = estimateRtt(range.samples, sampleRate, 0, scheduledS);
      break;
    }
    case 'noise':
      result = analyzeNoise(range.samples);
      break;
    case 'raw':
      samples = range.samples;
      transfer = [range.samples.buffer as ArrayBuffer];
      result = { fromSample: range.fromSample, length: range.samples.length };
      break;
  }
  post(
    {
      type: 'rangeResult',
      id,
      result,
      ...(samples ? { samples } : {}),
      detectorVersion: DETECTOR_VERSION,
      processingMs: Math.max(1e-3, performance.now() - t0),
    },
    transfer,
  );
}

function onCaptureMessage(event: MessageEvent<FromCapture>): void {
  const msg = event.data;
  if (msg.type === 'segment') onSegment(msg);
  else if (msg.type === 'tunerFrame') onTunerFrame(msg);
  else if (msg.type === 'range') onRange(msg);
}

scope.onmessage = (event: MessageEvent<unknown>) => {
  const data = event.data as { type?: string; port?: MessagePort };
  if (data?.type === 'connectCapture' && data.port) {
    capturePort = data.port;
    capturePort.onmessage = onCaptureMessage;
    return;
  }
  const parsed = mainToWorkerSchema.safeParse(event.data);
  if (!parsed.success) {
    post({ type: 'error', message: `bad message: ${parsed.error.message}` });
    return;
  }
  const msg: MainToWorker = parsed.data;
  switch (msg.type) {
    case 'config':
      sampleRate = msg.sampleRate;
      break;
    case 'job':
      job = msg.job;
      break;
    case 'tuner':
      tunerOn = msg.enabled;
      tunerExpected = msg.expectedF0;
      stability.reset();
      break;
    case 'analyzeRange':
      pendingRanges.set(msg.id, msg.request);
      processRange(msg.id);
      break;
    case 'analyzeTiming': {
      const t0 = performance.now();
      const result = analyzeTiming(msg.slots, msg.strumTimes, msg.rttS, msg.bpm, msg.personalOffsetMs);
      post({
        type: 'timingResult',
        id: msg.id,
        result,
        detectorVersion: DETECTOR_VERSION,
        processingMs: Math.max(1e-3, performance.now() - t0),
      });
      break;
    }
  }
};
