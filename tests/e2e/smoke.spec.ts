import { expect, test } from '@playwright/test';

test('app shell renders on every project (WebKit included)', async ({ page }) => {
  await page.goto('/');
  // First run: home sends the user to the onboarding wizard.
  await expect(page).toHaveURL(/#\/onboarding$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('처음 설정');
  for (const [path, title] of [
    ['/#/tuner', '튜너'],
    ['/#/metronome', '메트로놈'],
    ['/#/settings/diagnostics', '진단'],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
});
