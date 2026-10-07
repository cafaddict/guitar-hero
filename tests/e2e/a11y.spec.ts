import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from './support/screens';

const THEMES = [
  ['dark', '다크'],
  ['light', '라이트'],
  ['contrast', '고대비'],
] as const;

test('E2E-11: no serious or critical axe violations on the main screens, in every theme', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const found: string[] = [];
  for (const [theme, label] of THEMES) {
    await page.goto('/#/settings');
    await page.getByRole('radio', { name: label }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    for (const screen of SCREENS) {
      await openScreen(page, screen);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      for (const v of results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
        found.push(
          `${theme} ${screen.name}: [${v.impact}] ${v.id} — ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join(' | ')}`,
        );
      }
    }
  }
  expect(found, found.join('\n')).toEqual([]);
});
