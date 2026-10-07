import { describe, expect, it } from 'vitest';
import { voicingById } from '../../content/voicings';
import { chordCheckResultSchema } from '../../domain/exerciseResults';
import type { PluckResult } from '../../dsp/modeA';
import type { StrumResult } from '../../dsp/modeB';
import { DETECTOR_VERSION } from '../../dsp/version';
import { testContext } from '../testing/fakes';
import { ChordCheckRunner, type E1Params } from './runner';

const C = voicingById('C'); // x32010: idx 0 (6th string) muted

function pluck(partial: Partial<PluckResult>): PluckResult {
  return {
    detectorVersion: DETECTOR_VERSION,
    confidence: 0.95,
    reasons: [],
    processingMs: 2,
    status: 'OK',
    verdict: 'PASS',
    f0: 130,
    cents: 1,
    semitones: 0,
    clarity: 0.95,
    decayRatio: 0.5,
    levelDb: 30,
    ...partial,
  };
}

function setup(params: Partial<E1Params> = {}, options: { mic?: boolean; xStringCheck?: boolean } = {}) {
  const t = testContext({ mic: options.mic ?? true });
  if (options.xStringCheck) t.ctx.settings = { ...t.ctx.settings, xStringCheck: true };
  const runner = new ChordCheckRunner(
    t.ctx,
    { voicingId: 'C', blockMs: 120_000, mode: 'pluck', earFirst: false, ...params },
    C,
  );
  runner.start();
  /** Plucks the active string: coarse + judged onset now, judgement arrives 0.5 s later. */
  const strike = (result: unknown) => {
    const at = t.clock.t + 0.2;
    t.clock.advance(0.7);
    t.mic.strike(at, result);
  };
  return { ...t, runner, strike, view: () => runner.snapshot().view };
}

