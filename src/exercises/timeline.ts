/**
 * The recording timeline of a take that can be paused (D-085): a list of segments, each a stretch of
 * consecutive units (bars, or sequence slots) played on its own metronome grid. A pause closes the open segment
 * at the unit to replay; the resume starts the next segment there on a new grid. Units are numbered across the
 * whole take, so bar k keeps its number (and content) whichever segment played it.
 */

export interface TimelineSegment {
  /** Audio-clock time of the segment's first unit (its downbeat, after the count-in). */
  readonly grid: number;
  /** First unit played in this segment. */
  readonly first: number;
  /** Unit the segment stopped before (exclusive); null while it is open. */
  end: number | null;
}

export class Timeline {
  /** Bumped on every change, for caches derived from the segments. */
  version = 0;
  private readonly list: TimelineSegment[] = [];

  constructor(readonly unitS: number) {}

  get segments(): readonly TimelineSegment[] {
    return this.list;
  }

  /** The segment being played (or counted in), or null. */
  get open(): TimelineSegment | null {
    const last = this.list.at(-1);
    return last && last.end === null ? last : null;
  }

  /** Where the next segment starts: the last closed segment's end (0 before any; the open one's first unit). */
  get nextUnit(): number {
    const last = this.list.at(-1);
    return last ? (last.end ?? last.first) : 0;
  }

  begin(grid: number, first: number): void {
    if (this.open) throw new Error('Timeline: a segment is already open');
    if (first < this.nextUnit) throw new Error('Timeline: segments must not overlap');
    this.list.push({ grid, first, end: null });
    this.version++;
  }

  /** Closes the open segment before unit `end`; a segment left without any unit is removed. */
  close(end: number): void {
    const open = this.open;
    if (!open) return;
    if (end <= open.first) this.list.pop();
    else open.end = end;
    this.version++;
  }

  /** Drops the open segment (paused before its first downbeat: nothing of it was played). */
  discardOpen(): void {
    if (!this.open) return;
    this.list.pop();
    this.version++;
  }

  /**
   * Audio-clock start of a unit: in the segment that plays it, else the end time of a segment that stopped right
   * before it (the scheduled end of a take = start(total)); null when no segment reaches it.
   */
  start(unit: number): number | null {
    const segment = this.playing(unit) ?? this.list.find((s) => s.end === unit);
    return segment ? segment.grid + (unit - segment.first) * this.unitS : null;
  }

  private playing(unit: number): TimelineSegment | undefined {
    return this.list.find((s) => unit >= s.first && (s.end === null || unit < s.end));
  }

  /** Fractional unit at audio-clock time `t` (e.g. 3.5 = half way through unit 3); null in gaps and count-ins. */
  position(t: number): number | null {
    for (const s of this.list) {
      if (t < s.grid) continue;
      const at = s.first + (t - s.grid) / this.unitS;
      if (s.end === null || at < s.end) return at;
    }
    return null;
  }

  /** Downbeats of units 0..count−1, up to the first unit no segment has played. */
  starts(count: number): number[] {
    const out: number[] = [];
    for (let u = 0; u < count; u++) {
      const segment = this.playing(u);
      if (!segment) break;
      out.push(segment.grid + (u - segment.first) * this.unitS);
    }
    return out;
  }
}
