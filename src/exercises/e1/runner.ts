/**
 * E1 chord check, "Chord Perfect" style (SPEC §11.3). Per attempt: place the fingers → (strum mode) one full
 * strum judged by Mode B (beta) → (pluck mode) the played strings are highlighted from low to high and each
 * pluck is judged by Mode A; x strings are skipped (or checked for silence when the x-string check is on) →
 * "release and place again". Manual mode (no microphone) asks clean/muted/buzz per string (keys 1/2/3).
 * Ear-first: the user judges each string before the app's verdict is revealed.
 */
import { z } from 'zod';
import { GENERAL_TIPS } from '../../content/tips';
import { type CoachingHint, coachingHints, hintForString, type StringJudgement } from '../../domain/coaching';
import type { ChordCheckAttempt, ChordCheckResult, StringStatusValue } from '../../domain/exerciseResults';
import { STRING_INDICES } from '../../domain/strings';
import { STANDARD_TUNING } from '../../domain/theory';
import { type ChordVoicing, expectedNotes } from '../../domain/voicing';
import type { PluckResult } from '../../dsp/modeA';
import type { StrumResult } from '../../dsp/modeB';
import type { RetryReason, Sensitivity } from '../../dsp/types';
import { DETECTOR_VERSION } from '../../dsp/version';
import { BaseRunner } from '../baseRunner';
import { TakeTracker } from '../take';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

export const e1ParamsSchema = z.object({
  voicingId: z.string().min(1),
  // 1–3 min (§11.3); down to 30 s when the routine halves fingertip load after pain ≥ 5 (§7.3-7, D-049).
  blockMs: z.number().int().min(30_000).max(180_000),
  mode: z.enum(['pluck', 'strum', 'manual']),
  earFirst: z.boolean(),
});
export type E1Params = z.infer<typeof e1ParamsSchema>;

export type SelfStatus = 'clean' | 'muted' | 'buzz';
export type E1Step = 'place' | 'strum' | 'strings' | 'release';

export interface E1StringView {
  idx: number;
  /** x string not checked. */
  skipped: boolean;
  status: StringStatusValue | null;
  selfStatus: SelfStatus | null;
  /** Ear-first: the app verdict stays hidden until the user judged the string. */
  revealed: boolean;
  cents: number | null;
  hint: CoachingHint | null;
}

export interface E1View {
  voicingId: string;
  mode: E1Params['mode'];
  earFirst: boolean;
  step: E1Step;
  strings: E1StringView[];
  activeIdx: number | null;
  /** Waiting for the user's own judgement of the active string (ear-first / manual). */
  awaitingSelf: boolean;
  retry: RetryReason | null;
  /** Strum beta could not decide twice in a row for the same reason: suggest the pluck mode. */
  suggestPluck: boolean;
  strumVerdict: 'PASS' | 'FAIL' | 'RETRY' | null;
  /** Hints for the attempt that just finished (step 'release'). */
  hints: CoachingHint[];
  lastClean: boolean | null;
  attempts: number;
  cleanAttempts: number;
}

/** Seconds after arming without a take before the Mode A energy fallback runs (the analysed window
 * [arm − 0.15 s, now] must fit in the 3.9 s capture ring). */
const FALLBACK_AFTER_S = 3.5;
/** The same strum RETRY twice in a row → suggest string-by-string checking (SPEC §10.6-6). */
const STRUM_RETRY_SUGGEST = 2;
/** Strings passed to Mode A as still ringing (D-074): the latest per string, at most this many and this old. */
const RINGING_MAX = 3;
const RINGING_MAX_AGE_S = 4;
/**
 * Non-string retries that decayed like a muted string tolerated on one string before the string counts as
 * MUTED (D-073): a real dead thud can look like a knock, so it cannot be retried forever.
 */
