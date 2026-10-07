/**
 * Zod 4 compiles object parsers with `new Function` unless told not to; under the app's strict CSP
 * (`script-src 'self'`, no 'unsafe-eval') even its feature probe is a violation. Imported first by every
 * entry point (app and DSP worker).
 */
import { z } from 'zod';

z.config({ jitless: true });
