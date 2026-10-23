import { expect, test } from '@playwright/test';
import { ko } from '../../src/i18n/ko';
import { putRows } from './support/idb';

test('D-099: a new stage opens with "새 코드를 배워봅시다" and its never-played chords right after tuning', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
  // Just promoted to Stage 3: Em and Am have never been played.
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 3,
      stageEnteredAt: Date.now(),
      sessionsInStage: 0,
      gVoicing: 'G-2f',
      history: [],
      exam: {},
      completedBeginner1: false,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);
  await page.reload();
  // Home tells it before the start (no extra time: the first four weeks keep the 20 minutes).
  await expect(page.getByText(ko.home.notices.newChords('Em · Am', 0))).toBeVisible();

  // The intro shows even with the block transition screens turned off, and after a skip.
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.getByTestId('setting-block-transition').uncheck();
  await page.goto('/#/session?timeScale=0.25');
  const header = page.getByTestId('session-header');
  await expect(header).toHaveAttribute('data-block', 'tuning');
  await page.getByTestId('skip-item').click();
  const intro = page.getByTestId('block-transition');
  await expect(intro).toContainText(ko.session.newChordsIntro);
  await expect(intro.getByTestId('new-chords')).toHaveText('Em · Am');
  await expect(header).toHaveAttribute('data-index', '1');
  await expect(header).toHaveAttribute('data-block', 'newChord');
  await expect(header).toHaveAttribute('data-item-type', 'E1');

  // Enter starts the first chord; the second follows without another intro; then the routine goes on.
  await page.keyboard.press('Enter');
  await expect(intro).toBeHidden();
  await expect(page.getByTestId('exercise-start')).toBeVisible();
  await page.getByTestId('skip-item').click();
  await expect(header).toHaveAttribute('data-index', '2');
  await expect(header).toHaveAttribute('data-block', 'newChord');
  await expect(intro).toBeHidden();
  await page.getByTestId('skip-item').click();
  await expect(header).toHaveAttribute('data-index', '3');
  await expect(header).not.toHaveAttribute('data-block', 'newChord');
  await expect(intro).toBeHidden();
});
