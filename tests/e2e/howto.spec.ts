import { expect, type Page, test } from '@playwright/test';

async function withoutMic(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  await expect(page).toHaveURL(/#\/$/);
}

test('E2E-24: the riff explains itself — open "하는 법", words, string numbers, fingers, 들어 보기 (D-079, D-080)', async ({
  page,
}) => {
  await withoutMic(page);
  await page.goto('/#/practice/E17?riffId=R1&bpm=60');
  // Before the run: the panel is open with the steps and the glossary.
  const howTo = page.getByTestId('how-to');
  await expect(howTo).toHaveAttribute('open', '');
  await expect(howTo).toContainText('클릭 한 번에 한 음');
  await expect(howTo.locator('[data-term="fingerNumbers"]')).toContainText('1 검지');
  await expect(howTo.locator('[data-term="tab"]')).toBeVisible();

  await page.getByTestId('exercise-start').click();
  await expect(page.getByTestId('e17-view')).toBeVisible();
  await expect(page.getByTestId('how-to')).not.toHaveAttribute('open', '');
  await expect(page.getByTestId('e17-spelled')).toContainText('6번 줄 개방 ×2 → 6번 줄 3프렛(3번 손가락) ×2');
  const tab = page.getByTestId('tab');
  await expect(tab.locator('[data-role="string-number"]')).toHaveCount(6);
  await expect(tab.locator('[data-role="bar-line"]')).toHaveCount(3);
  await expect(tab.locator('[data-role="finger"]')).toHaveCount(8);

  // 들어 보기, then Space: the demo stops and the run starts.
  await page.getByTestId('e17-listen').click();
  await expect(page.getByTestId('e17-listen')).toHaveAttribute('data-listening', 'true');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('seq-flawless')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('e17-listen')).toHaveCount(0);
});

test('E2E-24: every practice start screen shows its "하는 법" before the run (D-079)', async ({ page }) => {
  await withoutMic(page);
  for (const path of [
    '/#/practice/E5?patternId=P0&bpm=60&mode=mute',
    '/#/practice/E2?from=A&to=D',
    '/#/practice/Q1',
  ]) {
    await page.goto(path);
    await expect(page.getByTestId('how-to'), path).toHaveAttribute('open', '');
    await expect(page.getByTestId('how-to-steps').locator('li').first(), path).toBeVisible();
  }
  await expect(page.getByTestId('how-to-terms')).toContainText('코드 다이어그램');
});
