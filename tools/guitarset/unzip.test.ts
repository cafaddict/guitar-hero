import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { extractZip, listZip, readEntry } from './unzip';

/** Builds a tiny ZIP (one stored + one deflated entry) by hand. */
function makeZip(entries: { name: string; data: Buffer; deflate: boolean }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const body = e.deflate ? deflateRawSync(e.data) : e.data;
    const name = Buffer.from(e.name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(e.deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(e.deflate ? 8 : 0, 10);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

describe('unzip', () => {
  const zip = makeZip([
    { name: 'a/one.txt', data: Buffer.from('hello'), deflate: false },
    { name: 'a/two.jams', data: Buffer.from('{"x":'.repeat(50)), deflate: true },
  ]);

  it('lists and reads stored and deflated entries', () => {
    const entries = listZip(zip);
    expect(entries.map((e) => e.name)).toEqual(['a/one.txt', 'a/two.jams']);
    expect(readEntry(zip, entries[0]!).toString()).toBe('hello');
    expect(readEntry(zip, entries[1]!).toString()).toBe('{"x":'.repeat(50));
  });

  it('extracts into a directory and refuses path escapes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gh-unzip-'));
    try {
      expect(await extractZip(zip, dir)).toBe(2);
      expect(readFileSync(join(dir, 'a', 'one.txt'), 'utf8')).toBe('hello');
      const evil = makeZip([{ name: '../evil.txt', data: Buffer.from('x'), deflate: false }]);
      await expect(extractZip(evil, dir)).rejects.toThrow(/escapes/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
