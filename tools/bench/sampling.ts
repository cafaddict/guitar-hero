/**
 * Stratified sampling helpers: every set value appears equally often; continuous ranges are drawn from
 * n equal strata (so both 10 % tails are always covered), then shuffled.
 */
import { type Rng, shuffled } from '../../src/domain/prng';

export function balanced<T>(values: readonly T[], n: number, rng: Rng): T[] {
  if (values.length === 0) throw new Error('balanced: no values');
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(values[i % values.length]!);
  return shuffled(rng, out);
}

/** Stratified uniform samples in [min, max]; `log` samples log-uniformly (inharmonicity B). */
export function stratified(range: readonly [number, number], n: number, rng: Rng, log = false): number[] {
  const [min, max] = range;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const u = (i + rng()) / n;
    out.push(log ? Math.exp(Math.log(min) + u * (Math.log(max) - Math.log(min))) : min + u * (max - min));
  }
  return shuffled(rng, out);
}

/** ceil(total / parts) */
export function perCondition(total: number, parts: number): number {
  return Math.ceil(total / parts);
}
