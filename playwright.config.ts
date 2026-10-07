import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const E2E_PORT = 4173;
const PROD_PORT = 4174;
const fakeCaptureWav = join(import.meta.dirname, 'tests', 'fixtures', 'generated', 'fake-capture.wav');

/** Specs that need the injected fake-mic harness or Chromium-only features. */
const CHROMIUM_ONLY = [/\.mic\.spec\.ts$/, /fake-capture\.spec\.ts$/, /prod-build\.spec\.ts$/];

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 4,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: `http://localhost:${E2E_PORT}`,
    trace: 'retain-on-failure',
    // Service workers would bypass page.route(); only the PWA offline spec re-enables them.
    serviceWorkers: 'block',
  },
  webServer: [
    {
      command: `npm run build:e2e && npx vite preview --outDir dist-e2e --port ${E2E_PORT} --strictPort`,
      url: `http://localhost:${E2E_PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: `npm run build && npx vite preview --outDir dist --port ${PROD_PORT} --strictPort`,
      url: `http://localhost:${PROD_PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
  projects: [
    {
      name: 'chromium-mic',
      testIgnore: [/fake-capture\.spec\.ts$/],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
      },
    },
    {
      name: 'chromium-fake-capture',
      testMatch: [/fake-capture\.spec\.ts$/],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            '--autoplay-policy=no-user-gesture-required',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${fakeCaptureWav}%noloop`,
          ],
        },
      },
    },
    {
      name: 'webkit-ipad',
      testIgnore: CHROMIUM_ONLY,
      use: { ...devices['iPad Pro 11 landscape'], viewport: { width: 1180, height: 820 } },
    },
    {
      name: 'webkit-iphone',
      testIgnore: CHROMIUM_ONLY,
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 } },
    },
  ],
});
