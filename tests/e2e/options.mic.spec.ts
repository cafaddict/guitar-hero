import { expect, type Page, test } from '@playwright/test';
import { PRACTICE_SONGS } from '../../src/content/songs';
import { installFakeMic } from './support/fakeMic';
import { putRows, readStore, type StoredAttempt } from './support/idb';

/** Skips session items until one of `type` is current. */
async function skipTo(page: Page, type: string): Promise<void> {
  const header = page.getByTestId('session-header');
  for (let k = 0; k < 20; k++) {
    if ((await header.getAttribute('data-item-type')) === type) return;
    const index = await header.getAttribute('data-index');
    await page.getByTestId('skip-item').click();
    await expect(header).not.toHaveAttribute('data-index', index!);
  }
  throw new Error(`no ${type} item in the session`);
}

async function lastAttempt(page: Page, type: string): Promise<StoredAttempt> {
  const attempts = await readStore<StoredAttempt>(page, 'attempts');
  return attempts.filter((a) => a.exerciseType === type).at(-1)!;
}

test('E2E-22: practice options by key inside the session runner reach the run and the Attempt params', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/#/settings');
  const now = Date.now();
  await putRows(page, 'progression', [
    {
      key: 'current',
      stage: 4,
      stageEnteredAt: now - 3 * 86_400_000,
      sessionsInStage: 1,
      gVoicing: 'G-2f',
      history: [],
      exam: {},
      completedBeginner1: false,
      completedBeginner2: false,
      prescriptions: [],
    },
  ]);
  // Two full learn runs of every song open the perform stage, where B switches the backing (§8.6).
  const learned = { count: 2, last: 1, best: 1, lastAt: 1, firstAt: 1, recent: [1, 1], dayBest: {} };
  await putRows(
    page,
    'skills',
    PRACTICE_SONGS.map((s) => ({
      subjectKey: `song:${s.id}`,
      lastPracticedAt: 1,
      due: null,
      metrics: { learnFull: learned },
    })),
  );
  await page.goto('/#/session?timeScale=0.25');
  await expect(page.getByTestId('session-header')).toBeVisible();

  // E1: M cycles the mode (pluck → strum → manual), E turns ear-first on.
  await skipTo(page, 'E1');
  await page.getByTestId('exercise-start').click();
  const e1 = page.getByTestId('e1-view');
  await expect(e1).toHaveAttribute('data-mode', 'pluck');
  await page.keyboard.press('m');
  await expect(e1).toHaveAttribute('data-mode', 'strum');
  await page.keyboard.press('m');
  await expect(e1).toHaveAttribute('data-mode', 'manual');
  await page.keyboard.press('e');
  await page.keyboard.press('Enter');
  for (let k = 0; k < 4; k++) await page.keyboard.press('1');
  await expect(e1).toHaveAttribute('data-step', 'release');
  await page.getByTestId('exercise-finish').click();
  await expect(page.getByTestId('next-item')).toBeVisible();
  expect((await lastAttempt(page, 'E1')).params).toMatchObject({ mode: 'manual', earFirst: true });

  // E5: V hides the visual cues.
  await skipTo(page, 'E5');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('armed-start')).toBeVisible();
  await page.keyboard.press('v');
  await expect(page.getByTestId('e5-view').getByText('시각 큐 숨김', { exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('next-item')).toBeVisible({ timeout: 90_000 });
  expect((await lastAttempt(page, 'E5')).params).toMatchObject({ cuesHidden: true });

  // S (perform): ↑ ↑ raise the tempo by 10, H hides the chart, B turns the backing on.
  await skipTo(page, 'S');
  await page.getByTestId('exercise-start').click();
  const song = page.getByTestId('song-view');
  await expect(song).toHaveAttribute('data-stage', 'perform');
  const bpm = Number(await song.getAttribute('data-bpm'));
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(song).toHaveAttribute('data-bpm', String(bpm + 10));
  await expect(page.getByTestId('song-backing-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('b');
  await expect(page.getByTestId('song-backing-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('h');
  await expect(song).toHaveAttribute('data-stage', 'hidden');
  // D-083: with the Korean IME on, H types 'ㅗ' — the key still works by its position (KeyH).
  const imeKey = (key: string, code: string) =>
    page.evaluate(({ k, c }) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, code: c })), {
      k: key,
      c: code,
    });
  await imeKey('ㅗ', 'KeyH');
  await expect(song).toHaveAttribute('data-stage', 'perform');
  await imeKey('ㅗ', 'KeyH');
  await expect(song).toHaveAttribute('data-stage', 'hidden');
  // D-082: before the start the hidden stage still shows the chart to look over; it is covered once playing.
  await expect(page.getByTestId('song-hidden-preview')).toBeVisible();
  await expect(song.getByRole('list', { name: /./ })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', /countIn|running/);
  await expect(song.getByText('악보 숨김 — 외워서 쳐 봐요')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', 'review');
  // D-083: the review shows the chart again to check against.
  await expect(song.getByRole('list', { name: /./ })).toBeVisible();
  // A perform take is confirmed once its beat-1 analysis is not running (Enter is ignored meanwhile).
  await expect(async () => {
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('exercise-summary')).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  expect((await lastAttempt(page, 'S')).params).toMatchObject({
    bpm: bpm + 10,
    chartHidden: true,
    backingOn: true,
  });
});
