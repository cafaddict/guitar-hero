import { expect, test } from '@playwright/test';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { E5_FIXTURE } from '../../tools/fixtures/generate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { putRows, readStore, type StoredAttempt, seedCalibration } from './support/idb';

const SIMULATED_RTT_MS = 60;

test('E2E-06: E5 P3 at 80 BPM, grid-aligned strums with a seeded RTT → hit rate ≥ 0.9, mean/sd, +5 BPM ladder', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });

  // The app creates its database on first load; then a Calibration with a known RTT is stored.
  await page.goto('/#/settings/diagnostics');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('진단');
  await putRows(page, 'calibrations', [seedCalibration(SIMULATED_RTT_MS)]);

  const chords = encodeURIComponent(JSON.stringify([E5_FIXTURE.chord]));
  await page.goto(
    `/#/practice/E5?patternId=${E5_FIXTURE.patternId}&bpm=${E5_FIXTURE.bpm}&bars=${E5_FIXTURE.bars}&mode=single&chords=${chords}`,
  );
  await page.getByTestId('exercise-start').click();
  // Armed: the first strum or Space starts the count-in (SPEC §12.3); here Space.
  await expect(page.getByTestId('e5-view')).toHaveAttribute('data-phase', 'armed');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('e5-view')).toHaveAttribute('data-phase', 'countIn');

  // Strums land on the grid as heard by the player: grid time + RTT (the fixture's first slot is 0.2 s in).
  const gridStart = await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { gridStartTime: number | null } }).__gh_test.gridStartTime,
      ),
    )
    .not.toBeNull()
    .then(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { gridStartTime: number } }).__gh_test.gridStartTime,
      ),
    );
  await playFixture(page, 'e5-p3-80.wav', gridStart + SIMULATED_RTT_MS / 1000 - E5_FIXTURE.leadS);

  // Live feedback (D-077): the first bar is judged while the run is still playing.
  const firstBar = page.getByTestId('live-bar').first();
  await expect(firstBar).toHaveAttribute('data-status', /^(good|off)$/, { timeout: 20_000 });
  await expect(page.getByTestId('e5-view')).toHaveAttribute('data-phase', 'running');
  await expect(page.getByTestId('live-last')).toContainText(/\d마디: \d\/\d 맞음/);

  const summary = page.getByTestId('e5-summary');
  await expect(summary).toBeVisible({ timeout: 60_000 });
  const hitRate = Number(await page.getByTestId('e5-hit-rate').getAttribute('data-value'));
  expect(hitRate).toBeGreaterThanOrEqual(0.9);
  await expect(page.getByTestId('e5-mean')).toBeVisible();
  await expect(page.getByTestId('e5-sd')).toBeVisible();
  const ladder = page.getByTestId('e5-ladder');
  await expect(ladder).toHaveAttribute('data-ladder', 'up');
  await expect(ladder).toHaveAttribute('data-next-bpm', String(E5_FIXTURE.bpm + 5));

  const attempts = await readStore<
    StoredAttempt & { result: { hitRate: number; meanOffsetMs: number; sdOffsetMs: number; bpm: number } }
  >(page, 'attempts');
  expect(attempts).toHaveLength(1);
  const attempt = attempts[0]!;
  expect(attempt.exerciseType).toBe('E5');
  expect(attempt.detectorVersion).toBe(DETECTOR_VERSION);
  expect(attempt.processingMs).toBeGreaterThan(0);
  expect(attempt.result.hitRate).toBe(hitRate);
  test.info().annotations.push({
    type: 'e5',
    description: `hit ${hitRate}, mean ${attempt.result.meanOffsetMs.toFixed(1)} ms, sd ${attempt.result.sdOffsetMs.toFixed(1)} ms`,
  });
});
