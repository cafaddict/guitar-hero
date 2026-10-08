import { expect, test } from '@playwright/test';
import { readStore } from './support/idb';

test('E2E-20: routine editor — remove and lengthen items, save, the next session follows, reset restores', async ({
  page,
}) => {
  // First run: the onboarding opens; "마이크 없이 쓰기" stores the choice and returns home.
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const items = page.getByTestId('routine-items').locator('li');
  await expect(items.first()).toBeVisible();
  const defaultCount = await items.count();
  await expect(page.getByTestId('routine-items')).toContainText('프렛 위치 비교');

  // Edit: drop the fret-position comparison, lengthen the first diagram quiz by 30 s.
  await page.getByTestId('edit-routine').click();
  const rows = page.getByTestId('editor-item');
  await expect(rows).toHaveCount(defaultCount);
  await rows.filter({ hasText: '프렛 위치 비교' }).getByTestId('editor-remove').click();
  await expect(rows).toHaveCount(defaultCount - 1);
  const quiz = rows.filter({ hasText: '다이어그램' }).first();
  await expect(quiz).toContainText('4분');
  await quiz.getByTestId('editor-longer').click();
  await expect(quiz).toContainText('270초');
  await page.getByTestId('editor-save').click();
  await expect(page).toHaveURL(/#\/$/);

  // Home and the next session follow the saved composition.
  await expect(items).toHaveCount(defaultCount - 1);
  await expect(page.getByTestId('routine-items')).not.toContainText('프렛 위치 비교');
  await expect(page.getByTestId('routine-card')).toContainText('내가 편집한 루틴 구성');
  await page.goto('/#/session?timeScale=0.25');
  await expect(page.getByTestId('session-header')).toContainText(`1/${defaultCount - 1}`);
  const templates = await readStore<{ source: string; stage: number; items: unknown[] }>(page, 'routines');
  expect(templates).toEqual([expect.objectContaining({ source: 'user', stage: 0 })]);
  expect(templates[0]!.items).toHaveLength(defaultCount - 1);

  // Reset to the default template.
  await page.goto('/#/routine/edit');
  await page.getByTestId('editor-reset').click();
  await expect(page.getByTestId('editor-item')).toHaveCount(defaultCount);
  await expect(page.getByTestId('editor-reset')).toHaveCount(0);
  await page.goto('/');
  await expect(items).toHaveCount(defaultCount);
  await expect(page.getByTestId('routine-items')).toContainText('프렛 위치 비교');
  expect(await readStore(page, 'routines')).toEqual([]);
});
