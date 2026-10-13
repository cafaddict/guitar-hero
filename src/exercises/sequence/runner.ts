/**
 * Shared runner of the single-note sequence exercises (E9 chromatic, E10 scale ladder, E11 hammer-ons,
 * E17 riffs — SPEC v1.1 §10.10). The metronome clicks the beat; notes fall on the grid (one or two per click).
 * With a microphone the cycles are judged by the DSP worker through SequenceTracker; without one each cycle is
 * self-reported (1 = flawless, 2 = a mistake). H hides/shows the TAB (§12.3).
 */
import { DEFAULT_METRONOME_CONFIG } from '../../audio/metronome';
import type { SequenceCycle } from '../../domain/exerciseResults';
import { BaseRunner } from '../baseRunner';
import type { DspStats, ExerciseContext, RunnerCommand } from '../types';
import { type CycleOutcome, type PlannedSlot, SequenceTracker } from './tracker';

export interface PlannedNote {
  /** Guitar string number 6 … 1. */
  string: number;
  fret: number;
  midi: number;
  /** Hammer-on slot (E11): judged by the legato beta only. */
  legato?: boolean;
  /** Fretting finger 1–4 (0 = open string), shown under the TAB (D-080). */
  finger?: number;
}

export interface SequenceView {
  bpm: number;
  tabHidden: boolean;
  source: 'mic' | 'self';
  /** Notes of the cycle being played and the index due now (null outside the grid). */
  cycleNotes: readonly PlannedNote[];
  noteIndex: number | null;
  /** Notes of the last recorded cycle (its faults index into them). */
  lastCycleNotes: readonly PlannedNote[] | null;
  cycleNumber: number;
  cycles: readonly SequenceCycle[];
  streak: number;
  countIn: boolean;
  analyzing: boolean;
}

/** Seconds of notes planned ahead of the audio clock. */
const PLAN_AHEAD_S = 4;

/** Current run of flawless cycles (uncertain cycles neither extend nor break it). */
export function flawlessStreak(cycles: readonly Pick<SequenceCycle, 'flawless' | 'uncertain'>[]): number {
  let n = 0;
  for (let i = cycles.length - 1; i >= 0; i--) {
    const c = cycles[i]!;
    if (c.flawless) n += 1;
    else if (!c.uncertain) break;
  }
  return n;
}

export abstract class SequenceRunner<R, V extends SequenceView> extends BaseRunner<R, V> {
  protected readonly cycleRecords: SequenceCycle[] = [];
  protected tabHidden: boolean;
  /** TAB stayed hidden while every cycle so far was played (memorization runs). */
  protected hiddenThroughout: boolean;
  protected readonly source: 'mic' | 'self';
  private tracker: SequenceTracker | null = null;
  private gridStart: number | null = null;
  private plannedCycles = 0;
  private plannedNotes = 0;
  private readonly cycleStarts: number[] = [];
  private readonly cycleNotesByIndex: PlannedNote[][] = [];
  private noteIndex: number | null = null;
  private lastRecordedNotes: PlannedNote[] | null = null;
  private cycleNumber = 0;
  private waiting = false;
  /** Every matched onset time of the run (ioi_cv). */
  protected readonly onsetTimes: number[] = [];

  constructor(
    ctx: ExerciseContext,
    protected readonly bpm: number,
    tabHidden: boolean,
    /** Notes per metronome click (1 = quarters, 2 = eighths). */
    private readonly notesPerBeat: number,
  ) {
    super(ctx);
    this.tabHidden = tabHidden;
    this.hiddenThroughout = tabHidden;
    this.source = ctx.audio ? 'mic' : 'self';
  }

  /** Notes of cycle k (0-based). */
  protected abstract planCycle(k: number): PlannedNote[];
  /** Called after each judged or self-reported cycle (ladder state, etc.). */
  protected onCycleRecorded(): void {}

  protected get slotS(): number {
    return 60 / this.bpm / this.notesPerBeat;
  }

  protected baseView(): SequenceView {
    return {
      bpm: this.bpm,
      tabHidden: this.tabHidden,
      source: this.source,
      cycleNotes: this.cycleNotesByIndex[this.cycleNumber] ?? this.planPreview(),
      noteIndex: this.noteIndex,
      lastCycleNotes: this.lastRecordedNotes,
      cycleNumber: this.cycleNumber,
      cycles: [...this.cycleRecords],
      streak: flawlessStreak(this.cycleRecords),
      countIn: this.phase === 'countIn',
      analyzing: this.waiting,
    };
  }

  private preview: PlannedNote[] | null = null;
  private planPreview(): PlannedNote[] {
    this.preview ??= this.planCycle(0);
    return this.preview;
  }

  start(): void {
    this.setPhase('ready');
  }

  command(cmd: RunnerCommand): void {
    if (this.phase === 'done') return;
    if (cmd === 'abort') {
      this.ctx.output.metronome.stop();
      this.tracker?.stop();
      this.setPhase('done');
      return;
    }
    if (cmd === 'hide' && this.phase !== 'review') {
      this.tabHidden = !this.tabHidden;
      if (!this.tabHidden && (this.phase === 'running' || this.phase === 'countIn'))
        this.hiddenThroughout = false;
      this.publish();
      return;
    }
    if (this.phase === 'ready' && (cmd === 'toggle' || cmd === 'next')) {
      this.begin();
      return;
    }
    if (this.phase !== 'running' && this.phase !== 'countIn') return;
    if (this.source === 'self' && (cmd === 'manual1' || cmd === 'manual2')) {
      this.lastRecordedNotes = this.cycleNotesByIndex[this.cycleNumber] ?? null;
      this.record({ flawless: cmd === 'manual1', uncertain: false, stops: 0, okRatio: null });
      return;
    }
    if (cmd === 'toggle' || (cmd === 'next' && this.cycleRecords.length > 0)) this.end();
  }