describe('E1 chord check — string by string (Mode A)', () => {
  it('judges played strings low → high, skips the x string, records a clean attempt', () => {
    const { runner, mic, strike, view } = setup();
    expect(view().step).toBe('place');
    runner.command('next');
    expect(view().step).toBe('strings');
    expect(view().activeIdx).toBe(1); // 5th string; 6th (x) skipped
    expect(mic.job).toMatchObject({ kind: 'pluck', silent: false });
    expect((mic.job as { expectedF0: number }).expectedF0).toBeCloseTo(130.81, 1); // C3 on the 5th string
    for (const idx of [1, 2, 3, 4, 5]) {
      expect(view().activeIdx).toBe(idx);
      strike(pluck({}));
    }
    expect(view().step).toBe('release');
    expect(view().lastClean).toBe(true);
    expect(mic.job).toBeNull();
    const result = runner.finish();
    expect(chordCheckResultSchema.parse(result)).toEqual(result);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]!.perString.map((s) => s.status)).toEqual([
      'NOT_PLAYED',
      'OK',
      'OK',
      'OK',
      'OK',
      'OK',
    ]);
    expect(result.cleanRatio).toBe(1);
    expect(runner.dspStats()).toMatchObject({ detectorVersion: DETECTOR_VERSION, events: 5 });
    expect(runner.dspStats().meanProcessingMs).toBeGreaterThan(0);
  });

  it('a muted 2nd string fails the attempt with a coaching hint; the next attempt starts fresh', () => {
    const { runner, strike, view } = setup();
    runner.command('next');
    for (let k = 0; k < 3; k++) strike(pluck({}));
    expect(view().activeIdx).toBe(4);
    strike(pluck({ status: 'MUTED', verdict: 'FAIL', semitones: null }));
    strike(pluck({}));
    expect(view().lastClean).toBe(false);
    expect(view().strings[4]!.status).toBe('MUTED');
    expect(view().hints).toContainEqual({ code: 'mutedFretted', stringNo: 2, finger: 1 });
    runner.command('next');
    expect(view().step).toBe('place');
    expect(view().strings.every((s) => s.status === null)).toBe(true);
    expect(runner.finish().cleanRatio).toBe(0);
  });

  it('RETRY verdicts and multiple onsets keep the same string armed', () => {
    const { runner, mic, strike, view, clock } = setup();
    runner.command('next');
    strike(pluck({ status: 'WEAK', verdict: 'RETRY', reasons: ['LOW_LEVEL'] }));
    expect(view().activeIdx).toBe(1);
    expect(view().retry).toBe('LOW_LEVEL');
    // Two plucks 200 ms apart → ambiguous take.
    const at = clock.t + 0.1;
    mic.coarse.emit(at + 0.04);
    mic.coarse.emit(at + 0.25);
    clock.advance(0.8);
    mic.judged.emit({
      time: at,
      result: pluck({}),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 2,
    });
    expect(view().retry).toBe('MULTIPLE_ONSETS');
    expect(view().activeIdx).toBe(1);
    strike(pluck({}));
    expect(view().activeIdx).toBe(2);
    expect(view().retry).toBeNull();
  });

  it('ignores onsets from before the string was armed', () => {
    const { runner, mic, view, clock } = setup();
    runner.command('next');
    mic.judged.emit({
      time: clock.t - 1,
      result: pluck({}),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 2,
    });
    expect(view().activeIdx).toBe(1);
    expect(view().strings[1]!.status).toBeNull();
  });

  it('falls back to the energy onset after 4 s of silence, then asks again when nothing was found', async () => {
    const { runner, mic, view, clock } = setup();
    runner.command('next');
    const armedAt = clock.t;
    clock.advance(4.1);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(mic.fallbackRequests).toHaveLength(1);
    expect(mic.fallbackRequests[0]!.from).toBeCloseTo(armedAt - 0.15, 9);
    expect(view().retry).toBe('NO_ONSET');
    mic.fallbackResult = {
      time: clock.t + 1,
      result: pluck({}),
      jobKind: 'pluck',
      detectorVersion: DETECTOR_VERSION,
      processingMs: 3,
    };
    clock.advance(4.1);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(view().strings[1]!.status).toBe('OK');
    expect(view().activeIdx).toBe(2);
  });

  it('x-string check: the muted string is plucked and must stay silent', () => {
    const { runner, mic, strike, view } = setup({}, { xStringCheck: true });
    runner.command('next');
    expect(view().activeIdx).toBe(0);
    expect(mic.job).toMatchObject({ kind: 'pluck', silent: true });
    strike(pluck({ status: 'UNEXPECTED', verdict: 'FAIL' }));
    expect(view().strings[0]!.status).toBe('UNEXPECTED');
    for (const _ of [1, 2, 3, 4, 5]) strike(pluck({}));
    expect(view().lastClean).toBe(false);
    expect(view().hints).toContainEqual({ code: 'unexpectedXString', stringNo: 6, lowestStringNo: 5 });
  });
});

