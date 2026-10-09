/**
 * Loads the frozen quality contract (SPEC §14). Since M11 this is docs/goal/v1.1/thresholds.json (SPEC v1.1
 * §14.0), a superset of the v1 file (integrity 11). The benchmark judges with the object returned here —
 * never with literals (tests/integrity checks deep equality).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const THRESHOLDS_PATH = join(
  import.meta.dirname,
  '..',
  '..',
  'docs',
  'goal',
  'v1.1',
  'thresholds.json',
);

export interface SequenceMatrix {
  shapes: string[];
  scaleSteps: number[];
  bpm: [number, number];
  noteValues: ('quarter' | 'eighth')[];
  conditions: string[];
  humanJitterSdMs: number;
  rttMs: [number, number];
  onsetMatchMs: number;
  pitchToleranceCents: number;
  flawlessGateMaxCycleNotes: number;
  defectsPerCycle: number;
  extraOffsetJitterMs: number;
  chromaticCycleNotes: number;
}

export interface Thresholds {
  version: string;
  splitSeeds: { dev: [number, number]; test: [number, number] };
  minimumTestSizes: {
    modeA: number;
    modeB: number;
    modeCSequences: number;
    modeDEvents: number;
    tuner: number;
    rtt: number;
    modeCSetStrums: number;
    sequenceCycles: number;
    swingEvents: number;
    backingBleedEvents: number;
    betaPerDetector: number;
    modeCSetStage8to11Strums: number;
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
    modeCPairSet: string;
    gVoicings: string[];
    sequence: SequenceMatrix;
    swing: {
      patterns: string[];
      swingRatio: [number, number];
      bpm: [number, number];
      detectorGetsRatio: boolean;
    };
    backingBleed: {
      relDb: [number, number];
      maskWindowMs: number;
      userStrumKeepLowBandDb: number;
      userPattern: string;
      backingPattern: string;
      overlapExcludeMs: number;
      attributionWindowMs: number;
    };
    betaConditions: {
      buzzStrength: [number, number];
      directions: ('down' | 'up')[];
      palmMuteDecayS: [number, number];
      dynamicsDeltaDb: [number, number];
    };
    modeCSetStage8to11: { sets: string[][]; rootsDistinctWithinSet: boolean };
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
    sequence: Record<string, number>;
    swing: Record<string, number>;
    backingBleed: Record<string, number>;
    modeCSetStage8to11: Record<string, number>;
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
  /** Report-only targets (SPEC v1.1 §10.11, §14.8): never decide the exit code. */
  beta: { reportOnly: true; $comment?: string; targets: Record<string, number> };
}

export function loadThresholds(): Thresholds {
  return JSON.parse(readFileSync(THRESHOLDS_PATH, 'utf8')) as Thresholds;
}
