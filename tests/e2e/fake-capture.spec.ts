import { expect, test } from '@playwright/test';

test('M0 spike: real getUserMedia path with --use-file-for-fake-audio-capture', async ({ page }) => {
  await page.goto('/#/settings/diagnostics');
  await page.getByRole('button', { name: '마이크 켜기' }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __gh_test: { levelRms: number | null } }).__gh_test.levelRms,
        ),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0.05);
});
