import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';
import { declaredHeaders } from './support/headers';

test('AC-W2: the deployed headers (strict CSP) allow the worklet, workers, charts and synth — no violations', async ({
  page,
}) => {
  const headers = declaredHeaders();
  expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
  expect(headers['Permissions-Policy']).toContain('microphone=(self)');
  // vercel.json carries exactly the same headers.
  const vercel = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'vercel.json'), 'utf8')) as {
    headers: { headers: { key: string; value: string }[] }[];
  };
  expect(Object.fromEntries(vercel.headers[0]!.headers.map((h) => [h.key, h.value]))).toEqual(headers);

  await serveFixtures(page);
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
  });
  await page.addInitScript(() => {
    const violations: string[] = [];
    (window as unknown as { __csp: string[] }).__csp = violations;
    document.addEventListener('securitypolicyviolation', (e) =>
      violations.push(`${e.violatedDirective} ${e.blockedURI}`),
    );
  });
  await page.addInitScript(installFakeMic, { loopbackDelayMs: null, deny: false });

  // AudioWorklet (TS module) under the CSP.
  await page.goto('/#/settings/diagnostics');
  await page.getByRole('button', { name: '마이크 켜기' }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { __gh_test: { captureReady: boolean } }).__gh_test.captureReady,
      ),
    )
    .toBe(true);
  await playFixture(page, 'spike-sine-440.wav');
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __gh_test: { levelRms: number | null } }).__gh_test.levelRms,
        ),
      { timeout: 10_000 },
    )
    .toBeGreaterThan(0.1);
  // DSP module worker (noise analysis) and the metronome ticker worker.
  await page.goto('/#/onboarding');
  await page.getByRole('button', { name: '마이크 허용' }).click();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '소음 측정' }).click();
  await expect(page.getByTestId('noise-result')).toBeVisible({ timeout: 15_000 });
  await page.goto('/#/metronome');
  await page.getByTestId('metronome-toggle').click();
  await expect(page.locator('[data-testid="metronome-pulse"] [data-active="true"]').first()).toBeVisible();
  await page.getByTestId('metronome-toggle').click();
  // Charts (inline style attributes) and synth playback.
  await page.goto('/#/progress');
  await expect(page.getByTestId('progress-weekly')).toBeVisible();
  await page.goto('/#/library/C');
  await page.getByRole('button', { name: '들어 보기' }).click();
  // v1.1 (AC-W4): the play-along backing (synth + scheduled playback, the song strum job) and the sequence
  // judging (DSP worker range requests) under the same CSP.
  await page.goto('/#/practice/S?songId=s01&mode=perform&bpm=100&backingOn=true&earphones=true');
  await page.getByTestId('exercise-start').click();
  const song = page.getByTestId('song-view');
  await expect(page.getByTestId('song-earphones')).toBeVisible();
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', 'running', { timeout: 15_000 });
  await page.keyboard.press('Space');
  await expect(song).toHaveAttribute('data-phase', 'review');
  await page.goto('/#/practice/E10?scaleId=em-pent-open&bpm=120');
  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e10-view')).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('e10-view')).toHaveAttribute('data-phase', 'running', { timeout: 15_000 });
  await expect(page.getByTestId('seq-cycles')).toHaveAttribute('data-count', /[1-9]/, { timeout: 30_000 });

  expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
});
