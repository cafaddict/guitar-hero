import { expect, type Page, test } from '@playwright/test';
import { installFakeMic } from './support/fakeMic';
import { readStore, type StoredAttempt } from './support/idb';

interface StoredSession {
  id: string;
  endedAt: number | null;
  completedItems: number;
  plannedItems: number;
  selfReport: { pain: number; difficulty: number } | null;
}

/** Presses a key with the focus on `testId` (keyboard only: focus moves like Tab would, no clicks). */
async function pressOn(page: Page, testId: string, key = 'Enter'): Promise<void> {
  await page.getByTestId(testId).focus();
  await page.keyboard.press(key);
}

/** Drives the current session item with the keyboard; returns its exercise type. */
async function playItem(page: Page): Promise<string> {
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

test("E2E-07: today's routine end to end with the keyboard only (manual items, timeScale)", async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/');
  // First run without a microphone: every item runs in its manual / self-report mode.
  await pressOn(page, 'onboarding-step', 'Tab');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);
  const planned = await page.getByTestId('routine-items').locator('li').count();
  expect(planned).toBeGreaterThan(3);

  await page.goto('/#/session?timeScale=0.25');
  await expect(page.getByTestId('session-header')).toBeVisible(); // the routine loads asynchronously
  const played: string[] = [];
  while (await page.getByTestId('session-header').isVisible()) played.push(await playItem(page));

  // Self report: pain 2/10, difficulty 4/5.
  await pressOn(page, 'report-pain', 'ArrowRight');
  await page.keyboard.press('ArrowRight');
  await pressOn(page, 'report-difficulty', 'ArrowRight');
  await pressOn(page, 'report-save');
  await expect(page).toHaveURL(/#\/$/);

  const sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  const session = sessions[0]!;
  expect(session.endedAt).not.toBeNull();
  expect(session.selfReport).toMatchObject({ pain: 2, difficulty: 4 });
  const attempts = await readStore<StoredAttempt & { sessionId: string | null }>(page, 'attempts');
  const exerciseItems = played.filter((t) => t !== 'REST').length;
  expect(attempts).toHaveLength(exerciseItems);
  expect(attempts.every((a) => a.sessionId === session.id)).toBe(true);
  expect(session.completedItems).toBe(exerciseItems);
  expect(session.plannedItems).toBe(exerciseItems);

  // Home reflects today's session.
  await expect(page.getByTestId('done-today')).toBeVisible();
  await expect(page.getByTestId('week-minutes')).toBeVisible();
  test.info().annotations.push({ type: 'items', description: played.join(' → ') });
});
