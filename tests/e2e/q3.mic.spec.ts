import { expect, test } from '@playwright/test';
import { Q3_FIXTURE, q3FixturePosition } from '../../tools/fixtures/generate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { readStore } from './support/idb';

test('E2E-21: Q3 strings 6/5 "pluck that note" — a played note answers by pitch and its card gets a due date', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  const { idx, fret } = q3FixturePosition();

  await page.goto(`/#/practice/Q3?mode=pluck&scope=${Q3_FIXTURE.scope}&questions=1&seed=${Q3_FIXTURE.seed}`);
  await page.getByTestId('exercise-start').click();
  const prompt = page.getByTestId('q3-prompt');
  await expect(prompt).toHaveAttribute('data-idx', String(idx));
  await expect(prompt).toHaveAttribute('data-fret', String(fret));

  await playFixture(page, 'q3-strings65.wav');
  await expect(page.getByTestId('quiz-feedback')).toHaveText('정답!', { timeout: 15_000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('quiz-summary')).toBeVisible();

  const cards = await readStore<{ subjectKey: string; due: number; kind: string }>(page, 'reviews');
  const card = cards.find((c) => c.subjectKey === `card:note:${idx}:${fret}`);
  expect(card).toBeDefined();
  expect(card!.due).toBeGreaterThan(Date.now());
});
