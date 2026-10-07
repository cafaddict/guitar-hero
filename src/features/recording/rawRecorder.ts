/**
 * Long recordings from the capture ring (4 s): consecutive 2 s 'raw' ranges are requested ahead of time and
 * concatenated in order, so clips of any length come out sample-contiguous on the capture clock. A range that
 * left the ring before it was read (timers throttled for seconds) or never arrived makes the take incomplete:
 * `stop()` rejects rather than saving a fixture with silent holes under valid labels.
 */
import type { AudioEngine, RangeOutcome } from '../../audio/engine';

const CHUNK_S = 2;
const KEEP_AHEAD_S = 2.5;

export class IncompleteRecordingError extends Error {
  constructor() {
    super('recording has gaps (capture ranges were lost)');
    this.name = 'IncompleteRecordingError';
  }
}

/** The chunk's samples when every one of them came from the ring, else null. */
function completeChunk(outcome: RangeOutcome): Float32Array | null {
  const copied = (outcome.result as { copied?: unknown } | null)?.copied;
  return outcome.samples && copied === outcome.samples.length ? outcome.samples : null;
}

export class RawRecorder {
  private readonly chunks: (Float32Array | null)[] = [];
  private readonly pending: Promise<void>[] = [];
  private startTime = 0;
  private nextFrom = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly engine: AudioEngine) {}

  /** Starts now; returns the context time of the first recorded sample. */
  start(): number {
    const now = this.engine.context?.currentTime ?? 0;
    this.startTime = now + 0.05;
    this.nextFrom = this.startTime;
    this.fill();
    this.timer = setInterval(() => this.fill(), 250);
    return this.startTime;
  }

  private fill(): void {
    const now = this.engine.context?.currentTime ?? 0;
    while (this.nextFrom < now + KEEP_AHEAD_S) {
      const index = this.chunks.length;
      const from = this.nextFrom;
      this.nextFrom = from + CHUNK_S;
      this.chunks.push(null);
      this.pending.push(
        this.engine.analyzeRange(from, from + CHUNK_S, { kind: 'raw' }).then(
          (outcome) => {
            this.chunks[index] = completeChunk(outcome);
          },
          () => {
            this.chunks[index] = null;
          },
        ),
      );
    }
  }

  /** Stops at the current time and resolves with the recorded samples (rejects with a gap). */
  async stop(): Promise<Float32Array> {
    const stopTime = this.engine.context?.currentTime ?? this.startTime;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    await Promise.all(this.pending);
    const length = Math.max(0, Math.round((stopTime - this.startTime) * this.engine.sampleRate));
    const out = new Float32Array(length);
    let pos = 0;
    for (const chunk of this.chunks) {
      if (pos >= length) break;
      if (!chunk) throw new IncompleteRecordingError();
      out.set(chunk.subarray(0, Math.min(chunk.length, length - pos)), pos);
      pos += chunk.length;
    }
    if (pos < length) throw new IncompleteRecordingError();
    return out;
  }

  cancel(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }
}
