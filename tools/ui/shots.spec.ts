import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from '../../tests/e2e/support/screens';

/**
 * Two pictures per screen, viewport and theme: `-fold` is the first screen exactly as a learner sees it
 * (scrolled to the top; a fixed tab bar covers what it covers), `-full` the whole page. Review both: a
 * full-page picture draws a fixed bar once mid-page and hides what it covers on the first screen.
 *
 * Filters (comma lists): UI_SHOTS_THEMES (dark,light,contrast), UI_SHOTS_VIEWPORTS (macbook,ipad-landscape,
 * ipad-portrait,iphone), UI_SHOTS_SCREENS (screen names from tests/e2e/support/screens.ts). UI_SHOTS_DIR: the
 * output folder under the repo (default ui-shots).
 */
const VIEWPORTS = [
  { name: 'macbook', width: 1440, height: 900 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'iphone', width: 390, height: 844 },
];
const THEMES = [
  { name: 'dark', label: '다크' },
  { name: 'light', label: '라이트' },
  { name: 'contrast', label: '고대비' },
];
// Outside test-results/: Playwright empties that folder at the start of every E2E run.
const OUT = join(import.meta.dirname, '..', '..', process.env.UI_SHOTS_DIR ?? 'ui-shots');

const pick = <T extends { name: string }>(all: T[], env: string | undefined): T[] =>
  env ? all.filter((x) => env.split(',').includes(x.name)) : all;

test('ui shots', async ({ page }) => {
  const themes = pick(THEMES, process.env.UI_SHOTS_THEMES);
  const viewports = pick(VIEWPORTS, process.env.UI_SHOTS_VIEWPORTS);
  const screens = pick(SCREENS, process.env.UI_SHOTS_SCREENS);
  for (const theme of themes) {
    await page.goto('/#/settings');
    await page.getByRole('radio', { name: theme.label }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.name);
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const screen of screens) {
        await openScreen(page, screen);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(250);
        const base = join(OUT, theme.name, `${viewport.name}-${screen.name}`);
        await page.screenshot({ path: `${base}-fold.png` });
        await page.screenshot({ path: `${base}-full.png`, fullPage: true });
      }
    }
  }
  console.log(`ui shots: ${themes.length * viewports.length * screens.length * 2} files in ${OUT}`);
});
