import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const PROD = 'http://localhost:4174';
const DIST = join(import.meta.dirname, '..', '..', 'dist');

function bundleFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? bundleFiles(join(dir, e.name))
      : /\.(js|html|mjs)$/.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

test('E2E-14: the production build ignores ?timeScale, has no test hooks, and its bundle has neither string', async ({
  page,
}) => {
  await page.goto(`${PROD}/#/practice/E2?from=A&to=D&countMode=tap&durationMs=30000&timeScale=0.25`);
  await page.getByRole('button', { name: '마이크 없이 쓰기' }).click();
  const view = page.getByTestId('e2-view');
  await expect(view).toHaveAttribute('data-phase', 'ready');
  await page.keyboard.press('Space');
  await expect(view).toHaveAttribute('data-phase', 'running');
  await page.waitForTimeout(3000);
  // Normal speed: ~27 s left after 3 s of a 30 s run (at 0.25× it would already show ~18 s).
  const [m, s] = ((await page.getByTestId('timer-remaining').textContent()) ?? '0:00').split(':').map(Number);
  const remaining = m! * 60 + s!;
  expect(remaining).toBeGreaterThanOrEqual(25);
  expect(remaining).toBeLessThanOrEqual(28);
  expect(await page.evaluate(() => 'timeScale' in window || '__gh_test' in window)).toBe(false);

  const files = bundleFiles(DIST);
  expect(files.length).toBeGreaterThan(0);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    expect(text.includes('timeScale'), file).toBe(false);
    expect(text.includes('__gh_test'), file).toBe(false);
  }
});
