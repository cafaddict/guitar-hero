import { describe, expect, it } from 'vitest';
import { patternById } from '../content/patterns';
import { voicingById } from '../content/voicings';
import { STANDARD_TUNING } from '../domain/theory';
import {
  backingKeepFlags,
  backingTemplateRises,
  bleedGain,
  DEFAULT_BACKING_MASK_PARAMS,
  lowBand,
} from './backingMask';
import { detectStrums } from './onset';
import { renderBacking } from './synth/backing';
import { randomTimbre } from './synth/note';
import { renderStrum } from './synth/strum';
import { analyzeTiming } from './timing';

const FS = 48000;
const BPM = 90;
const BEAT = 60 / BPM;

function userStrum(seed: number) {
  const v = voicingById('C');
  return renderStrum({
    strings: v.frets.flatMap((f, idx) =>
      f === 'x'
        ? []
        : [
            {
              idx,
              note: {
                model: 'karplus-strong' as const,
                f0: 440 * 2 ** ((STANDARD_TUNING.openMidi[idx]! + f - 69) / 12),
                sampleRate: FS,
                durationS: 1.2,
                inharmonicityB: 5e-5,
                muted: false,
                mutedDecayDb: -30,
                mutedDecayMs: 120,
                fundamentalDb: 0,
                ...randomTimbre(seed + idx),
                seed: seed + idx,
              },
              gainDb: 0,
            },
          ],
    ),
    direction: 'down',
    spreadMs: 15,
    sampleRate: FS,
  }).signal;
}

/** One intro bar of backing alone, then the user strums every beat (P0) for two bars. */
function scene(relDb: number) {
  const backing = renderBacking({
    chords: [voicingById('C')],
    pattern: patternById('P3'),
    bpm: BPM,
    bars: 3,
    sampleRate: FS,
    model: 'karplus-strong',
    seed: 4,
  });
  const lead = Math.round(0.5 * FS);
  const signal = new Float32Array(lead + backing.signal.length);
  const userTimes = Array.from({ length: 8 }, (_, k) => 0.5 + (4 + k) * BEAT);
  userTimes.forEach((t, k) => {
    const s = userStrum(10 * k);
    const at = Math.round(t * FS);
    for (let i = 0; i < s.length && at + i < signal.length; i++) signal[at + i] = signal[at + i]! + s[i]!;
  });
  const userRms = Math.sqrt(
    userStrum(0)
      .slice(0, FS / 2)
      .reduce((a, x) => a + x * x, 0) /
      (FS / 2),
  );
  const backingRms = Math.sqrt(backing.signal.slice(0, FS / 2).reduce((a, x) => a + x * x, 0) / (FS / 2));
  const g = (userRms * 10 ** (relDb / 20)) / backingRms;
  for (let i = 0; i < backing.signal.length; i++)
    signal[lead + i] = signal[lead + i]! + backing.signal[i]! * g;
  let seed = 3;
  for (let i = 0; i < signal.length; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    signal[i] = signal[i]! + ((seed / 2 ** 32) * 2 - 1) * 2e-4;
  }
  const eventSamples = backing.events.map((e) => Math.round(e.time * FS));
  const schedule = {
    arrivals: eventSamples.map((s) => lead + s),
    templateRises: backingTemplateRises(backing.signal, eventSamples, FS),
    introCount: backing.events.filter((e) => e.time < 4 * BEAT - 1e-6).length,
  };
  return { signal, schedule, userTimes, backing, lead };
}

describe('SPEC v1.1 §10.12 backing bleed masking', () => {
  it('learns the bleed gain from the intro bar', () => {
    const { signal, schedule } = scene(-15);
    const gain = bleedGain(
      lowBand(signal, FS, DEFAULT_BACKING_MASK_PARAMS),
      FS,
      schedule,
      DEFAULT_BACKING_MASK_PARAMS,
    );
    expect(gain).toBeGreaterThan(0);
  });

  it.each([-10, -18, -25])('at %d dB: every user strum survives, isolated backing strums do not', (relDb) => {
    const { signal, schedule, userTimes, backing, lead } = scene(relDb);
    const detected = detectStrums(signal, FS, undefined, { backing: schedule }).map((e) => e.sample / FS);
    for (const t of userTimes)
      expect(
        detected.some((d) => Math.abs(d - t) <= 0.025),
        `user ${t}`,
      ).toBe(true);
    const isolated = backing.events
      .map((e) => lead / FS + e.time)
      .filter((t) => t >= userTimes[0]! - 0.01 && !userTimes.some((u) => Math.abs(u - t) <= 0.05));
    expect(isolated.length).toBeGreaterThan(0);
    for (const t of isolated)
      expect(
        detected.some((d) => Math.abs(d - t) <= 0.025),
        `backing ${t}`,
      ).toBe(false);
  });

  it('without a schedule nothing is masked', () => {
    const { signal } = scene(-15);
    expect(
      backingKeepFlags(signal, FS, [FS, 2 * FS], { arrivals: [], templateRises: [], introCount: 0 }),
    ).toEqual([true, true]);
  });
});

describe('SPEC v1.1 §14.8 swing slot assignment', () => {
  it('analyzeTiming reports the slot each strum went to (unmatched → null)', () => {
    const slots = [0, 0.4, 0.6, 1.0].map((time) => ({ time, expected: true }));
    const res = analyzeTiming(slots, [0.005, 0.61, 0.402, 2], 0, 60);
    expect(res.strumSlots).toEqual([0, 2, 1, null]);
  });
});
