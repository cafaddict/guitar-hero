import { expect, type Page, test } from '@playwright/test';
import { ko } from '../../src/i18n/ko';
import { readStore, type StoredAttempt } from './support/idb';

/** The run's Attempt (one exercise per test: a fresh profile stores only this one). */
async function attemptOf(page: Page, type: string): Promise<StoredAttempt> {
  const attempts = (await readStore<StoredAttempt>(page, 'attempts')).filter((a) => a.exerciseType === type);
  expect(attempts).toHaveLength(1);
  return attempts[0]!;
}

const startWithoutMic = (page: Page) => page.getByRole('button', { name: '마이크 없이 쓰기' }).click();

test('E2E-26: song pause (a stop), Space resumes, R starts over; the Attempt counts the pause after the restart', async ({
  page,
}) => {
  test.setTimeout(120_000);
  // s01 = 16 bars; at 240 BPM a bar is one second.
  await page.goto('/#/practice/S?songId=s01&mode=perform&bpm=240&chartHidden=true');
  await startWithoutMic(page);
  const view = page.getByTestId('song-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running');

  await page.keyboard.press('p');
  await expect(view).toHaveAttribute('data-phase', 'paused');
  await expect(page.getByTestId('exercise-paused')).toBeVisible();
  await expect(page.getByTestId('song-paused')).toBeVisible();
  await expect(page.getByTestId('exercise-pause')).toHaveAttribute('aria-pressed', 'true');
  // The hidden stage keeps the chart covered while paused.
  await expect(view).toContainText(ko.exercises.song.hidden);
  await expect(view.locator('ol')).toHaveCount(0);

  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);
  await expect(page.getByTestId('exercise-paused')).toHaveCount(0);

  // R: the take starts over (its pause forgotten) with a fresh count-in.
  await expect(page.getByTestId('song-restart')).toBeVisible();
  await page.keyboard.press('r');
  await expect(view).toHaveAttribute('data-phase', 'countIn');
  await expect(view).toHaveAttribute('data-phase', 'running');
  await page.keyboard.press('p');
  await expect(view).toHaveAttribute('data-phase', 'paused');
  await page.keyboard.press('p');
  await expect(view).toHaveAttribute('data-phase', 'review', { timeout: 40_000 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();

  const { result } = await attemptOf(page, 'S');
  expect(result).toMatchObject({ pauses: 1, completed: true, chartHidden: true });
  expect(result.stops as number).toBeGreaterThanOrEqual(1);
});

test('E2E-26: a paused chromatic run (E9) is recorded with its pause but keeps the ladder', async ({
  page,
}) => {
  await page.goto('/#/practice/E9?startFret=5&bpm=60');
  await startWithoutMic(page);
  const view = page.getByTestId('e9-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running', { timeout: 20_000 });
  await page.keyboard.press('p');
  await expect(view).toHaveAttribute('data-phase', 'paused');
  await page.keyboard.press('p');
  await expect(view).toHaveAttribute('data-phase', 'running', { timeout: 20_000 });
  for (let k = 0; k < 3; k++) await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();
  await expect(page.getByTestId('exercise-summary')).toContainText(ko.exercises.common.pausedRun);

  const { result } = await attemptOf(page, 'E9');
  expect(result).toMatchObject({ pauses: 1, ladder: 'stay' });
  expect(result.cycles).toHaveLength(3);
});

test('E2E-26: Space on the focused pause button resumes once (the key and the button do not both act)', async ({
  page,
}) => {
  await page.goto('/#/practice/E8?bpm=60');
  await startWithoutMic(page);
  const view = page.getByTestId('e8-view');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);
  const pause = page.getByTestId('exercise-pause');
  await pause.click();
  await expect(view).toHaveAttribute('data-phase', 'paused');
  await expect(pause).toHaveText(ko.exercises.common.resume);
  // WebKit does not focus a clicked button: focus it the way a keyboard user would have.
  await pause.focus();
  await view.evaluate((el) => {
    const seen: string[] = [];
    (window as unknown as { phases: string[] }).phases = seen;
    new MutationObserver(() => seen.push(el.getAttribute('data-phase') ?? '')).observe(el, {
      attributes: true,
      attributeFilter: ['data-phase'],
    });
  });
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'countIn');
  // The one-bar count-in at 60 BPM lasts 4 s: a second (button) resume would have paused it again by now.
  await page.waitForTimeout(800);
  const phases = await page.evaluate(() => (window as unknown as { phases: string[] }).phases);
  expect(phases).toEqual(['countIn']);
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  // P is named in the key hint of a pausable run.
  await expect(page.getByText(ko.keys.hint(true))).toBeVisible();
});

test('E2E-26: an exercise that cannot pause shows no pause button and no P in its key hint', async ({
  page,
}) => {
  await page.goto('/#/practice/E2?from=A&to=D');
  await startWithoutMic(page);
  const view = page.getByTestId('e2-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running');
  await expect(page.getByTestId('exercise-pause')).toHaveCount(0);
  await expect(page.getByText(ko.keys.hint(false))).toBeVisible();
  await expect(page.getByText('P 일시정지')).toHaveCount(0);
  // P does nothing here.
  await page.keyboard.press('p');
  await expect(view).toHaveAttribute('data-phase', 'running');
});

test('E2E-26: the focused pause button keeps the focus while the run pauses and resumes (D-090 stage)', async ({
  page,
}) => {
  // A song has its own next step ("정지") while playing; paused, "이어서" becomes the next step. The button moves
  // in the layout, never in the DOM: Space on it must keep working without the learner finding it again.
  await page.goto('/#/practice/S?songId=s01&mode=perform&bpm=120&chartHidden=true');
  await startWithoutMic(page);
  const view = page.getByTestId('song-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);
  const pause = page.getByTestId('exercise-pause');
  // WebKit does not focus a clicked button: focus it the way a keyboard user would have.
  await pause.focus();
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'paused');
  await expect(pause).toBeFocused();
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);
  await expect(pause).toBeFocused();
});
