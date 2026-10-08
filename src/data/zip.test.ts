import { describe, expect, it } from 'vitest';
import { listZip, readEntry } from '../../tools/guitarset/unzip';
import { crc32, createZip } from './zip';

describe('store-method zip writer', () => {
  it('crc32 matches the reference value', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  it('round-trips through an independent reader (UTF-8 names, binary data)', () => {
    const wav = new Uint8Array(1000).map((_, i) => (i * 37) % 256);
    const labels = new TextEncoder().encode(JSON.stringify({ label: '깨끗한 스트럼' }));
    const zip = Buffer.from(
      createZip([
        { name: 'clip-1.wav', data: wav },
        { name: 'labels.json', data: labels },
      ]),
    );
    const entries = listZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['clip-1.wav', 'labels.json']);
    expect([...readEntry(zip, entries[0]!)]).toEqual([...wav]);
    expect(JSON.parse(readEntry(zip, entries[1]!).toString('utf8'))).toEqual({ label: '깨끗한 스트럼' });
  });
});
