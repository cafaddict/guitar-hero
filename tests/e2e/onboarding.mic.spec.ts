import { expect, type Page, test } from '@playwright/test';
import { OPEN_STRING_DETUNE_CENTS } from '../../tools/fixtures/generate';
import { installFakeMic, playFixture } from './support/fakeMic';
import { serveFixtures } from './support/fixtures';

const SIMULATED_DELAY_MS = 120;
const BROWSER_BUFFERING_MARGIN_MS = 30;

interface StoredCalibration {
  tuningCents: number[];
  stringTemplates: { harmonics: number[]; decayRatio: number }[];
  rttMs: number;
  rttMethod: string;
  rttMadMs: number;
  noiseFloorDbfs: number;
  sampleRate: number;
  inputDeviceLabel: string;
  trackSettings: Record<string, unknown>;
}

function readCalibrations(page: Page): Promise<StoredCalibration[]> {
  return page.evaluate(
    () =>
      new Promise<StoredCalibration[]>((resolve, reject) => {
        const open = indexedDB.open('guitar-hero');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const request = open.result
            .transaction('calibrations', 'readonly')
            .objectStore('calibrations')
            .getAll();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result as StoredCalibration[]);
        };
      }),
  );
}

const next = (page: Page) => page.getByRole('button', { name: '다음', exact: true }).click();

