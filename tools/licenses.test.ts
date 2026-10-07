import { describe, expect, it } from 'vitest';
import { isLicenseAllowed } from './licenses';

describe('isLicenseAllowed', () => {
  it.each(['MIT', 'ISC', 'Apache-2.0', 'MIT AND ISC', '(MIT OR CC0-1.0)', 'MIT OR GPL-3.0', 'MPL-2.0'])(
    'allows %s',
    (license) => expect(isLicenseAllowed(license)).toBe(true),
  );
  it.each(['GPL-3.0', 'LGPL-2.1', 'AGPL-3.0-only', 'MIT AND GPL-2.0', 'BlueOak-1.0.0', 'UNKNOWN'])(
    'rejects %s',
    (license) => expect(isLicenseAllowed(license)).toBe(false),
  );
});
