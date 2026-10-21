import { expect, test } from '@playwright/test';
import { ko } from '../../src/i18n/ko';

test('AC-U2: a learned pedal key drives the exercise; Esc asks before stopping', async ({ page }) => {
  // Pedal learning: bind "b" (what a page-turner pedal might send) to next/confirm.
  await page.goto('/#/settings');
  await page.getByTestId('learn-next').click();
  await expect(page.getByTestId('learn-prompt')).toBeVisible();
  await page.keyboard.press('b');
  await expect(page.getByTestId('custom-keys')).toContainText('KeyB');
  // v1.1: B is also the play-along key (§12.3); learning says which default the pedal now replaces.
  await expect(page.getByTestId('learn-replaced')).toContainText('반주');

  // E2 tap counting with the learned key (Enter/pedal = +1 while running, confirm in the review).
  await page.goto('/#/practice/E2?from=A&to=D&countMode=tap&durationMs=30000&timeScale=0.25');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  const view = page.getByTestId('e2-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running');
  for (let k = 0; k < 3; k++) await page.keyboard.press('b');
  await expect(page.getByTestId('e2-count')).toHaveText('3');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('e2-count')).toHaveText('4');
  await expect(view).toHaveAttribute('data-phase', 'review', { timeout: 20_000 });
  await page.keyboard.press('b');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();

  // Esc never stops at once: it asks first (a second Esc confirms).
  await page.goto('/#/practice/E7');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e7-view')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exercise-nothing')).toBeVisible();
});

test('during a run "나가기" asks the same question as Esc instead of staying disabled (D-094)', async ({
  page,
}) => {
  await page.goto('/#/practice/E7');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e7-view')).toBeVisible();
  const exit = page.getByTestId('focus-exit');
  await expect(exit).toBeEnabled();
  await exit.click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  // "No" keeps the run; asking again and "yes" stops it; then the exit leaves.
  await page.getByRole('button', { name: ko.keys.abortNo }).click();
  await expect(page.getByRole('alertdialog')).toBeHidden();
  await expect(page.getByTestId('e7-view')).toBeVisible();
  await exit.click();
  await page.getByRole('button', { name: ko.keys.abortYes }).click();
  await expect(page.getByTestId('exercise-nothing')).toBeVisible();
  // Leaves the practice screen (home, or onboarding on a first-run profile).
  await exit.click();
  await expect(page).not.toHaveURL(/#\/practice\//);
});

test('AC-U2: page-turner keys walk the session between runs; navigation waits while a run is in progress', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.goto('/#/session?timeScale=0.25');
  const header = page.getByTestId('session-header');
  await expect(header).toHaveAttribute('data-index', '0');

  // PageDown (right pedal) starts the item; skipping or ending the session would discard the run, so they wait.
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('exercise-finish')).toBeVisible();
  await expect(page.getByTestId('skip-item')).toBeDisabled();
  await expect(page.getByTestId('end-session')).toBeDisabled();

  // Stop the run (Esc asks, Esc confirms); then PageDown moves on and PageUp (left pedal) comes back.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exercise-nothing').or(page.getByTestId('exercise-summary'))).toBeVisible();
  await expect(page.getByTestId('skip-item')).toBeEnabled();
  await page.keyboard.press('PageDown');
  await expect(header).toHaveAttribute('data-index', '1');
  await page.keyboard.press('PageUp');
  await expect(header).toHaveAttribute('data-index', '0');
});

test('session: after a run Space runs the same item again (even with the focus on "다음 항목"); Enter moves on', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.goto('/#/session?timeScale=0.25');
  const header = page.getByTestId('session-header');
  await expect(header).toHaveAttribute('data-index', '0');

  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('exercise-finish')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('retry-item')).toBeVisible();
  await expect(page.getByTestId('next-item')).toBeFocused();

  // Space: the same item from its start screen (the focused "다음 항목" is not clicked, nothing is skipped).
  await page.keyboard.press('Space');
  await expect(page.getByTestId('exercise-start')).toBeVisible();
  await expect(header).toHaveAttribute('data-index', '0');

  // It runs again from the keyboard, and Enter then moves on.
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('exercise-finish')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('next-item')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('data-index', '1');
});

test('session: the self report goes back to the practice with ← or "연습으로 돌아가기" (D-096)', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.goto('/#/session?timeScale=0.25');
  const header = page.getByTestId('session-header');
  await expect(header).toHaveAttribute('data-index', '0');

  // "세션 끝내기" by mistake: ← comes back to the same item.
  await page.getByTestId('end-session').click();
  await expect(page.getByTestId('self-report')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(header).toHaveAttribute('data-index', '0');

  // Further on, the touch button does the same.
  await page.getByTestId('skip-item').click();
  await expect(header).toHaveAttribute('data-index', '1');
  await page.getByTestId('end-session').click();
  await page.getByTestId('report-back').click();
  await expect(header).toHaveAttribute('data-index', '1');
  await expect(page.getByTestId('exercise-start')).toBeVisible();
});

