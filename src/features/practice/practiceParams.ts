/**
 * Exercise params from a URL query (/practice/E1?voicingId=C&mode=pluck): values are coerced (JSON arrays and
 * objects, numbers, booleans, comma lists; list-typed defaults keep one-element lists) and merged over the
 * plugin defaults; the plugin schema validates and strips keys it does not know.
 */
function coerce(value: string): unknown {
  if (value.startsWith('[') || value.startsWith('{')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value !== '' && Number.isFinite(Number(value))) return Number(value);
  if (value.includes(',')) return value.split(',').map(coerce);
  return value;
}

export function paramsFromQuery(defaults: unknown, query: URLSearchParams): Record<string, unknown> {
  const base =
    typeof defaults === 'object' && defaults !== null ? { ...(defaults as Record<string, unknown>) } : {};
  for (const [key, value] of query) {
    // A list parameter stays a list even with one element (chords=C → ['C']); unknown keys such as
    // test-only ones are dropped later by the plugin schema.
    const current = base[key];
    base[key] =
      Array.isArray(current) && !value.startsWith('[')
        ? value.split(',').filter(Boolean).map(coerce)
        : coerce(value);
  }
  return base;
}
