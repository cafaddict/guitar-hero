import { expect, test } from '@playwright/test';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { E10_FIXTURE } from '../../tools/fixtures/generate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { putRows, readStore, type StoredAttempt, seedCalibration } from './support/idb';

const SIMULATED_RTT_MS = 60;

test('E2E-16: E10 Em pentatonic step 1 at 80 BPM — 4 flawless cycles graduate, a +1 semitone note is shown by position', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto('/#/settings/diagnostics');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('진단');
  await putRows(page, 'calibrations', [seedCalibration(SIMULATED_RTT_MS)]);

  await page.goto(
    `/#/practice/E10?scaleId=${E10_FIXTURE.scaleId}&step=${E10_FIXTURE.step}&bpm=${E10_FIXTURE.bpm}`,
  );
  await page.getByTestId('exercise-start').click();
  const view = page.getByTestId('e10-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', /countIn|running/);

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
  await playFixture(page, 'e10-em-pent-s1-80.wav', gridStart + SIMULATED_RTT_MS / 1000 - E10_FIXTURE.leadS);

  // Cycles 1–4 are flawless; the 5th has the 6th note one fret (a semitone) high.
  const cycles = page.getByTestId('seq-cycles');
  await expect(cycles).toHaveAttribute('data-streak', '4', { timeout: 110_000 });
  await expect(cycles).toHaveAttribute('data-count', String(E10_FIXTURE.cycles), { timeout: 40_000 });
  await expect(cycles).toHaveAttribute('data-streak', '0');
  const last = page.getByTestId('seq-last');
  await expect(last).toHaveAttribute('data-flawless', 'false');
  await expect(last).toHaveAttribute('data-fault-position', String(E10_FIXTURE.wrongIndex + 1));
  await expect(last).toHaveAttribute('data-fault-semitones', '1');
  await expect(page.getByTestId('seq-hint').first()).toContainText(
    `${E10_FIXTURE.wrongIndex + 1}번째 음이 반음 1개 높아요`,
  );

  await page.keyboard.press('Space');
  await expect(page.getByTestId('e10-summary')).toHaveAttribute('data-graduated', 'true', {
    timeout: 30_000,
  });

  const attempts = await readStore<
    StoredAttempt & { result: { cycles: { flawless: boolean }[]; graduated: boolean } }
  >(page, 'attempts');
  expect(attempts).toHaveLength(1);
  const attempt = attempts[0]!;
  expect(attempt.exerciseType).toBe('E10');
  expect(attempt.detectorVersion).toBe(DETECTOR_VERSION);
  expect(attempt.processingMs).toBeGreaterThan(0);
  expect(attempt.result.cycles.slice(0, 5).map((c) => c.flawless)).toEqual([true, true, true, true, false]);
  expect(attempt.result.graduated).toBe(true);
});
