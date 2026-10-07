import { expect, test } from '@playwright/test';
import { installFakeMic } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';

test('M0 spike: fake mic WAV is observed as worklet RMS', async ({ page }) => {
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/#/settings/diagnostics');
  await page.getByRole('button', { name: '마이크 켜기' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { contextTime: number | null } }).__gh_test.contextTime,
      ),
    )
    .not.toBeNull();
  await page.evaluate(() =>
    (window as unknown as { __fakeMic: { play(url: string): Promise<number> } }).__fakeMic.play(
      '/fixtures/spike-sine-440.wav',
    ),
  );
  // 0.25-amplitude sine -> RMS ~0.177 (-15 dBFS).
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __gh_test: { levelRms: number | null } }).__gh_test.levelRms,
        ),
      {
        timeout: 10_000,
      },
    )
    .toBeGreaterThan(0.1);
});
