/**
 * SPEC v1.1 §14.6-11 / §14.0: the v1.1 contract keeps every v1 threshold. Every key path of
 * docs/goal/thresholds.json (except `version` and `$comment`) exists in docs/goal/v1.1/thresholds.json with the
 * same value; arrays may grow (the v1.1 array must contain every v1 element), nothing may be relaxed.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROOT } from './source-scan';

const V1_PATH = join(ROOT, 'docs/goal/thresholds.json');
const V11_PATH = join(ROOT, 'docs/goal/v1.1/thresholds.json');
const IGNORED_KEYS = new Set(['version', '$comment']);

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isObject(value: Json | undefined): value is { [key: string]: Json } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Paths (with a reason) where `next` does not keep `base`: a missing key, a changed value, a dropped element. */
function contractViolations(base: Json, next: Json | undefined, path = '$'): string[] {
  if (isObject(base)) {
    if (!isObject(next)) return [`${path}: object missing`];
    return Object.keys(base)
      .filter((key) => !(path === '$' && IGNORED_KEYS.has(key)))
      .flatMap((key) => contractViolations(base[key]!, next[key], `${path}.${key}`));
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(next)) return [`${path}: array missing`];
    const kept = (item: Json) => next.some((candidate) => contractViolations(item, candidate).length === 0);
    return base.flatMap((item, i) =>
      kept(item) ? [] : [`${path}[${i}]: element ${JSON.stringify(item)} dropped`],
    );
  }
  return Object.is(base, next) ? [] : [`${path}: ${JSON.stringify(base)} → ${JSON.stringify(next)}`];
}

describe('§14.6-11 v1 contract ⊆ v1.1 contract', () => {
  const v1 = JSON.parse(readFileSync(V1_PATH, 'utf8')) as Json;
  const v11 = JSON.parse(readFileSync(V11_PATH, 'utf8')) as Json;

  it('every v1 key path is in the v1.1 file with the same value (arrays may only grow)', () => {
    expect(contractViolations(v1, v11)).toEqual([]);
  });

  it('the check catches a relaxed value, a missing key and a dropped array element (self-test)', () => {
    const base: Json = { version: '1', a: { min: 0.9, list: [1, 2] }, b: 'x' };
    expect(contractViolations(base, { version: '2', a: { min: 0.9, list: [2, 1, 3] }, b: 'x' })).toEqual([]);
    expect(contractViolations(base, { a: { min: 0.85, list: [1, 2] }, b: 'x' })).toEqual([
      '$.a.min: 0.9 → 0.85',
    ]);
    expect(contractViolations(base, { a: { list: [1, 2] }, b: 'x' })).toEqual(['$.a.min: 0.9 → undefined']);
    expect(contractViolations(base, { a: { min: 0.9, list: [1] }, b: 'x' })).toEqual([
      '$.a.list[1]: element 2 dropped',
    ]);
  });
});