  private begin(): void {
    const metronome = this.ctx.output.metronome;
    this.own(() => metronome.stop());
    if (this.ctx.audio) {
      // 'onsets' keeps the engine judging (synth playback is refused while the microphone listens, §8.6).
      this.ctx.audio.setJob({ kind: 'onsets' });
      this.own(() => this.ctx.audio?.setJob(null));
      this.tracker = new SequenceTracker(this.ctx.audio, {
        bpm: this.bpm,
        ...(this.ctx.calibration?.tuningCents ? { deltaCents: this.ctx.calibration.tuningCents } : {}),
      });
      this.own(this.tracker.onCycle((c) => this.onTracked(c)));
    }
    this.setPhase('countIn');
    void metronome
      .start(
        { ...DEFAULT_METRONOME_CONFIG, bpm: this.bpm, visualOnly: this.ctx.settings.visualOnlyMetronome },
        { rttMs: this.ctx.calibration?.rttMs ?? 0 },
      )
      .then(() => {
        // The run may have ended (Space, abort) or been left while the audio context was starting.
        if (this.isDisposed || this.phase !== 'countIn') return;
        this.gridStart = metronome.gridStartTime();
        this.planAhead(this.ctx.output.now());
        if (this.gridStart !== null) this.onGrid(this.gridStart);
        this.publish();
      })
      .catch(() => {
        // Without a metronome there is no grid to judge against: the run ends without cycles.
        if (!this.isDisposed && this.phase !== 'done') this.setPhase('done');
      });
  }

  /** Called once the grid origin (bar 1 after the count-in) is known. */
  protected onGrid(_gridStart: number): void {}

  /** Expected arrival of note n (grid + RTT + personal lead, §10.10 input). */
  private slotTime(n: number): number {
    const rtt = (this.ctx.calibration?.rttMs ?? 0) / 1000;
    const lead = (this.ctx.personalOffsetMs ?? 0) / 1000;
    return this.gridStart! + n * this.slotS + rtt + lead;
  }

  private planAhead(now: number): void {
    if (this.gridStart === null) return;
    while (this.plannedNotes === 0 || this.slotTime(this.plannedNotes) < now + PLAN_AHEAD_S) {
      const k = this.plannedCycles++;
      const notes = this.planCycle(k);
      this.cycleNotesByIndex[k] = notes;
      this.cycleStarts[k] = this.plannedNotes;
      const slots: PlannedSlot[] = notes.map((n, j) => ({
        time: this.slotTime(this.plannedNotes + j),
        midi: n.midi,
        stringIdx: 6 - n.string,
        cycle: k,
        ...(n.legato ? { legatoAllowed: true } : {}),
      }));
      this.plannedNotes += notes.length;
      this.tracker?.addSlots(slots);
    }
  }

  private onTracked(c: CycleOutcome): void {
    this.onsetTimes.push(...c.onsetTimes);
    this.lastRecordedNotes = this.cycleNotesByIndex[c.cycle] ?? null;
    const faults = c.notes.flatMap((n, index) =>
      n.status === 'OK' || n.status === 'HAMMER_OK'
        ? []
        : [{ index, status: n.status, ...(n.semitones === undefined ? {} : { semitones: n.semitones }) }],
    );
    this.record({
      flawless: c.flawless,
      uncertain: c.uncertain,
      stops: c.stops,
      okRatio: c.okRatio,
      hitRate: c.hitRate,
      extras: c.extras,
      faults,
    });
  }

  private record(cycle: SequenceCycle): void {
    this.cycleRecords.push(cycle);
    this.onCycleRecorded();
    this.publish();
  }

  private end(): void {
    this.ctx.output.metronome.stop();
    if (this.tracker) {
      // Notes already played are still judged; the planned ones after now are dropped.
      this.tracker.stopAt(this.ctx.output.now());
      this.waiting = true;
      this.setPhase('review');
      return;
    }
    this.setPhase('done');
  }

  override tick(): void {
    super.tick();
    const now = this.ctx.output.now();
    if (this.gridStart !== null && (this.phase === 'countIn' || this.phase === 'running')) {
      if (this.phase === 'countIn' && now >= this.gridStart) this.setPhase('running');
      this.planAhead(now);
      const n = Math.floor((now - this.gridStart) / this.slotS);
      let cycle = 0;
      while (cycle + 1 < this.cycleStarts.length && this.cycleStarts[cycle + 1]! <= n) cycle++;
      const index = n >= 0 ? n - (this.cycleStarts[cycle] ?? 0) : null;
      if (index !== this.noteIndex || cycle !== this.cycleNumber) {
        this.noteIndex = index;
        this.cycleNumber = cycle;
        this.publish();
      }
    }
    this.tracker?.pump(now);
    if (this.phase === 'review' && this.waiting && this.tracker?.idle) {
      this.waiting = false;
      this.setPhase('done');
    }
  }

  hasResult(): boolean {
    return this.cycleRecords.length > 0;
  }

  override dspStats(): DspStats {
    return this.tracker ? this.tracker.stats() : super.dspStats();
  }

  override dispose(): void {
    this.ctx.output.metronome.stop();
    this.tracker?.stop();
    super.dispose();
  }
}
