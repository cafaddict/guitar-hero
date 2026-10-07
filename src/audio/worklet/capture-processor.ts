/**
 * AudioWorklet capture processor (M0 spike version: level metering only).
 * Runs on the audio render thread; must not allocate in process().
 */

const LEVEL_INTERVAL_S = 1 / 30;

class CaptureProcessor extends AudioWorkletProcessor {
  private sumSquares = 0;
  private peak = 0;
  private count = 0;
  private readonly levelEvery = Math.max(128, Math.round(sampleRate * LEVEL_INTERVAL_S));

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      const x = channel[i]!;
      this.sumSquares += x * x;
      const a = x < 0 ? -x : x;
      if (a > this.peak) this.peak = a;
    }
    this.count += channel.length;
    if (this.count >= this.levelEvery) {
      const rms = Math.sqrt(this.sumSquares / this.count);
      this.port.postMessage({ type: 'level', rms, peak: this.peak, time: currentTime });
      this.sumSquares = 0;
      this.peak = 0;
      this.count = 0;
    }
    return true;
  }
}

registerProcessor('gh-capture', CaptureProcessor);
