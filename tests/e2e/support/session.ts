import { expect, type Page } from '@playwright/test';

/** Presses a key with the focus on `testId` (keyboard only: focus moves like Tab would, no clicks). */
export async function pressOn(page: Page, testId: string, key = 'Enter'): Promise<void> {
  await page.getByTestId(testId).focus();
  await page.keyboard.press(key);
}

/** Drives the current session item with the keyboard (no microphone); returns its exercise type. */
export async function playItem(page: Page): Promise<string> {
  const header = page.getByTestId('session-header');
  const type = (await header.getAttribute('data-item-type'))!;
  const index = await header.getAttribute('data-index');
  if (type === 'REST') {
    await page.keyboard.press('Enter'); // "바로 다음으로" has the focus
  } else {
    await expect(page.getByTestId('exercise-start')).toBeFocused();
    await page.keyboard.press('Enter');
    if (type === 'E0') {
      await expect(page.getByTestId('e0-view')).toBeVisible();
      for (let k = 0; k < 6; k++) await page.keyboard.press('Enter');
    } else if (type === 'E5') {
      await expect(page.getByTestId('armed-start')).toBeVisible();
      await page.keyboard.press('Space');
      await expect(page.getByTestId('e5-view')).toHaveAttribute('data-phase', 'review', { timeout: 60_000 });
      await page.keyboard.press('1');
    } else if (type === 'Q1') {
      for (let q = 0; q < 10; q++) {
        await expect(page.getByTestId('q1-view')).toBeVisible();
        await page.keyboard.press('1');
        await page.keyboard.press('Enter');
      }
    } else if (type === 'K1') {
      // v1.1 Stage 0 self-check cards (posture, pick, counting aloud): 1 = 됐어요 on each card.
      for (let card = 0; card < 3; card++) {
        await expect(page.getByTestId('k1-view')).toBeVisible();
        await page.keyboard.press('1');
      }
    } else if (type === 'E16') {
      // v1.1 fret-position comparison without a microphone: rate each of the 6 plucks (1 = clean).
      await expect(page.getByTestId('e16-view')).toBeVisible();
      for (let pluck = 0; pluck < 6; pluck++) await page.keyboard.press('1');
    } else {
      throw new Error(`unexpected stage-0 item ${type}`);
    }
    await expect(page.getByTestId('next-item')).toBeFocused({ timeout: 10_000 });
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('session-header').or(page.getByTestId('self-report'))).toBeVisible();
  if (await page.getByTestId('session-header').isVisible())
    await expect(page.getByTestId('session-header')).not.toHaveAttribute('data-index', index!);
  return type;
}