describe('E1 — ear first, manual, strum beta, timer', () => {
  it('ear first: the verdict is revealed only after the self judgement; agreement is recorded', () => {
    const { runner, strike, view } = setup({ earFirst: true });
    runner.command('next');
    strike(pluck({}));
    expect(view().strings[1]!.revealed).toBe(false);
    expect(view().awaitingSelf).toBe(true);
    runner.command('manual1');
    expect(view().strings[1]!.revealed).toBe(true);
    expect(view().activeIdx).toBe(2);
    // Self first, verdict later.
    runner.command('manual2');
    expect(view().activeIdx).toBe(2);
    strike(pluck({}));
    expect(view().activeIdx).toBe(3);
    for (const _ of [3, 4, 5]) {
      strike(pluck({}));
      runner.command('manual1');
    }
    const attempt = runner.finish().attempts[0]!;
    expect(attempt.selfAgreement).toBeCloseTo(4 / 5, 9);
    expect(attempt.perString[2]!.selfStatus).toBe('muted');
  });

  it('no microphone → manual mode with keys 1/2/3', () => {
    const { runner, view } = setup({ mode: 'pluck' }, { mic: false });
    expect(view().mode).toBe('manual');
    runner.command('next');
    for (const cmd of ['manual1', 'manual1', 'manual3', 'manual1', 'manual1'] as const) runner.command(cmd);
    expect(view().lastClean).toBe(false);
    const result = runner.finish();
    expect(result.mode).toBe('manual');
    expect(result.attempts[0]!.perString.map((s) => s.selfStatus)).toEqual([
      null,
      'clean',
      'clean',
      'buzz',
      'clean',
      'clean',
    ]);
    expect(runner.dspStats()).toEqual({ detectorVersion: null, meanProcessingMs: 0, events: 0 });
  });

  it('strum beta: one strum judged by Mode B, UNEXPECTED 6th string fails', () => {
    const { runner, mic, strike, view } = setup({ mode: 'strum' });
    runner.command('next');
    expect(view().step).toBe('strum');
    expect(mic.job).toMatchObject({ kind: 'strum' });
    const result: StrumResult = {
      detectorVersion: DETECTOR_VERSION,
      confidence: 0.8,
      reasons: [],
      processingMs: 9,
      verdict: 'FAIL',
      // Mode B lists the played strings only; the ringing x string comes back as an unexpected note.
      strings: [1, 2, 3, 4, 5].map((idx) => ({
        idx,
        status: idx >= 4 ? 'UNVERIFIABLE' : 'OK',
        salienceDb: 20,
        decayDb: 0,
        relLateDb: 0,
        verifiable: idx < 4,
      })),
      unexpected: [{ idx: 0, midi: 40, salienceDb: 20, lateDb: 10 }],
      blamed: [0],
      referenceDb: 50,
    };
    strike(result);
    expect(view().step).toBe('release');
    expect(view().strumVerdict).toBe('FAIL');
    expect(view().strings[0]!.status).toBe('UNEXPECTED');
    expect(view().hints).toContainEqual({ code: 'unexpectedXString', stringNo: 6, lowestStringNo: 5 });
    const r = runner.finish();
    expect(r.attempts[0]!.strumVerdict).toBe('FAIL');
    expect(r.attempts[0]!.clean).toBe(false);
  });

  it('the block timer ends the exercise; abort ends it early', () => {
    const { runner, clock, view } = setup({ blockMs: 60_000 });
    runner.command('next');
    clock.advance(59);
    runner.tick();
    expect(runner.snapshot().phase).toBe('running');
    clock.advance(1.5);
    runner.tick();
    expect(runner.snapshot().phase).toBe('done');
    expect(view().activeIdx).toBeNull();
    const other = setup();
    other.runner.command('abort');
    expect(other.runner.snapshot().phase).toBe('done');
  });

  it('Next skips a string that cannot be judged (marked unverified)', () => {
    const { runner, strike, view } = setup();
    runner.command('next');
    runner.command('next'); // skip the 5th string
    expect(view().strings[1]!.status).toBe('UNVERIFIABLE');
    expect(view().activeIdx).toBe(2);
    for (let k = 0; k < 4; k++) strike(pluck({}));
    expect(view().step).toBe('release');
    expect(runner.finish().attempts[0]!.perString[1]!.status).toBe('UNVERIFIABLE');
  });

  it('x-string check: total silence (no onset at all) is the expected result', async () => {
    const { runner, mic, view, clock } = setup({}, { xStringCheck: true });
    runner.command('next');
    expect(view().activeIdx).toBe(0);
    clock.advance(3.6);
    runner.tick();
    await Promise.resolve();
    await Promise.resolve();
    expect(mic.fallbackRequests).toHaveLength(1);
    expect(view().strings[0]!.status).toBe('OK');
    expect(view().activeIdx).toBe(1);
  });

  it('strum beta: the same RETRY twice in a row suggests checking string by string', () => {
    const { runner, strike, view } = setup({ mode: 'strum' });
    runner.command('next');
    const retry = {
      detectorVersion: DETECTOR_VERSION,
      confidence: 0,
      reasons: ['AMBIGUOUS'],
      processingMs: 5,
      verdict: 'RETRY',
      strings: [],
      unexpected: [],
      blamed: [],
      referenceDb: 0,
    };
    strike(retry);
    expect(view().suggestPluck).toBe(false);
    strike(retry);
    expect(view().suggestPluck).toBe(true);
    expect(view().retry).toBe('AMBIGUOUS');
  });

  it('nothing is recorded when no attempt was completed', () => {
    const { runner } = setup();
    runner.command('next');
    runner.command('abort');
    expect(runner.hasResult()).toBe(false);
  });
});
