import { expect, test } from '@playwright/test';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { E2_FIXTURE } from '../../tools/fixtures/generate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { readStore, type StoredAttempt } from './support/idb';

interface E2Result {
  durationMs: number;
  countMode: string;
  detectedChanges: number;
  correctedChanges: number | null;
  changeTimestampsMs: number[];
}

test('E2E-05: E2 A→D at timeScale 0.25 — first strum starts, auto count ±1, ↑↑↓ corrections, both counts stored', async ({
  page,
}) => {
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/#/practice/E2?from=A&to=D&countMode=auto&durationMs=60000&timeScale=0.25');
  await page.getByTestId('exercise-start').click();
  const view = page.getByTestId('e2-view');
  await expect(view).toHaveAttribute('data-phase', 'armed');

  // Nothing pressed: the first strum of the fixture starts the 60 s (15 s at 0.25×) timer.
  await playFixture(page, 'e2-a-d-alternating.wav');
  await expect(view).toHaveAttribute('data-phase', 'running', { timeout: 5_000 });

  // Corrections while playing: ↑ twice, ↓ once.
  await page.waitForTimeout(3_000);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');

  await expect(view).toHaveAttribute('data-phase', 'review', { timeout: 30_000 });
  const shown = Number(await page.getByTestId('e2-count').textContent());
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exercise-summary')).toBeVisible();

  const attempts = await readStore<StoredAttempt & { result: E2Result }>(page, 'attempts');
  expect(attempts).toHaveLength(1);
  const attempt = attempts[0]!;
  expect(attempt.exerciseType).toBe('E2');
  expect(attempt.detectorVersion).toBe(DETECTOR_VERSION);
  expect(attempt.processingMs).toBeGreaterThan(0);
  const r = attempt.result;
  expect(r.countMode).toBe('auto');
  expect(r.durationMs).toBe(60_000);
  expect(Math.abs(r.detectedChanges - E2_FIXTURE.changes)).toBeLessThanOrEqual(1);
  expect(r.correctedChanges).toBe(r.detectedChanges + 1);
  expect(shown).toBe(r.correctedChanges);
  test.info().annotations.push({
    type: 'e2-count',
    description: `detected ${r.detectedChanges} (truth ${E2_FIXTURE.changes}), corrected ${r.correctedChanges}`,
  });
});
