/**
 * Dev-server check for the audio bundle (SPEC §8.2, AC-A5): the TypeScript AudioWorklet (which imports the
 * DSP core), the module DSP worker and the metronome ticker worker must all load under `vite` dev, not only
 * in production builds. Starts a dev server, drives Chromium with the fake-mic harness, exits non-zero on
 * failure.  Usage: npx tsx tools/devcheck/audio-dev.ts
 */
import { chromium, type Page } from '@playwright/test';
import { createServer } from 'vite';
import { installFakeMic } from '../../tests/e2e/support/fakeMic';
import { serveFixtures } from '../../tests/e2e/support/fixtures';

const PORT = 5199;

async function check(name: string, run: () => Promise<void>): Promise<boolean> {
  try {
    await run();
    console.log(`PASS  ${name}`);
    return true;
  } catch (error) {
    console.log(`FAIL  ${name}: ${(error as Error).message}`);
    return false;
  }
}

async function levelDb(page: Page): Promise<number> {
  const text = (await page.getByTestId('level-db').textContent()) ?? '';
  const match = /(-?\d+(\.\d+)?) dBFS/.exec(text);
  return match ? Number(match[1]) : Number.NEGATIVE_INFINITY;
}

async function main(): Promise<void> {
  const server = await createServer({ server: { port: PORT, strictPort: true }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const results: boolean[] = [];
  try {
    const page = await browser.newPage();
    await serveFixtures(page);
    // tsx (esbuild keepNames) wraps functions in __name(); serialized into the page that helper must exist.
    await page.addInitScript(() => {
      (globalThis as unknown as { __name: (f: unknown) => unknown }).__name = (f) => f;
    });
    await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
    const base = `http://localhost:${PORT}`;

    results.push(
      await check('capture worklet (TS, imports src/dsp) reports levels in dev', async () => {
        await page.goto(`${base}/#/settings/diagnostics`);
        await page.getByRole('button', { name: '마이크 켜기' }).click();
        await page.waitForTimeout(500);
        await page.evaluate(() =>
          (window as unknown as { __fakeMic: { play(u: string): Promise<number> } }).__fakeMic.play(
            '/fixtures/spike-sine-440.wav',
          ),
        );
        const started = Date.now();
        while ((await levelDb(page)) < -20) {
          if (Date.now() - started > 10_000) throw new Error(`level stayed at ${await levelDb(page)} dBFS`);
          await page.waitForTimeout(100);
        }
      }),
    );

    results.push(
      await check('DSP module worker answers a range analysis in dev (onboarding noise check)', async () => {
        await page.goto(`${base}/#/onboarding`);
        await page.getByRole('button', { name: '마이크 허용' }).click();
        await page.getByRole('button', { name: '다음', exact: true }).click();
        await page.getByRole('button', { name: '소음 측정' }).click();
        await page.getByTestId('noise-result').waitFor({ timeout: 15_000 });
      }),
    );

    results.push(
      await check('metronome ticker worker drives the visual pulse in dev', async () => {
        await page.goto(`${base}/#/metronome`);
        await page.getByTestId('metronome-toggle').click();
        await page
          .locator('[data-testid="metronome-pulse"] [data-active="true"]')
          .first()
          .waitFor({ timeout: 5_000 });
      }),
    );
  } finally {
    await browser.close();
    await server.close();
  }
  const ok = results.every(Boolean);
  console.log(ok ? 'DEV AUDIO CHECK: PASS' : 'DEV AUDIO CHECK: FAIL');
  process.exit(ok ? 0 : 1);
}

void main();
