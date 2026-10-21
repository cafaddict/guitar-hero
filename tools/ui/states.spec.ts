import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';

/**
 * States outside `tests/e2e/support/screens.ts` for the visual review (`ui-shots/states/<theme>/...`), with the
 * same fold / full pair as `shots.spec.ts`. Filters: UI_SHOTS_THEMES, UI_SHOTS_VIEWPORTS, UI_SHOTS_STATES.
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
const OUT = join(import.meta.dirname, '..', '..', process.env.UI_SHOTS_DIR ?? 'ui-shots', 'states');

interface State {
  name: string;
  open: (page: Page) => Promise<void>;
}

/** A session with the microphone off (keyboard and taps only), on its first item. */
async function session(page: Page): Promise<void> {
  await page.goto('/#/session?timeScale=0.25');
  await expect(page.getByTestId('session-header')).toHaveAttribute('data-index', '0');
}

/** Starts the first item from the keyboard and stops it (Esc, then Esc on the question). */
async function stopFirstItem(page: Page): Promise<void> {
  await page.keyboard.press('PageDown');
  await expect(page.getByTestId('exercise-finish')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('next-item')).toBeVisible();
}

const STATES: State[] = [
  {
    name: 'practice-E2-result',
    open: async (page) => {
      await page.goto('/#/practice/E2?from=A&to=D&countMode=tap&durationMs=30000&timeScale=0.25');
      await page.getByTestId('exercise-start').click();
      await expect(page.getByTestId('e2-view')).toHaveAttribute('data-phase', 'ready');
      // The run's keys are attached in an effect, just after the first frame shows.
      await page.waitForTimeout(200);
      await page.keyboard.press('Space');
      // 30 s at the 4× test clock, then the count is confirmed (Enter).
      await expect(page.getByTestId('e2-view')).toHaveAttribute('data-phase', 'review', { timeout: 30_000 });
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('exercise-summary')).toBeVisible();
    },
  },
  {
    name: 'practice-E9-paused',
    open: async (page) => {
      await page.goto('/#/practice/E9');
      await page.getByTestId('exercise-start').click();
      await page.getByTestId('seq-start').click();
      await expect(page.getByTestId('seq-flawless')).toBeVisible({ timeout: 20_000 });
      await page.keyboard.press('p');
      await expect(page.getByTestId('exercise-paused')).toBeVisible();
    },
  },
  {
    name: 'session-after-run',
    open: async (page) => {
      await session(page);
      await stopFirstItem(page);
    },
  },
  {
    name: 'session-transition',
    open: async (page) => {
      await session(page);
      await stopFirstItem(page);
      await page.getByTestId('next-item').click();
      await expect(page.getByTestId('block-transition')).toBeVisible();
    },
  },
  {
    name: 'session-paused',
    open: async (page) => {
      await session(page);
      await page.getByRole('button', { name: '일시정지', exact: true }).click();
      await expect(page.getByRole('button', { name: '계속하기' })).toBeVisible();
    },
  },
  {
    name: 'session-self-report',
    open: async (page) => {
      await session(page);
      await page.getByTestId('end-session').click();
      await expect(page.getByTestId('self-report')).toBeVisible();
    },
  },
];

const pick = <T extends { name: string }>(all: T[], env: string | undefined): T[] =>
  env ? all.filter((x) => env.split(',').includes(x.name)) : all;

test('ui state shots', async ({ page }) => {
  test.skip(!process.env.UI_SHOTS_BASE, 'needs UI_SHOTS_BASE (a running vite --mode e2e server)');
  await page.goto('/#/settings');
  await page.getByTestId('setting-mic-disabled').check();
  for (const theme of pick(THEMES, process.env.UI_SHOTS_THEMES)) {
    await page.goto('/#/settings');
    await page.getByRole('radio', { name: theme.label }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme.name);
    for (const viewport of pick(VIEWPORTS, process.env.UI_SHOTS_VIEWPORTS)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const state of pick(STATES, process.env.UI_SHOTS_STATES)) {
        await page.goto('/#/tools');
        await state.open(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(250);
        const base = join(OUT, theme.name, `${viewport.name}-${state.name}`);
        await page.screenshot({ path: `${base}-fold.png` });
        await page.screenshot({ path: `${base}-full.png`, fullPage: true });
      }
    }
  }
});
