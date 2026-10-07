import { expect, test } from '@playwright/test';

test('app shell renders on every project (WebKit included)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('기타 연습');
});
