import { describe, expect, it } from 'vitest';
import { testContext } from '../testing/fakes';
import { type SongParamsInput, SongRunner } from './runner';

const params: SongParamsInput = {
  songId: 's01',
  mode: 'perform',
  bpm: 60,
  chartHidden: false,
  loopSection: null,
};

/** Same length as the real listen render: one strum per beat plus a 1.5 s ring-out (silent here). */
const listenOfRealLength = (chords: readonly string[], bpm: number, beats: number) =>
  new Float32Array(Math.round((chords.length * beats * (60 / bpm) + 1.5) * 48000));

describe('S "들어 보기" vs the metronome', () => {
  it('the listen audio leaking into the microphone does not start the count-in off the beat', () => {
    const t = testContext();
    const runner = new SongRunner(t.ctx, params, listenOfRealLength);
    runner.start();
    expect(runner.snapshot().phase).toBe('armed');
    runner.command('mark');
    // A synthesized strum a few bars in reaches the microphone through the speakers.
    t.mic.coarse.emit(t.clock.audio() + 9.0);
    expect(runner.snapshot().phase).toBe('armed');
  });

  it('after the listen has ended, the first strum still starts the count-in', () => {
    const t = testContext();
    const runner = new SongRunner(t.ctx, params, listenOfRealLength);
    runner.start();
    runner.command('mark');
    const listenS = 8 * 4 + 1.5;
    t.mic.coarse.emit(t.clock.audio() + listenS + 0.5);
    expect(runner.snapshot().phase).toBe('countIn');
  });

  it('starting the song stops a listen that is still playing', () => {
    const t = testContext();
    const runner = new SongRunner(t.ctx, params, listenOfRealLength);
    runner.start();
    runner.command('mark');
    runner.command('toggle');
    expect(runner.snapshot().phase).toBe('countIn');
    expect(t.output.stoppedPlays).toContain(0);
  });

  it('pressing M again replaces the playing listen instead of layering a second one', () => {
    const t = testContext();
    const runner = new SongRunner(t.ctx, params, listenOfRealLength);
    runner.start();
    runner.command('mark');
    runner.command('mark');
    expect(t.output.played).toHaveLength(2);
    expect(t.output.stoppedPlays).toEqual([0]);
  });
});