test('E2E-01: first run → onboarding (permission, noise, tuning, templates, loopback RTT) saves a Calibration', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await serveFixtures(page);
  await page.addInitScript(installFakeMic, { loopbackDelayMs: SIMULATED_DELAY_MS, deny: false });

  // First run lands on the onboarding wizard.
  await page.goto('/');
  await expect(page).toHaveURL(/#\/onboarding$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('처음 설정');

  // 1. Permission: processing-free constraints, device shown.
  await page.getByRole('button', { name: '마이크 허용' }).click();
  await expect(page.getByTestId('onboarding-device')).toContainText('MacBook Pro Microphone (fake)');
  const constraints = await page.evaluate(
    () => (window as unknown as { __fakeMic: { constraints: unknown[] } }).__fakeMic.constraints,
  );
  expect(constraints[0]).toMatchObject({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  await next(page);

  // 2. Noise check (2 s of fake-mic silence).
  await page.getByRole('button', { name: '소음 측정' }).click();
  await expect(page.getByTestId('noise-result')).toBeVisible({ timeout: 15_000 });
  await next(page);

  // 3. Tuning: one open-string fixture per string, each detuned by a known amount within ±15 cents.
  for (const stringNo of [6, 5, 4, 3, 2, 1]) {
    await expect(page.getByTestId('tuning-target')).toHaveAttribute('data-string', String(stringNo));
    await playFixture(page, `open-${stringNo}.wav`);
    await expect(page.getByTestId(`tuning-string-${stringNo}`)).toHaveAttribute('data-passed', 'true', {
      timeout: 10_000,
    });
  }
  await expect(page.getByTestId('tuning-done')).toBeVisible();
  await next(page);

  // 4. Templates: three plucks per string (replayed if the wizard asks for more).
  for (const stringNo of [6, 5, 4, 3, 2, 1]) {
    await expect(page.getByTestId('template-target')).toHaveAttribute('data-string', String(stringNo));
    const done = page.getByTestId(`template-string-${stringNo}`);
    for (let attempt = 0; attempt < 3; attempt++) {
      await playFixture(page, `open3-${stringNo}.wav`);
      try {
        await expect(done).toHaveAttribute('data-done', 'true', { timeout: 6_000 });
        break;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  }
  await expect(page.getByTestId('templates-done')).toBeVisible();
  await next(page);

  // 5. RTT via the simulated speaker → mic loopback (DelayNode), measured twice under the same conditions.
  const result = page.getByTestId('rtt-result');
  const measureRtt = async (run: number): Promise<number> => {
    await expect(result).toHaveAttribute('data-run', String(run), { timeout: 30_000 });
    expect(await result.getAttribute('data-method')).toBe('loopback');
    return Number(await result.getAttribute('data-rtt-ms'));
  };
  await page.getByRole('button', { name: '지연 측정' }).click();
  const first = await measureRtt(1);
  await page.getByRole('button', { name: '다시 측정' }).click();
  const second = await measureRtt(2);
  for (const rtt of [first, second]) {
    expect(rtt).toBeGreaterThanOrEqual(SIMULATED_DELAY_MS);
    expect(rtt).toBeLessThanOrEqual(SIMULATED_DELAY_MS + BROWSER_BUFFERING_MARGIN_MS);
  }
  expect(Math.abs(first - second)).toBeLessThanOrEqual(3);
  // Every raw loopback attempt (not only the accepted ones) lies in the expected range.
  const attempts = (await page.getByTestId('rtt-history').getAttribute('data-values'))!.split(',');
  for (const value of attempts) {
    expect(value).not.toBe('x');
    expect(Number(value)).toBeGreaterThanOrEqual(SIMULATED_DELAY_MS);
    expect(Number(value)).toBeLessThanOrEqual(SIMULATED_DELAY_MS + BROWSER_BUFFERING_MARGIN_MS);
  }
  const rttNote = `${first.toFixed(2)}, ${second.toFixed(2)} (simulated ${SIMULATED_DELAY_MS}; attempts ${attempts.join(' ')})`;
  test.info().annotations.push({ type: 'rtt-ms', description: rttNote });
  await next(page);

  // 6. Summary → save.
  await page.getByRole('button', { name: '저장하고 시작하기' }).click();
  await expect(page).toHaveURL(/#\/$/);

  const calibrations = await readCalibrations(page);
  expect(calibrations).toHaveLength(1);
  const c = calibrations[0]!;
  expect(c.tuningCents).toHaveLength(6);
  c.tuningCents.forEach((cents, idx) => {
    expect(Math.abs(cents)).toBeLessThanOrEqual(15);
    expect(Math.abs(cents - OPEN_STRING_DETUNE_CENTS[idx]!)).toBeLessThanOrEqual(3);
  });
  expect(c.stringTemplates).toHaveLength(6);
  for (const t of c.stringTemplates) {
    expect(t.harmonics).toHaveLength(8);
    expect(t.harmonics[0]).toBeCloseTo(1, 6);
    expect(t.decayRatio).toBeGreaterThan(0.2);
  }
  expect(c.rttMethod).toBe('loopback');
  expect(c.rttMs).toBe(second);
  expect(c.rttMadMs).toBeLessThanOrEqual(2);
  expect(c.inputDeviceLabel).toBe('MacBook Pro Microphone (fake)');
  expect(c.trackSettings).toHaveProperty('echoCancellation');
  expect(c.noiseFloorDbfs).toBeLessThan(-45);
  expect([44100, 48000]).toContain(c.sampleRate);
});

test('onboarding: "이전 단계" reopens the step before fresh, so an accidental skip can be redone (D-097)', async ({
  page,
}) => {
  await page.addInitScript(installFakeMic, { loopbackDelayMs: SIMULATED_DELAY_MS, deny: false });
  await page.goto('/');
  await expect(page).toHaveURL(/#\/onboarding$/);
  const step = page.getByTestId('onboarding-step');
  const back = page.getByTestId('onboarding-back');
  await page.getByRole('button', { name: '마이크 허용' }).click();
  await expect(page.getByTestId('onboarding-device')).toBeVisible();
  await expect(back).toBeHidden(); // the first step has nothing before it
  await next(page);

  await expect(step).toHaveAttribute('data-step', 'noise');
  await page.getByRole('button', { name: '소음 측정' }).click();
  await expect(page.getByTestId('noise-result')).toBeVisible({ timeout: 15_000 });
  await next(page);
  await expect(step).toHaveAttribute('data-step', 'tuning');
  await back.click();
  await expect(step).toHaveAttribute('data-step', 'noise');

  // Tuning skipped by mistake: back from the templates, the tuning starts over with no string passed.
  await page.getByRole('button', { name: '소음 측정' }).click();
  await expect(page.getByTestId('noise-result')).toBeVisible({ timeout: 15_000 });
  await next(page);
  await page.getByTestId('tuning-skip').click();
  await expect(step).toHaveAttribute('data-step', 'templates');
  await back.click();
  await expect(step).toHaveAttribute('data-step', 'tuning');
  await expect(page.getByTestId('tuning-target')).toHaveAttribute('data-string', '6');
  for (const stringNo of [6, 5, 4, 3, 2, 1])
    await expect(page.getByTestId(`tuning-string-${stringNo}`)).toHaveAttribute('data-passed', 'false');
});
