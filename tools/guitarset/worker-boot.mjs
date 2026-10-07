// Worker bootstrap: registers the tsx loader inside the worker thread, then loads the TS worker.
import { register } from 'tsx/esm/api';

register();
await import('./worker.ts');
