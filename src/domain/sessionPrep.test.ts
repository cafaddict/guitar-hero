import { describe, expect, it } from 'vitest';
import { DAY_MS, dayKey, initialProgression, type MetricSample, type Prescription } from './records';
import { prepareSession, prescriptionExpired } from './sessionPrep';
import { buildSkills } from './skills';

const NOW = new Date(2026, 9, 8, 19).getTime();
let n = 0;
const s = (subjectKey: string, metric: string, value: number, at: number): MetricSample => ({
  subjectKey,
  metric,
  value,
  at,
  day: dayKey(at),
  attemptId: `a${++n}`,
});

describe('AC-PG2 session start (SPEC v1.1 §7.4): stagnation → prescriptions, expiry, G switch', () => {
  const stuckPair = [12, 9, 6, 3, 1].map((d, i) =>
    s('pair:A|D', 'cpmQualified', 24 + (i % 2), NOW - d * DAY_MS),
  );
  const stuckLadder = [10, 7, 4, 1].map((d) => s('strum:P3:mute', 'ladderBpm', 60, NOW - d * DAY_MS));

  it('detectStagnation runs at every session start and adds one prescription per subject', () => {
    const samples = [...stuckPair, ...stuckLadder];
    const prep = prepareSession({
      progression: { ...initialProgression(NOW - 30 * DAY_MS), stage: 4 },
      skills: buildSkills(samples),
      recentSamples: samples,
      sessionNumber: 20,
      now: NOW,
    });
    expect(prep.added.map((p) => [p.kind, p.subjectKey])).toEqual([
      ['omcToPfc', 'pair:A|D'],
      ['slowerTempo', 'strum:P3:mute'],
    ]);
    const tempo = prep.added.find((p) => p.kind === 'slowerTempo')!;
    expect(tempo.expiresAt).toBe(NOW + 7 * DAY_MS);
    expect(prep.progression.prescriptions).toHaveLength(2);
    // Next session: the same stagnation does not add a second prescription for the same subject.
    const again = prepareSession({
      progression: prep.progression,
      skills: buildSkills(samples),
      recentSamples: samples,
      sessionNumber: 21,
      now: NOW + DAY_MS,
    });
    expect(again.added).toEqual([]);
  });

  it('prescriptions expire after their sessions, their date, or once the goal is reached', () => {
    const base: Prescription = {
      kind: 'omcToPfc',
      subjectKey: 'pair:A|D',
      startedSession: 10,
      startedAt: NOW,
      expiresAfterSessions: 8,
      reason: 'conditionalPromotion',
    };
    const none = buildSkills([]);
    expect(prescriptionExpired(base, none, 17, NOW)).toBe(false);
    expect(prescriptionExpired(base, none, 18, NOW)).toBe(true);
    expect(
      prescriptionExpired({ ...base, kind: 'slowerTempo', expiresAt: NOW + DAY_MS }, none, 11, NOW + DAY_MS),
    ).toBe(true);
    const passed = buildSkills([
      s('pair:A|D', 'cpmQualified', 31, NOW - DAY_MS),
      s('pair:A|D', 'cpmQualified', 30, NOW),
    ]);
    expect(prescriptionExpired(base, passed, 11, NOW)).toBe(true);
    const acquired = buildSkills(Array.from({ length: 5 }, (_, i) => s('chord:C', 'clean', 1, NOW - i)));
    expect(
      prescriptionExpired({ ...base, kind: 'pluckMode', subjectKey: 'chord:C' }, acquired, 11, NOW),
    ).toBe(true);
    const prep = prepareSession({
      progression: { ...initialProgression(NOW), prescriptions: [base] },
      skills: none,
      recentSamples: [],
      sessionNumber: 18,
      now: NOW,
    });
    expect(prep.expired).toEqual([base]);
    expect(prep.progression.prescriptions).toEqual([]);
  });

  it('AC-PG3: suggests the three-finger G at Stage 6 and the four-finger G at Stage 8 once acquired', () => {
    const acquired = (id: string) =>
      buildSkills(Array.from({ length: 6 }, (_, i) => s(`chord:${id}`, 'clean', 1, NOW - i)));
    const prep = (
      stage: number,
      gVoicing: 'G-2f' | 'G-3f' | 'G-4f',
      skills: ReturnType<typeof buildSkills>,
    ) =>
      prepareSession({
        progression: { ...initialProgression(NOW), stage, gVoicing },
        skills,
        recentSamples: [],
        sessionNumber: 1,
        now: NOW,
      }).gSuggestion;
    expect(prep(6, 'G-2f', acquired('G-2f'))).toBe('G-3f');
    expect(prep(5, 'G-2f', acquired('G-2f'))).toBeNull();
    expect(prep(6, 'G-3f', acquired('G-3f'))).toBeNull();
    expect(prep(8, 'G-3f', acquired('G-3f'))).toBe('G-4f');
    expect(prep(8, 'G-4f', acquired('G-4f'))).toBeNull();
  });
});
