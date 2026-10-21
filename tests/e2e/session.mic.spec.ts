import { expect, test } from '@playwright/test';
import { installFakeMic } from './support/fakeMic';
import { readStore, type StoredAttempt } from './support/idb';
import { playItem, pressOn } from './support/session';

interface StoredSession {
  id: string;
  endedAt: number | null;
  completedItems: number;
  plannedItems: number;
  selfReport: { pain: number; difficulty: number } | null;
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

  // Home reflects today's session: what was played, then the next session under its own heading (D-078).
  await expect(page.getByTestId('done-today')).toBeVisible();
  const doneLines = await page.getByTestId('done-items').locator('li').count();
  expect(doneLines).toBeGreaterThan(0);
  expect(doneLines).toBeLessThanOrEqual(exerciseItems);
  await expect(page.getByTestId('rotation-note')).toBeVisible();
  await expect(page.getByTestId('week-minutes')).toBeVisible();
  test.info().annotations.push({ type: 'items', description: played.join(' → ') });
});

test('D-095: "나가기" on the self report ends the session without a report; home lists today', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/');
  await pressOn(page, 'onboarding-step', 'Tab');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/$/);

  await page.goto('/#/session?timeScale=0.25');
  await expect(page.getByTestId('session-header')).toBeVisible();
  await playItem(page);
  await page.getByTestId('end-session').click();
  await expect(page.getByTestId('self-report')).toBeVisible();
  await page.getByTestId('focus-exit').click();
  await expect(page).toHaveURL(/#\/$/);

  const sessions = await readStore<StoredSession>(page, 'sessions');
  expect(sessions).toHaveLength(1);
  const session = sessions[0]!;
  expect(session.endedAt).not.toBeNull();
  expect(session.selfReport).toBeNull();
  const attempts = await readStore<StoredAttempt & { sessionId: string | null }>(page, 'attempts');
  expect(attempts.length).toBeGreaterThan(0);
  expect(session.completedItems).toBe(attempts.length);

  // Home: what was played and "마쳤어요", not a fresh routine as if nothing happened.
  await expect(page.getByTestId('done-today')).toBeVisible();
  await expect(page.getByTestId('done-items').locator('li')).not.toHaveCount(0);
  await expect(page.getByTestId('start-session')).toHaveText(/한 번 더 하기/);
});
