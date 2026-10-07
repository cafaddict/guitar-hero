/**
 * Simulated-time multiplier for exercise timers. Only the E2E build honours the test URL parameter (e.g.
 * 0.25 → four times faster); production builds return 1 and dead-code-eliminate the parameter (E2E-14).
 */
export function simulatedRate(): number {
  if (__GH_E2E__) {
    const query = window.location.hash.split('?')[1] ?? window.location.search.slice(1);
    const scale = Number(new URLSearchParams(query).get('timeScale'));
    if (Number.isFinite(scale) && scale > 0) return 1 / scale;
  }
  return 1;
}
