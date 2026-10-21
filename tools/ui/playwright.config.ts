import { defineConfig, devices } from '@playwright/test';

/**
 * `npm run ui:shots` (UI goal, docs/goal/ui/SPEC.md §2.6): screenshots of every screen for the visual review.
 * Against a running server when UI_SHOTS_BASE is set, otherwise against its own e2e build on UI_SHOTS_PORT.
 */
const PORT = Number(process.env.UI_SHOTS_PORT ?? 4185);
const BASE = process.env.UI_SHOTS_BASE ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: /shots\.spec\.ts$/,
  timeout: 1_800_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: BASE, serviceWorkers: 'block' },
  projects: [
    {
      name: 'shots',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
  ...(process.env.UI_SHOTS_BASE
    ? {}
    : {
        webServer: {
          // Its own output folder, so a concurrent E2E build (dist-e2e) is not overwritten.
          command: `npx vite build --mode e2e --outDir dist-shots && npx vite preview --outDir dist-shots --port ${PORT} --strictPort`,
          cwd: '../..',
          url: BASE,
          reuseExistingServer: false,
          timeout: 240_000,
        },
      }),
});
