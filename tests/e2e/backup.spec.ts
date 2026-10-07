import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { putRows, readStore } from './support/idb';

const TABLES = [
  'voicings',
  'routines',
  'sessions',
  'attempts',
  'metrics',
  'skills',
  'progression',
  'reviews',
  'calibrations',
  'recordings',
  'meta',
];

async function counts(page: Page): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = (await readStore<unknown>(page, t)).length;
  return out;
}

async function progressText(page: Page): Promise<string> {
  await page.goto('/#/progress');
  await expect(page.getByTestId('progress-sessions')).toBeVisible();
  // Charts render asynchronously; the text sections (sessions, heatmap, patterns) are the comparable part.
  return [
    await page.getByTestId('progress-sessions').innerText(),
    await page.getByTestId('progress-heatmap').innerText(),
    await page.getByTestId('progress-patterns').innerText(),
  ].join('\n');
}

test('E2E-08: export → reset → import restores every table and the progress screen', async ({ page }) => {
  test.setTimeout(120_000);
  // Some real data: settings, an E1 manual check, an E2 tap run, a finished session.
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/); // the onboarding returns home once the setting is stored
  await page.goto('/#/practice/E1?voicingId=C');
  await page.getByTestId('exercise-start').click();
  await page.getByRole('button', { name: '준비됐어요' }).click();
  await expect(page.getByTestId('e1-instruction')).toHaveAttribute('data-active-string', '5');
  for (const key of ['1', '1', '2', '1', '1']) await page.keyboard.press(key);
  await page.getByTestId('exercise-finish').click();
  await expect(page.getByTestId('exercise-summary')).toBeVisible();
  await page.goto('/#/practice/E2?from=A&to=D&countMode=tap&durationMs=30000&timeScale=0.25');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e2-view')).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  for (let k = 0; k < 4; k++) await page.keyboard.press('Enter');
  await expect(page.getByTestId('e2-view')).toHaveAttribute('data-phase', 'review', { timeout: 20_000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();
  const day = Date.now() - 3600_000;
  await putRows(page, 'sessions', [
    {
      id: 'seeded-session',
      startedAt: day,
      endedAt: day + 20 * 60_000,
      routineId: null,
      plannedItems: 6,
      completedItems: 5,
      selfReport: { pain: 1, difficulty: 3, dangerFlags: [], note: '' },
      stage: 0,
    },
  ]);

  // Export.
  await page.goto('/#/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-data').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^guitar-hero-backup-\d{4}-\d{2}-\d{2}\.json$/);
  const file = await download.path();
  const before = await counts(page);
  expect(before.attempts).toBe(2);
  expect(before.metrics).toBeGreaterThan(0);
  const progressBefore = await progressText(page);

  // Reset (two-step confirmation).
  await page.goto('/#/settings');
  await page.getByTestId('reset-start').click();
  await page.getByTestId('reset-confirm-1').click();
  await page.getByTestId('reset-confirm-2').click();
  await expect(page.getByText('모든 데이터를 지웠어요.')).toBeVisible();
  const empty = await counts(page);
  expect(empty.attempts).toBe(0);
  expect(empty.sessions).toBe(0);

  // Import with preview, then replace (two-step).
  await page
    .getByTestId('import-file')
    .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: readFileSync(file) });
  await expect(page.getByTestId('import-preview')).toContainText('attempts 2');
  await page.getByRole('button', { name: '바꾸기(지금 데이터를 지우고 가져오기)' }).click();
  await page.getByTestId('import-replace-confirm').click();
  await expect(page.getByTestId('backup-message')).toHaveText('가져왔어요.');

  expect(await counts(page)).toEqual(before);
  expect(await progressText(page)).toBe(progressBefore);
});
