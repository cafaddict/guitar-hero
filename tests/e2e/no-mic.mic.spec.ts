import { expect, test } from '@playwright/test';
import { installFakeMic } from './support/fakeMic';
import { readStore, type StoredAttempt } from './support/idb';

test('E2E-12: microphone permission denied → "마이크 없이 쓰기"; E2 tap mode and E1 manual mode still work', async ({
  page,
}) => {
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: true });

  // First run: the onboarding explains the denial and offers to continue without the microphone.
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 허용' }).click();
  await expect(page.getByTestId('mic-error')).toHaveAttribute('data-code', 'PERMISSION_DENIED');
  await expect(page.getByTestId('mic-error')).toContainText('마이크 권한이 거부됐어요');
  await page.getByTestId('mic-error').getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);

  // E2 falls back to tap counting (Enter = +1).
  await page.goto('/#/practice/E2?from=A&to=D&countMode=auto&durationMs=30000&timeScale=0.25');
  await page.getByTestId('exercise-start').click();
  const e2 = page.getByTestId('e2-view');
  await expect(e2).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(e2).toHaveAttribute('data-phase', 'running');
  for (let k = 0; k < 5; k++) await page.keyboard.press('Enter');
  await expect(page.getByTestId('e2-count')).toHaveText('5');
  await expect(e2).toHaveAttribute('data-phase', 'review', { timeout: 20_000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();

  // E1 runs as the manual self-check (keys 1/2/3).
  await page.goto('/#/practice/E1?voicingId=C&mode=pluck');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e1-view')).toHaveAttribute('data-mode', 'manual');
  await page.getByRole('button', { name: '준비됐어요' }).click();
  for (const key of ['1', '1', '1', '2', '1']) await page.keyboard.press(key);
  await expect(page.getByTestId('e1-view')).toHaveAttribute('data-step', 'release');
  await page.getByTestId('exercise-finish').click();
  await expect(page.getByTestId('exercise-summary')).toBeVisible();

  const attempts = await readStore<StoredAttempt & { result: Record<string, unknown> }>(page, 'attempts');
  const byType = Object.fromEntries(attempts.map((a) => [a.exerciseType, a]));
  expect(byType.E2!.result).toMatchObject({ countMode: 'tap', tapChanges: 5, detectedChanges: 0 });
  expect(byType.E2!.detectorVersion).toBeNull();
  const e1 = byType.E1!.result as {
    mode: string;
    attempts: { perString: { selfStatus: string | null }[]; clean: boolean }[];
  };
  expect(e1.mode).toBe('manual');
  expect(e1.attempts[0]!.perString.map((s) => s.selfStatus)).toEqual([
    null,
    'clean',
    'clean',
    'clean',
    'muted',
    'clean',
  ]);
  expect(e1.attempts[0]!.clean).toBe(false);
});
