/**
 * E16 fret-position comparison (SPEC v1.1 §11.18, research 01:94, 01:238): the 2nd string at the 1st fret (C4)
 * plucked twice at each of three positions with the same light pressure — right behind the fret, in the middle
 * of the space, on top of the fret wire. With a microphone every pluck is judged in Mode A and the positions are
 * shown side by side (status, clarity, decay); without one the user rates each pluck (1 clean / 2 muted /
 * 3 buzz). There is no pass or fail.
 */
import { z } from 'zod';
import type { FretPositionResult } from '../../domain/exerciseResults';
import { applyCents, midiToHz, STANDARD_TUNING } from '../../domain/theory';
import type { PluckResult } from '../../dsp/modeA';
import { BaseRunner } from '../baseRunner';
import type { ExerciseContext, JudgedEvent, RunnerCommand } from '../types';

export const e16ParamsSchema = z.object({ plucksPerPosition: z.number().int().min(1).max(4).default(2) });
export type E16Params = z.infer<typeof e16ParamsSchema>;

export const FRET_POSITIONS = ['behind', 'middle', 'onFret'] as const;
export type FretPosition = (typeof FRET_POSITIONS)[number];
/** 2nd string (index 4), 1st fret = C4. */
export const E16_STRING_IDX = 4;
export const E16_FRET = 1;

type Status = FretPositionResult['positions'][number]['statuses'][number];

interface PositionRecord {
  pos: FretPosition;
  statuses: Status[];
  clarity: number[];
  decay: number[];
}

export interface E16View {
  position: FretPosition | null;
  pluck: number;
  perPosition: number;
  source: 'mic' | 'self';
  positions: readonly {
    pos: FretPosition;
    statuses: readonly Status[];
    clarity: number | null;
    decayRatio: number | null;
  }[];
  /** Last pluck could not be judged (Mode A RETRY). */
  retry: boolean;
}

const SELF: Partial<Record<RunnerCommand, Status>> = { manual1: 'clean', manual2: 'muted', manual3: 'buzz' };
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export class FretPositionRunner extends BaseRunner<FretPositionResult, E16View> {
  private readonly records: PositionRecord[] = FRET_POSITIONS.map((pos) => ({
    pos,
    statuses: [],
    clarity: [],
    decay: [],
  }));
  private posIndex = 0;
  private retry = false;
  private readonly expectedF0: number;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E16Params,
  ) {
    super(ctx);
    const midi = STANDARD_TUNING.openMidi[E16_STRING_IDX]! + E16_FRET;
    this.expectedF0 = applyCents(midiToHz(midi), ctx.calibration?.tuningCents[E16_STRING_IDX] ?? 0);
  }

  private get source(): 'mic' | 'self' {
    return this.ctx.audio ? 'mic' : 'self';
  }

  protected view(): E16View {
    const record = this.records[this.posIndex];
    return {
      position: record?.pos ?? null,
      pluck: record ? record.statuses.length + 1 : 0,
      perPosition: this.params.plucksPerPosition,
      source: this.source,
      positions: this.records.map((r) => ({
        pos: r.pos,
        statuses: [...r.statuses],
        clarity: mean(r.clarity),
        decayRatio: mean(r.decay),
      })),
      retry: this.retry,
    };
  }

  start(): void {
    const mic = this.ctx.audio;
    if (mic) {
      this.own(mic.onJudged((e) => this.onJudged(e)));
      this.own(() => mic.setJob(null));
      const template = this.ctx.calibration?.stringTemplates[E16_STRING_IDX]?.decayRatio;
      mic.setJob({
        kind: 'pluck',
        expectedF0: this.expectedF0,
        ...(template === undefined ? {} : { templateDecayRatio: template }),
        strictness: this.ctx.settings.strictness,
        silent: false,
      });
    }
    this.setPhase('running');
  }

  private onJudged(event: JudgedEvent): void {
    if (this.phase !== 'running' || event.jobKind !== 'pluck') return;
    this.recordDsp(event);
    const result = event.result as PluckResult;
    if (result.verdict === 'RETRY') {
      this.retry = true;
      this.publish();
      return;
    }
    const status: Status =
      result.status === 'OK' ||
      result.status === 'WEAK' ||
      result.status === 'MUTED' ||
      result.status === 'WRONG_NOTE'
        ? result.status
        : 'WEAK';
    this.add(status, result.clarity, result.decayRatio);
  }

  command(cmd: RunnerCommand): void {
    if (this.phase === 'done') return;
    if (cmd === 'abort' || (cmd === 'next' && this.posIndex >= FRET_POSITIONS.length)) {
      this.ctx.audio?.setJob(null);
      this.setPhase('done');
      return;
    }
    const self = SELF[cmd];
    if (self && !this.ctx.audio) this.add(self, null, null);
  }

  private add(status: Status, clarity: number | null, decay: number | null): void {
    const record = this.records[this.posIndex];
    if (!record) return;
    this.retry = false;
    record.statuses.push(status);
    if (clarity !== null) record.clarity.push(clarity);
    if (decay !== null) record.decay.push(decay);
    if (record.statuses.length >= this.params.plucksPerPosition) this.posIndex += 1;
    if (this.posIndex >= FRET_POSITIONS.length) {
      this.ctx.audio?.setJob(null);
      this.setPhase('done');
    } else this.publish();
  }

  hasResult(): boolean {
    return this.records.some((r) => r.statuses.length > 0);
  }

  finish(): FretPositionResult {
    return {
      positions: this.records
        .filter((r) => r.statuses.length > 0)
        .map((r) => ({
          pos: r.pos,
          statuses: [...r.statuses],
          clarity: mean(r.clarity),
          decayRatio: mean(r.decay),
        })),
      source: this.source,
    };
  }
}
