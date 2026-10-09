import { expect, type Page } from '@playwright/test';
import { playFixture } from './fakeMic';

const next = (page: Page) => page.getByRole('button', { name: '다음', exact: true }).click();

/**
 * Runs the first-run onboarding with the fake mic's loopback on (tuning skipped) and saves the Calibration, so
 * the RTT is measured end to end through the same browser path the app's own playback takes — as on a real
 * device (a seeded RTT would miss the browser's buffering). Returns the measured RTT in ms.
 */
export async function calibrateThroughOnboarding(page: Page): Promise<number> {
  await page.goto('/');
  await expect(page).toHaveURL(/#\/onboarding$/);
  await page.getByRole('button', { name: '마이크 허용' }).click();
  await expect(page.getByTestId('onboarding-device')).toBeVisible();
  await next(page);
  await page.getByRole('button', { name: '소음 측정' }).click();
  await expect(page.getByTestId('noise-result')).toBeVisible({ timeout: 15_000 });
  await next(page);
  await page.getByTestId('tuning-skip').click();
  for (const stringNo of [6, 5, 4, 3, 2, 1]) {
    await expect(page.getByTestId('template-target')).toHaveAttribute('data-string', String(stringNo));
    const done = page.getByTestId(`template-string-${stringNo}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      await playFixture(page, `open3-${stringNo}.wav`);
      try {
        await expect(done).toHaveAttribute('data-done', 'true', { timeout: 6_000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  }
  await expect(page.getByTestId('templates-done')).toBeVisible();
  await next(page);
  await page.getByRole('button', { name: '지연 측정' }).click();
  const result = page.getByTestId('rtt-result');
  await expect(result).toHaveAttribute('data-run', '1', { timeout: 30_000 });
  expect(await result.getAttribute('data-method')).toBe('loopback');
  const rttMs = Number(await result.getAttribute('data-rtt-ms'));
  await next(page);
  await page.getByRole('button', { name: '저장하고 시작하기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  return rttMs;
}
