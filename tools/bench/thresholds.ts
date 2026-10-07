/**
 * Loads the frozen quality contract docs/goal/thresholds.json (SPEC §14). The benchmark judges with the
 * object returned here — never with literals (tests/integrity checks deep equality).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const THRESHOLDS_PATH = join(import.meta.dirname, '..', '..', 'docs', 'goal', 'thresholds.json');

export interface Thresholds {
  version: number;
  splitSeeds: { dev: [number, number]; test: [number, number] };
  minimumTestSizes: {
    modeA: number;
    modeB: number;
    modeCSequences: number;
    modeDEvents: number;
    tuner: number;
    rtt: number;
    modeCSetStrums: number;
  };
  matrix: {
    sampleRates: number[];
    synthModels: ('karplus-strong' | 'additive')[];
    additiveInharmonicityB: [number, number];
    snrDb: number[];
    micHighpassHz: number[];
    reverb: ('none' | 'small-room')[];
    stringGainJitterDb: number;
    detuneCentsMax: number;
    calibrationResidualCentsMax: number;
    strumSpreadMs: [number, number];
    voicings: string[];
    modeAConditions: string[];
    modeAMutedDecayDbIn120ms: number;
    modeAWeakFundamentalDb: number;
    modeBConditions: string[];
    modeC: {
      sequenceSeconds: number;
      changesPerMin: [number, number];
      extraSameChordStrumProb: number;
      mutedStringArrivalProb: number;
      openStringsBetweenProb: number;
    };
    modeD: {
      bpm: [number, number];
      humanJitterSdMs: number;
      humanMeanOffsetMs: [number, number];
      rttMs: [number, number];
      clickBleedRelDb: number;
      sustainSeconds: number;
      clickBleedSequenceFraction: number;
      rttGivenToDetectorJitterMs: number;
    };
    tuner: { noteRange: [string, string]; detuneCentsMax: number; snrDbMin: number };
    rtt: { latencyMs: [number, number]; snrDbMin: number; reverb: ('none' | 'small-room')[] };
    rangeEndpointCoverageFraction: number;
    smallRoomReverb: { rt60S: number; drrDb: number };
    snrDefinition: string;
    synthF0ErrorCentsMax: number;
  };
  synthetic: {
    modeA: Record<string, number>;
    modeB: Record<string, number>;
    modeC: Record<string, number>;
    modeCSet: Record<string, number>;
    modeD: Record<string, number>;
    tuner: Record<string, number>;
    rtt: Record<string, number>;
    perf: Record<string, number>;
    coverage: { modeBVerifiableRatioMustBeAtLeastDefaultRule: boolean };
  };
  guitarset: {
    zenodoRecord: number;
    files: string[];
    license: string;
    split: { devPlayers: string[]; testPlayers: string[] };
    eventFilters: Record<string, number | string[]>;
    hard: Record<string, number>;
    soft: Record<string, number>;
    download: { maxAttempts: number; blockedMarker: string };
    clipNaming: { comp: string; solo: string; genres: string[] };
  };
}

export function loadThresholds(): Thresholds {
  return JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8')) as Thresholds;
}