const NOT_STRING_TOLERANCE: Record<Sensitivity, number> = { low: 2, normal: 1, high: 1 };
/** A pluck judged against another string's note (cents) was made before the job switched: judge it again. */
const JOB_MISMATCH_CENTS = 1;
const SELF_KEYS: Partial<Record<RunnerCommand, SelfStatus>> = {
  manual1: 'clean',
  manual2: 'muted',
  manual3: 'buzz',
};

/** Judgement for an x string during which nothing at all was heard (no onset, energy fallback empty). */
function silentStringOk(): PluckResult {
  return {
    detectorVersion: DETECTOR_VERSION,
    confidence: 1,
    reasons: [],
    processingMs: 0,
    status: 'OK',
    verdict: 'PASS',
    f0: null,
    cents: null,
    semitones: null,
    clarity: 0,
    decayRatio: null,
    levelDb: 0,
  };
}

function freshStrings(voicing: ChordVoicing, xStringCheck: boolean, mode: E1Params['mode']): E1StringView[] {
  return STRING_INDICES.map((idx) => ({
    idx,
    skipped: voicing.frets[idx] === 'x' && !(xStringCheck && mode === 'pluck'),
    status: null,
    selfStatus: null,
    revealed: false,
    cents: null,
    hint: null,
  }));
}

export class ChordCheckRunner extends BaseRunner<ChordCheckResult, E1View> {
  private mode: E1Params['mode'];
  private earFirstOn: boolean;
  private readonly expectedF0 = new Map<number, number>();
  private readonly take: TakeTracker;
  private step: E1Step = 'place';
  private strings: E1StringView[];
  private activeIdx: number | null = null;
  private retry: RetryReason | null = null;
  private strumVerdict: E1View['strumVerdict'] = null;
  private hints: CoachingHint[] = [];
  private lastClean: boolean | null = null;
  private readonly attempts: ChordCheckAttempt[] = [];
  private consecutiveFailures = 0;
  private fallbackBusy = false;
  private strumRetry: { reason: RetryReason; count: number } | null = null;
  /** Per-string Mode A confidence / semitone offset of the current attempt. */
  private readonly confidence = new Map<number, number>();
  private readonly semitones = new Map<number, number | null>();
  /** Strings that sounded in this attempt (measured f0, audio-clock onset), oldest first (D-074). */
  private sounding: { idx: number; f0: number; time: number }[] = [];
  /** Muted-like NOT_STRING retries per string of this attempt (D-073). */
  private readonly notStringRetries = new Map<number, number>();

  constructor(
    ctx: ExerciseContext,
    private readonly params: E1Params,
    private readonly voicing: ChordVoicing,
  ) {
    super(ctx);
    // Without a microphone every mode degrades to the manual self-check.
    this.mode = ctx.audio ? params.mode : 'manual';
    this.earFirstOn = params.earFirst;
    this.strings = freshStrings(voicing, ctx.settings.xStringCheck, this.mode);
    for (const n of expectedNotes(voicing, STANDARD_TUNING, 0, ctx.calibration?.tuningCents))
      this.expectedF0.set(n.idx, n.f0);
    this.take = new TakeTracker(() => ctx.output.now());
  }

  protected view(): E1View {
    return {
      voicingId: this.voicing.id,
      mode: this.mode,
      earFirst: this.earFirst,
      step: this.step,
      strings: this.strings.map((s) => ({ ...s })),
      activeIdx: this.activeIdx,
      awaitingSelf: this.awaitingSelf(),
      retry: this.retry,
      suggestPluck: (this.strumRetry?.count ?? 0) >= STRUM_RETRY_SUGGEST,
      strumVerdict: this.strumVerdict,
      hints: this.hints,
      lastClean: this.lastClean,
      attempts: this.attempts.length,
      cleanAttempts: this.attempts.filter((a) => a.clean).length,
    };
  }

  private get earFirst(): boolean {
    return this.earFirstOn && this.mode === 'pluck';
  }

