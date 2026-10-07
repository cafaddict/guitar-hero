import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Headers declared for every path in public/_headers (the Cloudflare/Netlify format). */
export function declaredHeaders(): Record<string, string> {
  const text = readFileSync(join(import.meta.dirname, '..', '..', '..', 'public', '_headers'), 'utf8');
  const headers: Record<string, string> = {};
  let inAll = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    if (!line.startsWith(' ')) {
      inAll = line.trim() === '/*';
      continue;
    }
    if (!inAll) continue;
    const i = line.indexOf(':');
    headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return headers;
}
