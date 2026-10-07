import { expect, test } from '@playwright/test';

// The only spec that lets the service worker run (others block it so page.route can serve fixtures).
test.use({ serviceWorkers: 'allow' });

test('E2E-09: after the first visit the app shell and the chord library work offline', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Wait until the service worker is active and has precached the shell, then let it control the page.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('no active service worker');
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), { timeout: 15_000 })
    .toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/#/library');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('코드');
  await expect(page.getByTestId('library-C')).toBeVisible();
  await page.getByTestId('library-C').click();
  await expect(page.getByTestId('expected-notes')).toContainText('C3');
  await context.setOffline(false);
});
