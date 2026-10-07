import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openScreen, SCREENS } from './support/screens';

const VIEWPORTS = [
  { name: 'macbook', width: 1440, height: 900 },
  { name: 'ipad-landscape', width: 1180, height: 820 },
  { name: 'ipad-portrait', width: 820, height: 1180 },
  { name: 'iphone', width: 390, height: 844 },
] as const;

const SHOTS = join(import.meta.dirname, '..', '..', 'test-results', 'screens');

test('E2E-10: every main screen × 4 viewports — no horizontal scroll, practice buttons ≥ 64 px', async ({
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const problems: string[] = [];
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const screen of SCREENS) {
      await openScreen(page, screen);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      if (scrollWidth > innerWidth)
        problems.push(`${viewport.name} ${screen.name}: scrollWidth ${scrollWidth} > ${innerWidth}`);
      if (screen.practice) {
        // Main practice controls are the large buttons (SPEC §12.2: at least 64 × 64 px).
        const boxes = await page.locator('main button.min-h-16').evaluateAll((els) =>
          els
            .filter((el) => (el as HTMLElement).offsetParent !== null)
            .map((el) => el.getBoundingClientRect())
            .map((r) => ({ w: r.width, h: r.height })),
        );
        if (boxes.length === 0) problems.push(`${viewport.name} ${screen.name}: no main practice button`);
        for (const b of boxes)
          if (b.w < 64 || b.h < 64)
            problems.push(`${viewport.name} ${screen.name}: button ${b.w.toFixed(0)}×${b.h.toFixed(0)}`);
      }
      await page.screenshot({
        path: join(SHOTS, testInfo.project.name, `${viewport.name}-${screen.name}.png`),
        fullPage: true,
      });
    }
  }
  expect(problems, problems.join('\n')).toEqual([]);
});
