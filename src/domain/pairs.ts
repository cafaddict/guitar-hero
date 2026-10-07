/**
 * Core change pairs and subject keys (SPEC §6.5, §13.1). Pure.
 */
export const CORE_PAIRS: readonly (readonly [string, string])[] = [
  ['A', 'C'],
  ['A', 'G'],
  ['A', 'E'],
  ['A', 'Em'],
  ['A', 'D'],
  ['A', 'Dm'],
  ['C', 'G'],
  ['C', 'E'],
  ['C', 'D'],
  ['C', 'Dm'],
  ['C', 'Am'],
  ['C', 'Em'],
  ['G', 'E'],
  ['G', 'D'],
  ['G', 'Dm'],
  ['G', 'Am'],
  ['G', 'Em'],
  ['E', 'D'],
  ['E', 'Dm'],
  ['E', 'Am'],
  ['D', 'Am'],
  ['D', 'Em'],
  ['Dm', 'Am'],
  ['Dm', 'Em'],
  ['Am', 'Em'],
];

/** Undirected pair id, sorted: ('C','A') → 'A|C'. Chord classes, not voicing ids ('G', not 'G-3f'). */
export function pairId(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function pairKey(a: string, b: string): string {
  return `pair:${pairId(a, b)}`;
}

/** Directed one-minute-change key: 'pairdir:A>D'. */
export function pairDirKey(from: string, to: string): string {
  return `pairdir:${from}>${to}`;
}

export function parsePairId(id: string): [string, string] {
  const [a, b] = id.split('|');
  if (!a || !b) throw new Error(`bad pair id ${id}`);
  return [a, b];
}

export function parseDirected(dir: string): [string, string] {
  const [a, b] = dir.split('>');
  if (!a || !b) throw new Error(`bad directed pair ${dir}`);
  return [a, b];
}

/** Core pairs whose chords are all in `chordClasses`, as sorted pair ids. */
export function pairsAmong(chordClasses: readonly string[]): string[] {
  const set = new Set(chordClasses);
  return CORE_PAIRS.filter(([a, b]) => set.has(a) && set.has(b)).map(([a, b]) => pairId(a, b));
}
