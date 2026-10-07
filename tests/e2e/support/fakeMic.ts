/**
 * Fake microphone harness injected with page.addInitScript (SPEC §14.5).
 *
 * - Wraps the AudioContext constructor to capture the app's context, then makes getUserMedia return a
 *   MediaStreamAudioDestinationNode stream from the *same* context, so tests control timing on one clock.
 * - __fakeMic.play(url, { at }) schedules a WAV into that destination at a context time.
 * - Optional loopback: anything the app connects to ctx.destination is also routed through a DelayNode
 *   back into the fake mic (used by RTT calibration tests).
 *
 * This function is serialized into the page; it must be self-contained (no imports, no closures).
 */
export interface FakeMicConfig {
  loopbackDelayMs: number | null;
  deny: boolean;
}

export interface FakeMicApi {
  play(url: string, options?: { at?: number; gain?: number }): Promise<number>;
  setLoopback(delayMs: number | null): void;
  readonly constraints: unknown[];
  readonly contextTime: number | null;
}

export function installFakeMic(config: FakeMicConfig): void {
  type Win = Window & { __fakeMic?: FakeMicApi; webkitAudioContext?: typeof AudioContext };
  const win = window as Win;
  const state: {
    ctx: AudioContext | null;
    dest: MediaStreamAudioDestinationNode | null;
    loopbackDelayMs: number | null;
    constraints: unknown[];
  } = { ctx: null, dest: null, loopbackDelayMs: config.loopbackDelayMs, constraints: [] };

  const NativeAudioContext = window.AudioContext;
  class FakeMicAudioContext extends NativeAudioContext {
    constructor(options?: AudioContextOptions) {
      super(options);
      state.ctx = this;
      state.dest = this.createMediaStreamDestination();
    }
  }
  window.AudioContext = FakeMicAudioContext;
  win.webkitAudioContext = FakeMicAudioContext;

  const nativeConnect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
  AudioNode.prototype.connect = function patchedConnect(this: AudioNode, ...args: unknown[]) {
    const result = nativeConnect.apply(this, args);
    const target = args[0];
    if (state.loopbackDelayMs !== null && state.dest && target === this.context.destination) {
      const delay = this.context.createDelay(2);
      delay.delayTime.value = state.loopbackDelayMs / 1000;
      nativeConnect.call(this, delay);
      nativeConnect.call(delay, state.dest);
    }
    return result;
  } as typeof AudioNode.prototype.connect;

  const mediaDevices = navigator.mediaDevices;
  mediaDevices.getUserMedia = async (constraints?: MediaStreamConstraints) => {
    state.constraints.push(JSON.parse(JSON.stringify(constraints ?? null)));
    if (config.deny) throw new DOMException('Permission denied', 'NotAllowedError');
    if (!state.dest)
      throw new DOMException('fake mic: AudioContext must exist before getUserMedia', 'InvalidStateError');
    // A destination track is labelled "MediaStreamAudioDestinationNode"; give it the fake device's label so
    // the app sees the same name in getSettings diagnostics and enumerateDevices.
    for (const track of state.dest.stream.getAudioTracks()) {
      Object.defineProperty(track, 'label', { value: 'MacBook Pro Microphone (fake)', configurable: true });
    }
    return state.dest.stream;
  };
  mediaDevices.enumerateDevices = async () =>
    [
      { deviceId: 'fake-builtin', groupId: 'g1', kind: 'audioinput', label: 'MacBook Pro Microphone (fake)' },
      { deviceId: 'fake-speaker', groupId: 'g1', kind: 'audiooutput', label: 'MacBook Pro Speakers (fake)' },
    ].map((d) => ({ ...d, toJSON: () => d })) as MediaDeviceInfo[];

  const api: FakeMicApi = {
    async play(url, options = {}) {
      const ctx = state.ctx;
      const dest = state.dest;
      if (!ctx || !dest) throw new Error('fake mic: no AudioContext yet');
      const response = await fetch(url);
      const audio = await ctx.decodeAudioData(await response.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = audio;
      const gain = ctx.createGain();
      gain.gain.value = options.gain ?? 1;
      source.connect(gain);
      gain.connect(dest);
      const at = options.at ?? ctx.currentTime + 0.05;
      source.start(at);
      return at;
    },
    setLoopback(delayMs) {
      state.loopbackDelayMs = delayMs;
    },
    get constraints() {
      return state.constraints;
    },
    get contextTime() {
      return state.ctx?.currentTime ?? null;
    },
  };
  win.__fakeMic = api;
}

/** Plays a generated fixture into the fake mic now (or at a context time) and returns the start time. */
export async function playFixture(
  page: import('@playwright/test').Page,
  name: string,
  at?: number,
): Promise<number> {
  return page.evaluate(
    ([url, when]) =>
      (window as unknown as { __fakeMic: FakeMicApi }).__fakeMic.play(
        url as string,
        when === null ? {} : { at: when as number },
      ),
    [`/fixtures/${name}`, at ?? null] as const,
  );
}
