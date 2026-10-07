/**
 * Minimal RIFF/WAVE reader and writer (pure, no DOM).
 *
 * Supports PCM 16/24/32-bit integer and IEEE float 32-bit, including WAVE_FORMAT_EXTENSIBLE headers.
 * Used by the fixture generator, the benchmarks (GuitarSet is 16/24-bit PCM) and the recording kit.
 */

export type WavEncoding = 'pcm16' | 'float32';

export interface DecodedWav {
  sampleRate: number;
  /** One Float32Array per channel, samples in [-1, 1]. */
  channels: Float32Array[];
}

const FORMAT_PCM = 1;
const FORMAT_FLOAT = 3;
const FORMAT_EXTENSIBLE = 0xfffe;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function readAscii(view: DataView, offset: number, length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += String.fromCharCode(view.getUint8(offset + i));
  return out;
}

/** Encodes one or more equally long channels into a WAV byte array. */
export function encodeWav(
  input: Float32Array | readonly Float32Array[],
  sampleRate: number,
  encoding: WavEncoding = 'pcm16',
): Uint8Array {
  const channels = input instanceof Float32Array ? [input] : input;
  const numChannels = channels.length;
  if (numChannels === 0) throw new Error('encodeWav: no channels');
  const frames = channels[0]!.length;
  for (const ch of channels) if (ch.length !== frames) throw new Error('encodeWav: channel length mismatch');

  const bytesPerSample = encoding === 'pcm16' ? 2 : 4;
  const dataBytes = frames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, encoding === 'pcm16' ? FORMAT_PCM : FORMAT_FLOAT, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = channels[c]![i]!;
      if (encoding === 'pcm16') {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(
          offset,
          clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff),
          true,
        );
      } else {
        view.setFloat32(offset, sample, true);
      }
      offset += bytesPerSample;
    }
  }
  return new Uint8Array(buffer);
}

interface FmtChunk {
  format: number;
  numChannels: number;
  sampleRate: number;
  bitsPerSample: number;
}

function parseFmt(view: DataView, offset: number, size: number): FmtChunk {
  let format = view.getUint16(offset, true);
  const numChannels = view.getUint16(offset + 2, true);
  const sampleRate = view.getUint32(offset + 4, true);
  const bitsPerSample = view.getUint16(offset + 14, true);
  if (format === FORMAT_EXTENSIBLE && size >= 26) {
    // SubFormat GUID starts at offset 24; its first two bytes are the actual format code.
    format = view.getUint16(offset + 24, true);
  }
  return { format, numChannels, sampleRate, bitsPerSample };
}

function sampleReader(fmt: FmtChunk, view: DataView): (byteOffset: number) => number {
  if (fmt.format === FORMAT_FLOAT && fmt.bitsPerSample === 32) return (o) => view.getFloat32(o, true);
  if (fmt.format === FORMAT_FLOAT && fmt.bitsPerSample === 64) return (o) => view.getFloat64(o, true);
  if (fmt.format === FORMAT_PCM) {
    switch (fmt.bitsPerSample) {
      case 8:
        return (o) => (view.getUint8(o) - 128) / 128;
      case 16:
        return (o) => view.getInt16(o, true) / 0x8000;
      case 24:
        return (o) => {
          const v = view.getUint8(o) | (view.getUint8(o + 1) << 8) | (view.getInt8(o + 2) << 16);
          return v / 0x800000;
        };
      case 32:
        return (o) => view.getInt32(o, true) / 0x80000000;
    }
  }
  throw new Error(`decodeWav: unsupported format ${fmt.format}/${fmt.bitsPerSample}`);
}

/** Decodes a WAV byte array into float channels. */
export function decodeWav(bytes: Uint8Array): DecodedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('decodeWav: not a RIFF/WAVE file');
  }
  let fmt: FmtChunk | undefined;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (id === 'fmt ') {
      fmt = parseFmt(view, body, size);
    } else if (id === 'data') {
      if (!fmt) throw new Error('decodeWav: data chunk before fmt chunk');
      const bytesPerSample = fmt.bitsPerSample / 8;
      const available = Math.min(size, view.byteLength - body);
      const frames = Math.floor(available / (bytesPerSample * fmt.numChannels));
      const read = sampleReader(fmt, view);
      const channels = Array.from({ length: fmt.numChannels }, () => new Float32Array(frames));
      let p = body;
      for (let i = 0; i < frames; i++) {
        for (let c = 0; c < fmt.numChannels; c++) {
          channels[c]![i] = read(p);
          p += bytesPerSample;
        }
      }
      return { sampleRate: fmt.sampleRate, channels };
    }
    offset = body + size + (size % 2);
  }
  throw new Error('decodeWav: no data chunk');
}

/** Averages all channels into one mono signal. */
export function toMono(decoded: DecodedWav): Float32Array {
  const [first, ...rest] = decoded.channels;
  if (!first) return new Float32Array(0);
  if (rest.length === 0) return first;
  const out = new Float32Array(first.length);
  const scale = 1 / decoded.channels.length;
  for (const ch of decoded.channels) for (let i = 0; i < out.length; i++) out[i] = out[i]! + ch[i]! * scale;
  return out;
}