test('session: during a run ← / "이전 항목" ends the run and goes back; skip and end still wait (D-096)', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.goto('/#/session?timeScale=0.25');
  const header = page.getByTestId('session-header');
  await expect(header).toHaveAttribute('data-index', '0');
  const dialog = page.getByRole('alertdialog');
  const previous = page.getByRole('button', { name: ko.session.previous, exact: true });

  // Item 2 (E5) waits for Space after PageDown: nothing was played yet, so the left pedal goes back at once.
  await page.getByTestId('skip-item').click();
  await expect(header).toHaveAttribute('data-item-type', 'E5');
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('armed-start')).toBeVisible();
  await page.keyboard.press('PageUp');
  await expect(header).toHaveAttribute('data-index', '0');

  // Under way it asks first: Esc keeps the run, a second left pedal confirms.
  await page.getByTestId('skip-item').click();
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('armed-start')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('e5-view')).not.toHaveAttribute('data-phase', 'armed');
  await page.keyboard.press('PageUp');
  await expect(dialog).toContainText(ko.keys.confirmPrevious);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('e5-view')).toBeVisible();
  await page.keyboard.press('PageUp');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('PageUp');
  await expect(header).toHaveAttribute('data-index', '0');

  // The touch button: enabled during the run while skipping and ending wait; "계속하기" keeps the run.
  await page.getByTestId('skip-item').click();
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('armed-start')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByTestId('e5-view')).not.toHaveAttribute('data-phase', 'armed');
  await expect(page.getByTestId('skip-item')).toBeDisabled();
  await expect(page.getByTestId('end-session')).toBeDisabled();
  await expect(previous).toBeEnabled();
  await previous.click();
  await page.getByRole('button', { name: ko.keys.abortNo }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('e5-view')).toBeVisible();
  await previous.click();
  await page.getByRole('button', { name: ko.keys.previousYes }).click();
  await expect(header).toHaveAttribute('data-index', '0');
});

test('session: going back to an item already run shows its result again; Space reruns it (D-096)', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  await page.goto('/#/session?timeScale=0.25');
  const header = page.getByTestId('session-header');
  await expect(header).toHaveAttribute('data-item-type', 'E0');

  // Tuning without a microphone: Enter confirms each string, then the result is stored.
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('e0-view')).toBeVisible();
  for (let k = 0; k < 6; k++) await page.keyboard.press('Enter');
  await expect(page.getByTestId('next-item')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('data-index', '1');

  // One Enter too many: the left pedal comes back to the stored result, ready to move on again.
  await page.keyboard.press('PageUp');
  await expect(header).toHaveAttribute('data-index', '0');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();
  await expect(page.getByTestId('next-item')).toBeFocused();
  // It is not reopened: Space starts a new run from the start screen.
  await page.keyboard.press('Space');
  await expect(page.getByTestId('exercise-start')).toBeVisible();
  await expect(header).toHaveAttribute('data-index', '0');

  // Moving forward always starts fresh; "세션 끝내기" and back shows the result the item ended on.
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('e0-view')).toBeVisible();
  for (let k = 0; k < 6; k++) await page.keyboard.press('Enter');
  await expect(page.getByTestId('next-item')).toBeFocused();
  await page.getByTestId('end-session').click();
  await page.getByTestId('report-back').click();
  await expect(page.getByTestId('exercise-summary')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(header).toHaveAttribute('data-index', '1');
  await expect(page.getByTestId('exercise-start')).toBeVisible();
});

test('← steps back inside an exercise: the string before, or an early end taken back (D-096)', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();

  // Tuning: a string confirmed by mistake is confirmed again (key and touch button).
  await page.goto('/#/practice/E0');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e0-view')).toBeVisible();
  const strings = page.getByTestId('e0-view').locator('ol > li');
  await expect(page.getByTestId('e0-previous')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(strings.nth(0)).toContainText(ko.exercises.e0.inTune);
  await page.keyboard.press('ArrowLeft');
  await expect(strings.nth(0)).not.toContainText(ko.exercises.e0.inTune);
  await page.keyboard.press('Enter');
  await page.getByTestId('e0-previous').click();
  await expect(strings.nth(0)).not.toContainText(ko.exercises.e0.inTune);
  await expect(page.getByTestId('e0-previous')).toBeHidden();

  // Stretching stopped early: the time left continues.
  await page.goto('/#/practice/E7');
  await page.getByTestId('exercise-start').click();
  const view = page.getByTestId('e7-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running');
  await page.keyboard.press('Enter');
  await expect(view).toHaveAttribute('data-phase', 'review');
  await page.getByTestId('e7-view-step-back').click();
  await expect(view).toHaveAttribute('data-phase', 'running');
  await page.keyboard.press('Enter');
  await expect(view).toHaveAttribute('data-phase', 'review');
  await page.keyboard.press('ArrowLeft');
  await expect(view).toHaveAttribute('data-phase', 'running');
});

test('the settings key list has pause (P) and song start-over (R) rows (D-085)', async ({ page }) => {
  await page.goto('/#/settings');
  for (const [action, keys] of [
    ['pause', 'p · P'],
    ['restart', 'r · R'],
  ] as const) {
    const row = page.getByRole('row', { name: ko.keys.actions[action]! });
    await expect(row).toBeVisible();
    await expect(row).toContainText(keys);
    await expect(page.getByTestId(`learn-${action}`)).toBeVisible();
  }
});