  /** Mode and ear-first as they are now (option keys M / E, SPEC v1.1 §11.3, §12.3). */
  effectiveParams(): E1Params {
    return { ...this.params, mode: this.mode, earFirst: this.earFirstOn };
  }

  /** M cycles the mode (pluck → strum beta → manual) and E toggles ear-first, between attempts only. */
  private changeOption(cmd: 'mark' | 'ear'): void {
    if (this.step !== 'place' && this.step !== 'release') return;
    if (cmd === 'ear') this.earFirstOn = !this.earFirstOn;
    else {
      if (!this.ctx.audio) return; // without a microphone only the manual check exists
      const order: E1Params['mode'][] = ['pluck', 'strum', 'manual'];
      this.mode = order[(order.indexOf(this.mode) + 1) % order.length]!;
      this.strings = freshStrings(this.voicing, this.ctx.settings.xStringCheck, this.mode);
    }
    this.publish();
  }

  private awaitingSelf(): boolean {
    if (this.step !== 'strings' || this.activeIdx === null) return false;
    const s = this.strings[this.activeIdx]!;
    return (this.mode === 'manual' || this.earFirst) && s.selfStatus === null;
  }

  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(mic.onCoarseOnset((t) => this.take.noteCoarse(t)));
      this.own(mic.onJudged((e) => this.onJudged(e)));
      this.own(() => mic.setJob(null));
    }
    this.startTimer(this.params.blockMs);
    this.step = 'place';
    this.setPhase('running');
  }

  command(cmd: RunnerCommand): void {
    if (this.phase !== 'running') return;
    if (cmd === 'abort') {
      this.endBlock();
      return;
    }
    if (cmd === 'mark' || cmd === 'ear') {
      this.changeOption(cmd);
      return;
    }
    const self = SELF_KEYS[cmd];
    if (self) {
      this.selfJudge(self);
      return;
    }
    if (cmd !== 'next' && cmd !== 'toggle') return;
    if (this.step === 'place') this.beginJudging();
    else if (this.step === 'release') this.beginAttempt();
    else if (this.step === 'strings' && cmd === 'next') this.skipActive();
  }

  /** Next on a string that cannot be judged (noise, a stuck take): mark it unverified and move on. */
  private skipActive(): void {
    const idx = this.activeIdx;
    if (idx === null) return;
    const s = this.strings[idx]!;
    s.status = 'UNVERIFIABLE';
    s.revealed = true;
    s.hint = null;
    this.retry = null;
    this.take.disarm();
    this.activate(this.nextPending(idx));
  }

  /** Placement done → strum (beta) or the first string. */
  private beginJudging(): void {
    this.retry = null;
    if (this.mode === 'strum') {
      this.step = 'strum';
      this.ctx.audio?.setJob({
        kind: 'strum',
        voicing: this.voicing,
        deltaCents: this.ctx.calibration?.tuningCents,
        strictness: this.ctx.settings.strictness,
      });
      this.take.arm();
      this.publish();
      return;
    }
    this.step = 'strings';
    this.activate(this.nextPending(-1));
  }

  private beginAttempt(): void {
    this.strings = freshStrings(this.voicing, this.ctx.settings.xStringCheck, this.mode);
    // Releasing the chord damps the strings: nothing from the previous attempt keeps ringing.
    this.sounding = [];
    this.notStringRetries.clear();
    this.step = 'place';
    this.activeIdx = null;
    this.retry = null;
    this.strumVerdict = null;
    this.hints = [];
    this.take.disarm();
    this.ctx.audio?.setJob(null);
    this.publish();
  }

  private nextPending(after: number): number | null {
    for (let idx = after + 1; idx < this.strings.length; idx++) {
      const s = this.strings[idx]!;
      if (!s.skipped && s.status === null && s.selfStatus === null) return idx;
    }
    return null;
  }

  /** `armAt`: arm the take from this audio time (the previous take's span end) instead of now (D-076). */
  private activate(idx: number | null, armAt?: number): void {
    this.activeIdx = idx;
    if (idx === null) {
      this.completeAttempt();
      return;
    }
    const mic = this.ctx.audio;
    if (this.mode !== 'manual' && mic) {
      const template = this.ctx.calibration?.stringTemplates[idx]?.decayRatio;
      mic.setJob({
        kind: 'pluck',
        expectedF0: this.expectedFor(idx),
        ...(template === undefined ? {} : { templateDecayRatio: template }),
        strictness: this.ctx.settings.strictness,
        sensitivity: this.ctx.settings.sensitivity,
        ringing: this.ringingFor(idx).map((r) => ({ f0: r.f0, sample: mic.captureSampleOf(r.time) })),
        silent: this.voicing.frets[idx] === 'x',
      });
      this.take.arm(armAt);
    }
    this.publish();
  }

  private expectedFor(idx: number): number {
    return this.expectedF0.get(idx) ?? this.openF0(idx);
  }

  /** The other strings sounded recently in this attempt, oldest first (Mode A cancels their ringing). */
  private ringingFor(idx: number): { f0: number; time: number }[] {
    const now = this.ctx.output.now();
    return this.sounding
      .filter((s) => s.idx !== idx && now - s.time <= RINGING_MAX_AGE_S)
      .slice(-RINGING_MAX)
      .map(({ f0, time }) => ({ f0, time }));
  }

  private noteSounding(idx: number, f0: number, time: number): void {
    // A new pluck on a string restarts (or stops) whatever it was sounding.
    this.sounding = [...this.sounding.filter((s) => s.idx !== idx), { idx, f0, time }];
  }

  /** x strings are checked against their open note (a sounding string is UNEXPECTED). */
  private openF0(idx: number): number {
    const midi = STANDARD_TUNING.openMidi[idx]!;
    const delta = this.ctx.calibration?.tuningCents[idx] ?? 0;
    return 440 * 2 ** ((midi - 69) / 12) * 2 ** (delta / 1200);
  }

  private onJudged(event: JudgedEvent): void {
    if (this.phase !== 'running') return;
    if (this.step === 'strum' && event.jobKind === 'strum') this.onStrum(event);
    else if (this.step === 'strings' && event.jobKind === 'pluck') this.onPluck(event);
  }

  private onPluck(event: JudgedEvent): void {
    const idx = this.activeIdx;
    if (idx === null) return;
    const s = this.strings[idx]!;
    if (s.status !== null) return; // already judged (ear-first waiting for the self judgement)
    const decision = this.take.decide(event);
    if (decision === 'ignore') return;
    const result = event.result as PluckResult;
    const judgedFor = result.expectedF0;
    if (
      judgedFor !== undefined &&
      Math.abs(1200 * Math.log2(judgedFor / this.expectedFor(idx))) > JOB_MISMATCH_CENTS
    ) {
      // Plucked right before the job switched to this string: the worker judged it as the previous one.
      this.runFallback(idx, event.time - 0.15);
      return;
    }
    this.recordDsp(event);
    if (decision === 'multiple') {
      this.retryTake('MULTIPLE_ONSETS');
      return;
    }
    this.applyPluck(idx, result, event.time);
  }

  /** `time`: the take's audio-clock onset (absent for the silent x-string result). */
  private applyPluck(idx: number, judged: PluckResult, time?: number): void {
    let result = judged;
    const armAt = time === undefined ? undefined : TakeTracker.nextArmAt(time);
    if (result.verdict === 'RETRY') {
      const reason = result.reasons[0] ?? 'AMBIGUOUS';
      const sensitivity = this.ctx.settings.sensitivity;
      if (reason === 'NOT_STRING' && result.fastDecay) {
        const count = (this.notStringRetries.get(idx) ?? 0) + 1;
        this.notStringRetries.set(idx, count);
        // Heard again and again on this string: it is the string itself, sounding dead (D-073).
        if (count > NOT_STRING_TOLERANCE[sensitivity])
          result = { ...result, status: 'MUTED', verdict: 'FAIL', reasons: [] };
      }
      if (result.verdict === 'RETRY') {
        // "둔감": a quiet sound is not worth a message, keep listening (D-075).
        this.retryTake(reason, armAt, reason === 'LOW_LEVEL' && sensitivity === 'low');
        return;
      }
    }
    const s = this.strings[idx]!;
    this.take.disarm();
    this.retry = null;
    this.notStringRetries.delete(idx);
    if (
      time !== undefined &&
      (result.status === 'OK' || result.status === 'WRONG_NOTE' || result.status === 'UNEXPECTED')
    )
      this.noteSounding(idx, result.f0 ?? this.expectedFor(idx), time);
    s.status = result.status;
    s.cents = result.cents;
    s.hint = hintForString(this.voicing, { idx, status: result.status, semitones: result.semitones });
    this.confidence.set(idx, result.confidence);
    this.semitones.set(idx, result.semitones);
    if (this.earFirst && s.selfStatus === null) {
      this.publish(); // verdict stays hidden until the user judged
      return;
    }
    s.revealed = true;
    this.activate(this.nextPending(idx), armAt);
  }

  /** `armAt`: re-arm from the retried take's span end; `quiet`: keep listening without a message. */
  private retryTake(reason: RetryReason, armAt?: number, quiet = false): void {
    this.retry = quiet ? null : reason;
    if (this.step === 'strum') {
      this.strumRetry =
        this.strumRetry?.reason === reason
          ? { reason, count: this.strumRetry.count + 1 }
          : { reason, count: 1 };
    }
    this.take.arm(reason === 'MULTIPLE_ONSETS' ? undefined : armAt);
    this.publish();
  }

  private selfJudge(self: SelfStatus): void {
    if (this.step !== 'strings' || this.activeIdx === null) return;
    const idx = this.activeIdx;
    const s = this.strings[idx]!;
    if (this.mode === 'manual') {
      s.selfStatus = self;
      s.revealed = true;
      this.activate(this.nextPending(idx));
      return;
    }
    if (!this.earFirst || s.selfStatus !== null) return;
    s.selfStatus = self;
    if (s.status === null) {
      this.publish(); // wait for the app verdict
      return;
    }
    s.revealed = true;
    this.activate(this.nextPending(idx));
  }

  private onStrum(event: JudgedEvent): void {
    const decision = this.take.decide(event);
    if (decision === 'ignore') return;
    this.recordDsp(event);
    if (decision === 'multiple') {
      this.retryTake('MULTIPLE_ONSETS');
      return;
    }
    const result = event.result as StrumResult;
    if (result.verdict === 'RETRY') {
      this.retryTake(result.reasons[0] ?? 'AMBIGUOUS');
      return;
    }
    this.take.disarm();
    this.retry = null;
    this.strumRetry = null;
    this.strumVerdict = result.verdict;
    for (const r of result.strings) {
      const s = this.strings[r.idx]!;
      s.status = r.status;
      s.revealed = true;
      s.skipped = false;
      s.hint = hintForString(this.voicing, { idx: r.idx, status: r.status });
    }
    // A sounding x string is reported among the unexpected notes, not in `strings`.
    for (const u of result.unexpected) {
      if (u.idx === null || this.voicing.frets[u.idx] !== 'x') continue;
      const s = this.strings[u.idx]!;
      s.status = 'UNEXPECTED';
      s.revealed = true;
      s.skipped = false;
      s.hint = hintForString(this.voicing, { idx: u.idx, status: 'UNEXPECTED' });
    }
    this.completeAttempt();
  }

  private completeAttempt(): void {
    this.ctx.audio?.setJob(null);
    this.take.disarm();
    const judged = this.strings.filter((s) => !s.skipped);
    let clean: boolean;
    if (this.mode === 'manual') clean = judged.every((s) => s.selfStatus === 'clean');
    else if (this.mode === 'strum') clean = this.strumVerdict === 'PASS';
    else clean = judged.every((s) => s.status === 'OK');
    const both = judged.filter((s) => s.selfStatus !== null && s.status !== null);
    const selfAgreement =
      this.earFirst && both.length > 0
        ? both.filter((s) => (s.selfStatus === 'clean') === (s.status === 'OK')).length / both.length
        : null;
    this.attempts.push({
      perString: this.strings.map((s) => ({
        idx: s.idx,
        status: s.skipped ? 'NOT_PLAYED' : s.status,
        selfStatus: s.selfStatus,
        cents: s.cents,
        confidence: this.confidence.get(s.idx) ?? 0,
        semitones: this.semitones.get(s.idx) ?? null,
      })),
      clean,
      strumVerdict: this.mode === 'strum' ? this.strumVerdict : null,
      selfAgreement,
      mode: this.mode,
    });
    this.consecutiveFailures = clean ? 0 : this.consecutiveFailures + 1;
    const judgements: StringJudgement[] = judged
      .filter((s) => s.status !== null)
      .map((s) => ({ idx: s.idx, status: s.status!, semitones: this.semitones.get(s.idx) ?? null }));
    this.hints =
      this.mode === 'manual'
        ? []
        : coachingHints(this.voicing, judgements, this.consecutiveFailures, GENERAL_TIPS.length);
    this.lastClean = clean;
    this.confidence.clear();
    this.semitones.clear();
    this.activeIdx = null;
    this.step = 'release';
    this.publish();
  }

  override tick(): void {
    super.tick();
    if (this.phase !== 'running' || this.fallbackBusy || this.step !== 'strings' || this.activeIdx === null)
      return;
    if (!this.ctx.audio || this.mode !== 'pluck' || !this.take.shouldFallback(FALLBACK_AFTER_S)) return;
    this.runFallback(this.activeIdx, (this.take.armedTime ?? this.ctx.output.now()) - 0.15);
  }

  /** Energy-onset fallback over [from, now] judged for string `idx` (no take found, or a superseded job). */
  private runFallback(idx: number, from: number): void {
    const mic = this.ctx.audio;
    if (!mic || this.fallbackBusy) return;
    const silent = this.voicing.frets[idx] === 'x';
    this.fallbackBusy = true;
    void mic
      .pluckFallback({
        from,
        to: this.ctx.output.now(),
        expectedF0: this.expectedFor(idx),
        templateDecayRatio: this.ctx.calibration?.stringTemplates[idx]?.decayRatio,
        strictness: this.ctx.settings.strictness,
        sensitivity: this.ctx.settings.sensitivity,
        silent,
        ringing: this.ringingFor(idx),
      })
      .then((event) => {
        this.fallbackBusy = false;
        if (this.phase !== 'running' || this.activeIdx !== idx || this.strings[idx]!.status !== null) return;
        if (!event) {
          // An x string that stays silent produces no onset at all: that is exactly the expected result.
          if (silent) this.applyPluck(idx, silentStringOk());
          else this.retryTake('NO_ONSET');
          return;
        }
        this.recordDsp(event);
        this.applyPluck(idx, event.result as PluckResult, event.time);
      })
      .catch(() => {
        this.fallbackBusy = false;
      });
  }

  protected override onTimeUp(): void {
    this.endBlock();
  }

  private endBlock(): void {
    this.ctx.audio?.setJob(null);
    this.take.disarm();
    this.step = 'release';
    this.activeIdx = null;
    this.setPhase('done');
  }

  hasResult(): boolean {
    return this.attempts.length > 0;
  }

  finish(): ChordCheckResult {
    const clean = this.attempts.filter((a) => a.clean).length;
    return {
      voicingId: this.voicing.id,
      mode: this.mode,
      earFirst: this.earFirst,
      attempts: this.attempts,
      cleanRatio: this.attempts.length ? clean / this.attempts.length : 0,
    };
  }
}
