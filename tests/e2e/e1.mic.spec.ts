import { expect, type Page, test } from '@playwright/test';
import { DETECTOR_VERSION } from '../../src/dsp/version';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { readStore, type StoredAttempt } from './support/idb';

interface E1Result {
  mode: string;
  attempts: {
    perString: { idx: number; status: string | null }[];
    clean: boolean;
    strumVerdict: string | null;
  }[];
}

async function openE1(page: Page, query: string): Promise<void> {
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });
  await page.goto(`/#/practice/E1?${query}`);
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e1-view')).toHaveAttribute('data-step', 'place');
  await page.getByRole('button', { name: '준비됐어요' }).click();
}

/** Plays the fixture for the highlighted string; replays when the take was asked again (RETRY). */
async function pluckString(page: Page, stringNo: number, fixture: string, expected: string): Promise<void> {
  await expect(page.getByTestId('e1-instruction')).toHaveAttribute('data-active-string', String(stringNo));
  const cell = page.getByTestId(`e1-string-${stringNo}`);
  for (let attempt = 0; attempt < 3; attempt++) {
    await playFixture(page, fixture);
    try {
      await expect(cell).toHaveAttribute('data-status', expected, { timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

async function finishAndReadAttempt(page: Page): Promise<StoredAttempt & { result: E1Result }> {
  await page.getByTestId('exercise-finish').click();
  await expect(page.getByTestId('exercise-summary')).toBeVisible();
  const attempts = await readStore<StoredAttempt & { result: E1Result }>(page, 'attempts');
  expect(attempts).toHaveLength(1);
  const attempt = attempts[0]!;
  expect(attempt.exerciseType).toBe('E1');
  // The judgement really went through the DSP worker (SPEC §14.5).
  expect(attempt.detectorVersion).toBe(DETECTOR_VERSION);
  expect(attempt.processingMs).toBeGreaterThan(0);
  return attempt;
}

test('E2E-02: E1 C chord, clean string-by-string plucks → 5 strings OK, 6th skipped, Attempt stored', async ({
  page,
}) => {
  await openE1(page, 'voicingId=C&mode=pluck');
  await expect(page.getByTestId('e1-string-6')).toHaveAttribute('data-status', 'SKIPPED');
  for (const stringNo of [5, 4, 3, 2, 1]) await pluckString(page, stringNo, `c-pluck-${stringNo}.wav`, 'OK');
  await expect(page.getByTestId('e1-attempt-verdict')).toHaveText('깨끗해요!');
  await expect(page.getByTestId('e1-string-6')).toHaveAttribute('data-status', 'SKIPPED');
  const attempt = await finishAndReadAttempt(page);
  expect(attempt.result.mode).toBe('pluck');
  const first = attempt.result.attempts[0]!;
  expect(first.perString.map((s) => s.status)).toEqual(['NOT_PLAYED', 'OK', 'OK', 'OK', 'OK', 'OK']);
  expect(first.clean).toBe(true);
});

test('E2E-03: E1 C chord with a muted 2nd string → MUTED plus a coaching hint', async ({ page }) => {
  await openE1(page, 'voicingId=C&mode=pluck');
  for (const stringNo of [5, 4, 3]) await pluckString(page, stringNo, `c-pluck-${stringNo}.wav`, 'OK');
  await pluckString(page, 2, 'c-pluck-2-muted.wav', 'MUTED');
  await pluckString(page, 1, 'c-pluck-1.wav', 'OK');
  await expect(page.getByTestId('e1-attempt-verdict')).toHaveText('아직 깨끗하지 않은 줄이 있어요.');
  // FAIL wording = what + how (SPEC §12.4, §6.7): the 2nd string is fretted by finger 1.
  await expect(page.getByTestId('e1-hints')).toContainText(
    '2번 줄이 막혔어요 — 1번 손가락을 프렛 바로 뒤에 붙이고 손끝으로 눌러 보세요.',
  );
  const attempt = await finishAndReadAttempt(page);
  expect(attempt.result.attempts[0]!.perString[4]!.status).toBe('MUTED');
  expect(attempt.result.attempts[0]!.clean).toBe(false);
});

test('E2E-04: E1 strum beta, C with the 6th string ringing → UNEXPECTED(6) FAIL and the beta label', async ({
  page,
}) => {
  await openE1(page, 'voicingId=C&mode=strum');
  await expect(page.getByTestId('beta-badge')).toHaveText('베타');
  await expect(page.getByTestId('e1-view')).toHaveAttribute('data-step', 'strum');
  const sixth = page.getByTestId('e1-string-6');
  for (let attempt = 0; attempt < 3; attempt++) {
    await playFixture(page, 'c-strum-6-ringing.wav');
    try {
      await expect(sixth).toHaveAttribute('data-status', 'UNEXPECTED', { timeout: 6_000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  await expect(page.getByTestId('e1-attempt-verdict')).toHaveText('아직 깨끗하지 않은 줄이 있어요.');
  await expect(page.getByTestId('e1-hints')).toContainText(
    '6번 줄이 울렸어요 — 6번 줄은 치지 않아요(x). 5번 줄부터 스트럼하세요.',
  );
  const attempt = await finishAndReadAttempt(page);
  expect(attempt.result.mode).toBe('strum');
  expect(attempt.result.attempts[0]!.strumVerdict).toBe('FAIL');
  expect(attempt.result.attempts[0]!.perString[0]!.status).toBe('UNEXPECTED');
});
