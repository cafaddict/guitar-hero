/**
 * Metronome click (SPEC §8.4): short (≤ 15 ms) synthetic tone in the 2–4 kHz band. The accent uses a
 * different pitch. Shared by the app metronome and the benchmark's click-bleed model.
 */
export const CLICK_HZ = 3000;
export const ACCENT_CLICK_HZ = 3800;
export const CLICK_DURATION_MS = 12;

export function renderClick(sampleRate: number, accent: boolean): Float32Array {
  const n = Math.round((CLICK_DURATION_MS / 1000) * sampleRate);
  const out = new Float32Array(n);
  const f = accent ? ACCENT_CLICK_HZ : CLICK_HZ;
  const attack = Math.round(0.0008 * sampleRate);
  for (let i = 0; i < n; i++) {
    const env = (i < attack ? i / attack : 1) * Math.exp(-i / (0.0025 * sampleRate));
    out[i] = env * Math.sin((2 * Math.PI * f * i) / sampleRate);
  }
  return out;
}
