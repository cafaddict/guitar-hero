/**
 * App icons (SPEC §15): one simple shape list (a chord diagram) rendered to SVG and to PNG (192, 512, maskable
 * 512 with the content inside the 80 % safe zone). Dependency-free: analytic shapes, 4×4 supersampling,
 * PNG written with node:zlib. Usage: npx tsx tools/icons/generate.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

type Rgb = [number, number, number];
type Shape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number; color: Rgb }
  | { kind: 'circle'; cx: number; cy: number; r: number; color: Rgb };

// The dark theme's warm amp palette (D-087): --bg, --muted, a dimmed fret line, --accent.
const BG: Rgb = [21, 17, 14];
const STRING: Rgb = [205, 191, 175];
const FRET: Rgb = [122, 106, 92];
const DOT: Rgb = [245, 158, 11];
const hex = (c: Rgb) => `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

/** Chord-diagram mark in a 512 × 512 design space. */
function mark(): Shape[] {
  const shapes: Shape[] = [];
  const left = 136;
  const top = 120;
  const fretGap = 70;
  for (let k = 0; k <= 4; k++)
    shapes.push({
      kind: 'rect',
      x: left - 4,
      y: top + k * fretGap - (k === 0 ? 10 : 3),
      w: 248,
      h: k === 0 ? 20 : 6,
      r: 2,
      color: FRET,
    });
  for (let i = 0; i < 6; i++)
    shapes.push({ kind: 'rect', x: left + i * 48 - 4, y: top, w: 8, h: 280, r: 3, color: STRING });
  const dot = (string: number, fret: number) => ({
    kind: 'circle' as const,
    cx: left + string * 48,
    cy: top + (fret - 0.5) * fretGap,
    r: 24,
    color: DOT,
  });
  shapes.push(dot(1, 3), dot(2, 2), dot(4, 1));
  return shapes;
}

function scaled(shapes: Shape[], s: number): Shape[] {
  const c = 256;
  return shapes.map((sh) =>
    sh.kind === 'rect'
      ? { ...sh, x: c + (sh.x - c) * s, y: c + (sh.y - c) * s, w: sh.w * s, h: sh.h * s, r: sh.r * s }
      : { ...sh, cx: c + (sh.cx - c) * s, cy: c + (sh.cy - c) * s, r: sh.r * s },
  );
}

function design(maskable: boolean): Shape[] {
  const background: Shape = { kind: 'rect', x: 0, y: 0, w: 512, h: 512, r: maskable ? 0 : 96, color: BG };
  return [background, ...scaled(mark(), maskable ? 0.8 : 1)];
}

function inside(shape: Shape, x: number, y: number): boolean {
  if (shape.kind === 'circle') return (x - shape.cx) ** 2 + (y - shape.cy) ** 2 <= shape.r ** 2;
  if (x < shape.x || y < shape.y || x > shape.x + shape.w || y > shape.y + shape.h) return false;
  const r = shape.r;
  const cx = Math.min(Math.max(x, shape.x + r), shape.x + shape.w - r);
  const cy = Math.min(Math.max(y, shape.y + r), shape.y + shape.h - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(shapes: Shape[], size: number): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  const ss = 4;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const dx = ((x + (sx + 0.5) / ss) * 512) / size;
          const dy = ((y + (sy + 0.5) / ss) * 512) / size;
          let color: Rgb | null = null;
          for (const shape of shapes) if (inside(shape, dx, dy)) color = shape.color;
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a++;
          }
        }
      const o = (y * size + x) * 4;
      const n = ss * ss;
      px[o] = a ? Math.round(r / a) : 0;
      px[o + 1] = a ? Math.round(g / a) : 0;
      px[o + 2] = a ? Math.round(b / a) : 0;
      px[o + 3] = Math.round((255 * a) / n);
    }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of data) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(new Uint8Array([...Buffer.from(type, 'ascii'), ...data])), 0);
  return Buffer.concat([head, Buffer.from(data), crc]);
}

export function encodePng(rgba: Uint8Array, size: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ]);
}

export function toSvg(shapes: Shape[]): string {
  const body = shapes
    .map((s) =>
      s.kind === 'rect'
        ? `<rect x="${s.x.toFixed(1)}" y="${s.y.toFixed(1)}" width="${s.w.toFixed(1)}" height="${s.h.toFixed(1)}" rx="${s.r.toFixed(1)}" fill="${hex(s.color)}"/>`
        : `<circle cx="${s.cx.toFixed(1)}" cy="${s.cy.toFixed(1)}" r="${s.r.toFixed(1)}" fill="${hex(s.color)}"/>`,
    )
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>\n`;
}

function main(): void {
  const out = join(import.meta.dirname, '..', '..', 'public');
  writeFileSync(join(out, 'icon.svg'), toSvg(design(false)));
  writeFileSync(join(out, 'icon-maskable.svg'), toSvg(design(true)));
  writeFileSync(join(out, 'icon-192.png'), encodePng(render(design(false), 192), 192));
  writeFileSync(join(out, 'icon-512.png'), encodePng(render(design(false), 512), 512));
  writeFileSync(join(out, 'icon-maskable-512.png'), encodePng(render(design(true), 512), 512));
  writeFileSync(join(out, 'apple-touch-icon.png'), encodePng(render(design(true), 180), 180));
  console.log(`icons written to ${out}`);
}

if (process.argv[1]?.endsWith('generate.ts')) main();
