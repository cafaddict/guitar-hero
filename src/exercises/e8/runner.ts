/**
 * E8 alternate picking on one string (SPEC §11.8): eighth notes against the metronome (start 60 BPM).
 * Mode D hit rate plus evenness ioi_cv = sd(IOI)/mean(IOI); ≥ 90 % and ioi_cv ≤ 0.10 over 8 bars → +5 BPM.
 */
import { z } from 'zod';
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import type { AltPickResult } from '../../domain/exerciseResults';
import { ioiCv } from '../../dsp/timing';
import { BaseRunner } from '../baseRunner';
import { GridRecorder } from '../gridRecorder';
import type { ExerciseContext, RunnerCommand } from '../types';

export const e8ParamsSchema = z.object({
  stringIdx: z.number().int().min(0).max(5),
  bpm: z.number().int().min(30).max(240),
  bars: z.number().int().min(2).max(32),
  /**
   * The ladder's tempo when a "−10 BPM" prescription started (SPEC v1.1 §7.4): a slowed run never lowers the
   * stored ladder below it ("사다리 상태는 보존").
   */
  ladderBase: z.number().int().optional(),
});
export type E8Params = z.infer<typeof e8ParamsSchema>;

export const ALT_PICK_HIT_RATE = 0.9;
export const ALT_PICK_MAX_IOI_CV = 0.1;
export const ALT_PICK_MIN_BARS = 8;

export interface E8View {
  stringIdx: number;
  bpm: number;
  bars: number;
  bar: number | null;
  analyzing: boolean;
  awaitingSelf: boolean;
}

export class AltPickRunner extends BaseRunner<AltPickResult, E8View> {
  private readonly recorder: GridRecorder;
  private readonly slotS: number;
  private bar: number | null = null;
  private analyzing = false;
  private outcome: { hitRate: number; ioiCv: number | null } | null = null;

  constructor(
    ctx: ExerciseContext,
    private readonly params: E8Params,
  ) {
    super(ctx);
    this.slotS = 60 / params.bpm / 2;
    this.recorder = new GridRecorder(
      ctx,
      {
        ...DEFAULT_METRONOME_CONFIG,
        bpm: params.bpm,
        meter: '4/4',
        subdivision: 2,
        countInBars: 1,
        stopAfterBars: params.bars,
        visualOnly: ctx.settings.visualOnlyMetronome,
      },
      () => {
        this.bar = null;
        this.setPhase('review');
      },
      (event) => this.recordDsp(event),
    );
  }

  protected view(): E8View {
    return {
      stringIdx: this.params.stringIdx,
      bpm: this.params.bpm,
      bars: this.params.bars,
      bar: this.bar,
      analyzing: this.analyzing,
      awaitingSelf: !this.ctx.audio && this.phase === 'review',
    };
  }

  start(): void {
    this.own(() => this.recorder.dispose());
    this.setPhase('countIn');
    this.recorder.start(() => this.publish());
  }

  command(cmd: RunnerCommand): void {
    if (cmd === 'abort') {
      this.recorder.stop();
      if (this.phase !== 'done') this.setPhase('done');
      return;
    }
    if (this.phase !== 'review' || this.ctx.audio) return;
    const rate = cmd === 'manual1' ? 1 : cmd === 'manual2' ? 0.8 : cmd === 'manual3' ? 0.5 : null;
    if (rate === null) return;
    this.outcome = { hitRate: rate, ioiCv: null };
    this.setPhase('done');
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    const grid = this.recorder.gridStart;
    if (grid !== null && (this.phase === 'countIn' || this.phase === 'running')) {
      if (this.phase === 'countIn' && now >= grid) this.setPhase('running');
      const bar = now >= grid ? Math.floor((now - grid) / (8 * this.slotS)) : null;
      if (bar !== this.bar && (bar === null || bar < this.params.bars)) {
        this.bar = bar;
        this.publish();
      }
    }
    const mic = this.ctx.audio;
    if (
      mic &&
      grid !== null &&
      this.phase === 'review' &&
      !this.analyzing &&
      !this.outcome &&
      this.recorder.settled(now)
    ) {
      this.analyzing = true;
      this.publish();
      const slots = Array.from({ length: this.params.bars * 8 }, (_, i) => ({
        time: grid + i * this.slotS,
        expected: true,
      }));
      void mic
        .analyzeTiming({
          slots,
          strumTimes: this.recorder.strums,
          rttS: this.recorder.rttS,
          bpm: this.params.bpm,
          personalOffsetMs: this.ctx.personalOffsetMs ?? null,
        })
        .then((outcome) => {
          this.recordDsp(outcome);
          this.outcome = {
            hitRate: outcome.result.hitRate,
            ioiCv: ioiCv([...this.recorder.strums].sort((a, b) => a - b)),
          };
          this.analyzing = false;
          this.setPhase('done');
        })
        .catch(() => {
          // Scoring failed: end without a result (nothing is recorded).
          this.analyzing = false;
          this.setPhase('done');
        });
    }
  }

  /** Only a scored (or self-rated) run is recorded. */
  hasResult(): boolean {
    return this.outcome !== null;
  }

  finish(): AltPickResult {
    const o = this.outcome ?? { hitRate: 0, ioiCv: null };
    const evenEnough = o.ioiCv === null ? this.ctx.audio === null : o.ioiCv <= ALT_PICK_MAX_IOI_CV;
    return {
      stringIdx: this.params.stringIdx,
      bpm: this.params.bpm,
      bars: this.params.bars,
      hitRate: o.hitRate,
      ioiCv: o.ioiCv,
      // The +5 BPM rule is defined over 8 bars (SPEC §11.8).
      passed:
        this.outcome !== null &&
        this.params.bars >= ALT_PICK_MIN_BARS &&
        o.hitRate >= ALT_PICK_HIT_RATE &&
        evenEnough,
      source: this.ctx.audio ? 'mic' : 'self',
      ...(this.params.ladderBase !== undefined ? { ladderBase: this.params.ladderBase } : {}),
    };
  }
}
