import { expect, test } from '@playwright/test';
import { putRows } from './support/idb';

const DAY_MS = 86_400_000;

test("E2E-25: due reviews are counted and marked where today's routine serves them, and listed by name (D-081)", async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  const now = Date.now();
  // Stage 2 with two chord-recall cards due (answered in Q2 two days ago) and one coming up.
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 2,
      stageEnteredAt: now - 10 * DAY_MS,
      sessionsInStage: 1,
      gVoicing: 'G-2f',
      history: [],
      exam: {},
      completedBeginner1: false,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);
  const card = (cls: string, due: number) => ({
    subjectKey: `card:recall:${cls}`,
    kind: 'card',
    step: 0,
    due,
    enqueuedAt: now - 2 * DAY_MS,
    lastReviewedAt: now - 2 * DAY_MS,
    lapses: 0,
  });
  await putRows(page, 'reviews', [
    card('E', now - DAY_MS),
    card('A', now - DAY_MS),
    card('D', now + 3 * DAY_MS),
  ]);

  await page.reload();
  await expect(page.getByTestId('reviews-today')).toHaveText('오늘 복습 2개');
  const badged = page
    .getByTestId('routine-items')
    .locator('li')
    .filter({ has: page.getByTestId('review-badge') });
  await expect(badged).toHaveCount(1);
  await expect(badged).toContainText('코드 기억 퀴즈');
  await expect(badged.getByTestId('review-badge')).toHaveText('복습 2');

  await page.goto('/#/progress');
  await expect(page.getByTestId('review-due')).toContainText('코드 기억 카드 · E');
  await expect(page.getByTestId('review-due')).toContainText('코드 기억 카드 · A');
  await expect(page.getByTestId('review-upcoming')).toContainText('3일 뒤');
});
