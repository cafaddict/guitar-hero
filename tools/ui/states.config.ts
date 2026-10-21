import { defineConfig, devices } from '@playwright/test';

/**
 * `npx playwright test -c tools/ui/states.config.ts` (UI goal, visual review): screenshots of states the
 * screen list does not reach — practice results, the session runner between runs, its transition, pause and
 * self-report. Against a running server (UI_SHOTS_BASE, required): start one with `vite --mode e2e`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: /states\.spec\.ts$/,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.UI_SHOTS_BASE, serviceWorkers: 'block' },
  projects: [
    {
      name: 'states',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
  ],
});
