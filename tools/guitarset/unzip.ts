/**
 * Minimal ZIP extractor (stored + deflate entries, ZIP64 sizes) so the GuitarSet pipeline has no
 * native/GPL dependencies. Reads the central directory, inflates each entry and writes it under `dest`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, sep } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const ZIP64_EOCD_LOCATOR = 0x07064b50;

function findEocd(buf: Buffer): number {
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--)
    if (buf.readUInt32LE(i) === EOCD) return i;
  throw new Error('zip: end of central directory not found');
}

export interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

export function listZip(buf: Buffer): ZipEntry[] {
  const eocd = findEocd(buf);
  let count = buf.readUInt16LE(eocd + 10);
  let cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) {
    const locator = eocd - 20;
    if (buf.readUInt32LE(locator) !== ZIP64_EOCD_LOCATOR) throw new Error('zip: ZIP64 locator missing');
    const z64 = Number(buf.readBigUInt64LE(locator + 8));
    count = Number(buf.readBigUInt64LE(z64 + 32));
    cdOffset = Number(buf.readBigUInt64LE(z64 + 48));
  }
  const entries: ZipEntry[] = [];
  let p = cdOffset;
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== CENTRAL) throw new Error('zip: bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    let compressedSize = buf.readUInt32LE(p + 20);
    let size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    let localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    // ZIP64 extra field (0x0001) carries 64-bit values in a fixed order for the saturated fields.
    let e = p + 46 + nameLen;
    const extraEnd = e + extraLen;
    while (e + 4 <= extraEnd) {
      const id = buf.readUInt16LE(e);
      const len = buf.readUInt16LE(e + 2);
      if (id === 0x0001) {
        let q = e + 4;
        if (size === 0xffffffff) {
          size = Number(buf.readBigUInt64LE(q));
          q += 8;
        }
        if (compressedSize === 0xffffffff) {
          compressedSize = Number(buf.readBigUInt64LE(q));
          q += 8;
        }
        if (localOffset === 0xffffffff) localOffset = Number(buf.readBigUInt64LE(q));
      }
      e += 4 + len;
    }
    entries.push({ name, method, compressedSize, size, localOffset });
    p = extraEnd + commentLen;
  }
  return entries;
}

export function readEntry(buf: Buffer, entry: ZipEntry): Buffer {
  const p = entry.localOffset;
  if (buf.readUInt32LE(p) !== LOCAL) throw new Error(`zip: bad local header for ${entry.name}`);
  const nameLen = buf.readUInt16LE(p + 26);
  const extraLen = buf.readUInt16LE(p + 28);
  const start = p + 30 + nameLen + extraLen;
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return Buffer.from(data);
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`zip: unsupported method ${entry.method} for ${entry.name}`);
}

export async function extractZip(buf: Buffer, dest: string): Promise<number> {
  mkdirSync(dest, { recursive: true });
  let written = 0;
  for (const entry of listZip(buf)) {
    if (entry.name.endsWith('/') || entry.name.startsWith('__MACOSX')) continue;
    const target = normalize(join(dest, entry.name));
    if (!target.startsWith(normalize(dest) + sep))
      throw new Error(`zip: entry escapes destination: ${entry.name}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readEntry(buf, entry));
    written++;
  }
  return written;
}
