import { expect, test } from '@playwright/test';

test('AC-U2: a learned pedal key drives the exercise; Esc asks before stopping', async ({ page }) => {
  // Pedal learning: bind "b" (what a page-turner pedal might send) to next/confirm.
  await page.goto('/#/settings');
  await page.getByTestId('learn-next').click();
  await expect(page.getByTestId('learn-prompt')).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.getByTestId('custom-keys')).toContainText('KeyB');

  // E2 tap counting with the learned key (Enter/pedal = +1 while running, confirm in the review).
  await page.goto('/#/practice/E2?from=A&to=D&countMode=tap&durationMs=30000&timeScale=0.25');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  const view = page.getByTestId('e2-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running');
  for (let k = 0; k < 3; k++) await page.keyboard.press('b');
  await expect(page.getByTestId('e2-count')).toHaveText('3');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('e2-count')).toHaveText('4');
  await expect(view).toHaveAttribute('data-phase', 'review', { timeout: 20_000 });
  await page.keyboard.press('b');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();

  // Esc never stops at once: it asks first (a second Esc confirms).
  await page.goto('/#/practice/E7');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e7-view')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exercise-nothing')).toBeVisible();
});
