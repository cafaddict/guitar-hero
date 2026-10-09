import { expect, type Page, test } from '@playwright/test';
import { SONG_FIXTURE, songBleedLoopbackGain } from '../../tools/fixtures/generate';
import { calibrateThroughOnboarding } from './support/calibrate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { putRows, readStore, type StoredAttempt, seedCalibration } from './support/idb';

/** Earphones: a seeded calibration; speakers: the loopback delay of the simulated speaker → mic path. */
const SIMULATED_RTT_MS = 60;

type SongAttempt = StoredAttempt & {
  result: {
    backingOn: boolean;
    backingAudible: boolean;
    beat1HitRate: number | null;
    chordCorrectRatio: number | null;
  };
};

/**
 * Plays s01 in perform mode with the backing on; the strums are put into the mic so they reach the capture
 * together with anything the app plays now + SIMULATED_RTT_MS (grid + RTT as heard).
 */
async function playAlong(page: Page, earphones: boolean): Promise<SongAttempt> {
  await page.goto(
    `/#/practice/S?songId=${SONG_FIXTURE.songId}&mode=perform&bpm=${SONG_FIXTURE.bpm}&backingOn=true&earphones=${earphones}`,
  );
  await page.getByTestId('exercise-start').click();
  const song = page.getByTestId('song-view');
  await expect(page.getByTestId('song-earphones')).toHaveAttribute('data-earphones', String(earphones));
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', /countIn|running/);

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
  await playFixture(page, 'song-s01-100-beat1.wav', gridStart + SIMULATED_RTT_MS / 1000 - SONG_FIXTURE.leadS);

  // The take ends by itself after the last bar; the chord check is shown in the review.
  const chord = page.getByTestId('song-chord');
  await expect(chord).toBeVisible({ timeout: 90_000 });
  await expect(chord).toHaveAttribute('data-reference', String(!earphones));
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('song-summary')).toBeVisible({ timeout: 15_000 });

  const attempts = await readStore<SongAttempt>(page, 'attempts');
  const songAttempts = attempts.filter((a) => a.exerciseType === 'S');
  expect(songAttempts).toHaveLength(1);
  return songAttempts[0]!;
}

/** Every bar but the fixture's silent one has its beat-1 strum (16 bars). */
const PLAYED_BEAT1 = 15 / 16;

async function chordMetricRows(page: Page): Promise<unknown[]> {
  const rows = await readStore<{ subjectKey: string }>(page, 'metrics');
  return rows.filter((r) => r.subjectKey === `song:${SONG_FIXTURE.songId}:chord`);
}

test.describe('E2E-17: song play-along with the backing (SPEC v1.1 §8.6)', () => {
  test('(a) earphones: the chord check counts toward progression', async ({ page }) => {
    test.setTimeout(150_000);
    await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
    await serveFixtures(page);
    await page.goto('/#/settings/diagnostics');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('진단');
    await putRows(page, 'calibrations', [seedCalibration(SIMULATED_RTT_MS)]);
    const attempt = await playAlong(page, true);
    expect(attempt.exerciseType).toBe('S');
    expect(attempt.params).toMatchObject({ backingOn: true, earphones: true });
    expect(attempt.result).toMatchObject({ backingOn: true, backingAudible: false });
    expect(attempt.result.beat1HitRate).toBe(PLAYED_BEAT1);
    expect(attempt.result.chordCorrectRatio).toBeGreaterThanOrEqual(0.9);
    expect(await chordMetricRows(page)).toHaveLength(1);
  });

  test('(b) speakers: the backing bleeds into the mic, beat 1 is still judged, the chord check is reference only', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.addInitScript(installFakeMic, { loopbackDelayMs: SIMULATED_RTT_MS, deny: false });
    await serveFixtures(page);
    // The RTT is measured through the loopback like on a device; then the "speaker" plays at the bleed level.
    const rttMs = await calibrateThroughOnboarding(page);
    expect(rttMs).toBeGreaterThanOrEqual(SIMULATED_RTT_MS);
    const gain = songBleedLoopbackGain();
    await page.evaluate(
      ([delayMs, level]) =>
        (
          window as unknown as { __fakeMic: { setLoopback(d: number, g: number): void } }
        ).__fakeMic.setLoopback(delayMs, level),
      [SIMULATED_RTT_MS, gain] as const,
    );
    test.info().annotations.push({
      type: 'bleed',
      description: `RTT ${rttMs} ms, loopback gain ${gain.toFixed(4)} (${SONG_FIXTURE.bleedRelDb} dB)`,
    });
    const attempt = await playAlong(page, false);
    expect(attempt.params).toMatchObject({ backingOn: true, earphones: false });
    expect(attempt.result).toMatchObject({ backingOn: true, backingAudible: true });
    // ≥ 0.9 (SPEC E2E-17) and the silent bar stays a miss: the backing's own beat-1 hit there was masked.
    expect(attempt.result.beat1HitRate).toBeGreaterThanOrEqual(0.9);
    expect(attempt.result.beat1HitRate).toBe(PLAYED_BEAT1);
    expect(await chordMetricRows(page)).toHaveLength(0);
  });
});
