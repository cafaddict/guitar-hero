import { expect, test } from '@playwright/test';

test('M0 spike: real getUserMedia path with --use-file-for-fake-audio-capture', async ({ page }) => {
  await page.goto('/#/settings/diagnostics');
  await page.getByRole('button', { name: '마이크 켜기' }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __gh_test: { levelRms: number | null } }).__gh_test.levelRms,
        ),
      {
        timeout: 15_000,
      },
    )
    .toBeGreaterThan(0.05);
});

test('E2E-13: real getUserMedia requests EC/NS/AGC off; diagnostics show what getSettings reports', async ({
  page,
}) => {
  // Observe (not replace) the real getUserMedia call.
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    const original = devices.getUserMedia.bind(devices);
    const requested: unknown[] = [];
    (window as unknown as { __requested: unknown[] }).__requested = requested;
    devices.getUserMedia = (constraints?: MediaStreamConstraints) => {
      requested.push(JSON.parse(JSON.stringify(constraints ?? null)));
      return original(constraints);
    };
  });
  await page.goto('/#/settings/diagnostics');
  await page.getByRole('button', { name: '마이크 켜기' }).click();
  await expect(page.getByTestId('diag-settings')).toBeVisible({ timeout: 15_000 });
  const requested = await page.evaluate(
    () => (window as unknown as { __requested: { audio: Record<string, unknown> }[] }).__requested,
  );
  expect(requested[0]!.audio).toMatchObject({
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false,
  });
  const settings = await page.evaluate(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    const s = stream.getAudioTracks()[0]!.getSettings();
    for (const t of stream.getTracks()) t.stop();
    return s;
  });
  // The screen shows exactly what the browser applied.
  const label = (v: unknown) => (v === true ? '켜짐' : v === false ? '꺼짐' : '알 수 없음');
  await expect(page.getByTestId('diag-echoCancellation')).toHaveText(label(settings.echoCancellation));
  await expect(page.getByTestId('diag-noiseSuppression')).toHaveText(label(settings.noiseSuppression));
  await expect(page.getByTestId('diag-autoGainControl')).toHaveText(label(settings.autoGainControl));
  await expect(page.getByTestId('diag-echoCancellation')).toHaveText('꺼짐');
  await expect(page.getByTestId('diag-sampleRate')).toHaveText(
    settings.sampleRate === undefined ? '알 수 없음' : String(settings.sampleRate),
  );
});
